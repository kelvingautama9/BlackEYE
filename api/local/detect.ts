export const config = {
  runtime: 'edge',
};

function normalizeEndpoint(raw: string): string {
  let url = (raw || '').trim();
  if (!url) return 'https://api.vinns.my.id';
  if (!/^https?:\/\//i.test(url)) {
    const isLocal = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url);
    url = (isLocal ? 'http://' : 'https://') + url;
  }
  return url.replace(/\/+$/, '').replace(/\/v1$/i, '');
}

const CLOUDFLARE_ERROR_CODES: Record<number, string> = {
  502: 'Bad Gateway (502): Server lokal di balik Cloudflare Tunnel belum menyala atau port salah.',
  503: 'Service Unavailable (503): Server lokal sedang penuh atau tunnel terputus.',
  504: 'Gateway Timeout (504): Server lokal terlalu lama merespons (Cold start VRAM).',
  520: 'Cloudflare Error (520): Respons tak terduga dari origin server lokal.',
  522: 'Connection Timed Out (522): Cloudflare tidak dapat menjangkau IP PC lokal Anda.',
  524: 'A Timeout Occurred (524): Model terlalu besar untuk dimuat dalam batas waktu Cloudflare.',
  530: 'Origin DNS / Tunnel Error (530): Daemon cloudflared di PC Anda sedang mati / offline.',
};

interface DetectedModel {
  id: string;
  name: string;
  providerFormat: 'ollama' | 'lm-studio' | 'openai-compatible';
  isLoaded: boolean;
  parameterSize?: string;
  quantization?: string;
  sizeBytes?: number;
  family?: string;
}

export default async function handler(req: Request): Promise<Response> {
  const urlObj = new URL(req.url);
  const rawEndpoint = urlObj.searchParams.get('endpoint') || 'https://api.vinns.my.id';
  const apiKey = urlObj.searchParams.get('apiKey') || '';
  const baseUrl = normalizeEndpoint(rawEndpoint);
  const startMs = Date.now();

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const fetchWithTimeout = async (url: string, timeoutMs = 4500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  try {
    const [ollamaTagsRes, ollamaPsRes, lmsModelsRes, oaiModelsRes] = await Promise.allSettled([
      fetchWithTimeout(`${baseUrl}/api/tags`),
      fetchWithTimeout(`${baseUrl}/api/ps`),
      fetchWithTimeout(`${baseUrl}/api/v0/models`),
      fetchWithTimeout(`${baseUrl}/v1/models`),
    ]);

    const latencyMs = Date.now() - startMs;
    const modelsMap = new Map<string, DetectedModel>();
    let detectedFormat: 'ollama' | 'lm-studio' | 'openai-compatible' = 'openai-compatible';
    let cfErrorMsg = '';

    for (const r of [ollamaTagsRes, lmsModelsRes, oaiModelsRes]) {
      if (r.status === 'fulfilled' && CLOUDFLARE_ERROR_CODES[r.value.status]) {
        cfErrorMsg = CLOUDFLARE_ERROR_CODES[r.value.status];
      }
    }

    const loadedOllamaSet = new Set<string>();
    if (ollamaPsRes.status === 'fulfilled' && ollamaPsRes.value.ok) {
      try {
        const psData = (await ollamaPsRes.value.json()) as {
          models?: Array<{ name?: string; model?: string }>;
        };
        (psData.models || []).forEach((m) => {
          if (m.name) loadedOllamaSet.add(m.name);
          if (m.model) loadedOllamaSet.add(m.model);
        });
      } catch {
        // ignore
      }
    }

    if (ollamaTagsRes.status === 'fulfilled' && ollamaTagsRes.value.ok) {
      try {
        const tagsData = (await ollamaTagsRes.value.json()) as {
          models?: Array<{
            name: string;
            model?: string;
            size?: number;
            details?: { parameter_size?: string; quantization_level?: string; family?: string };
          }>;
        };
        if (Array.isArray(tagsData.models)) {
          detectedFormat = 'ollama';
          tagsData.models.forEach((m) => {
            const id = m.name || m.model || '';
            if (!id) return;
            modelsMap.set(id, {
              id,
              name: id,
              providerFormat: 'ollama',
              isLoaded: loadedOllamaSet.has(id),
              parameterSize: m.details?.parameter_size,
              quantization: m.details?.quantization_level,
              sizeBytes: m.size,
              family: m.details?.family,
            });
          });
        }
      } catch {
        // ignore
      }
    }

    if (lmsModelsRes.status === 'fulfilled' && lmsModelsRes.value.ok) {
      try {
        const lmsData = (await lmsModelsRes.value.json()) as {
          data?: Array<{ id: string; state?: string; quantization?: string; arch?: string }>;
        };
        if (Array.isArray(lmsData.data)) {
          detectedFormat = 'lm-studio';
          lmsData.data.forEach((m) => {
            if (!m.id) return;
            modelsMap.set(m.id, {
              id: m.id,
              name: m.id,
              providerFormat: 'lm-studio',
              isLoaded: m.state === 'loaded',
              quantization: m.quantization,
              family: m.arch,
            });
          });
        }
      } catch {
        // ignore
      }
    }

    if (oaiModelsRes.status === 'fulfilled' && oaiModelsRes.value.ok) {
      try {
        const oaiData = (await oaiModelsRes.value.json()) as { data?: Array<{ id: string }> };
        if (Array.isArray(oaiData.data)) {
          oaiData.data.forEach((m) => {
            if (!m.id || modelsMap.has(m.id)) return;
            const isEmbedding = /embed|nomic/i.test(m.id);
            modelsMap.set(m.id, {
              id: m.id,
              name: m.id,
              providerFormat: detectedFormat,
              isLoaded: !isEmbedding,
            });
          });
        }
      } catch {
        // ignore
      }
    }

    const models = Array.from(modelsMap.values());
    if (models.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          endpoint: baseUrl,
          latencyMs,
          error:
            cfErrorMsg ||
            `Tidak dapat menemukan model aktif di ${baseUrl}. Pastikan LM Studio / Ollama dan Cloudflare Tunnel sedang berjalan.`,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        endpoint: baseUrl,
        providerFormat: detectedFormat,
        latencyMs,
        models,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown connection error';
    return new Response(
      JSON.stringify({
        ok: false,
        endpoint: baseUrl,
        error: `Koneksi gagal ke ${baseUrl}: ${message}`,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
