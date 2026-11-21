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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: {
    endpoint?: string;
    apiKey?: string;
    modelId?: string;
    providerFormat?: string;
  } = {};

  try {
    body = (await req.json()) || {};
  } catch {
    body = {};
  }

  const { endpoint, apiKey, modelId, providerFormat } = body;
  if (!modelId) {
    return new Response(JSON.stringify({ ok: false, error: 'modelId wajib diisi' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = normalizeEndpoint(endpoint || 'https://api.vinns.my.id');
  const startMs = Date.now();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    if (providerFormat === 'ollama') {
      const r = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: modelId, keep_alive: '15m', prompt: '' }),
      });
      if (r.ok) {
        return new Response(
          JSON.stringify({ ok: true, modelId, latencyMs: Date.now() - startMs }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (providerFormat === 'lm-studio') {
      const r = await fetch(`${baseUrl}/api/v0/models/load`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ modelKey: modelId, identifier: modelId }),
      });
      if (r.ok) {
        return new Response(
          JSON.stringify({ ok: true, modelId, latencyMs: Date.now() - startMs }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const warmup = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
    });

    if (!warmup.ok) {
      const errText = await warmup.text();
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Gagal memuat model ke VRAM (${warmup.status}): ${errText}`,
        }),
        { status: warmup.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, modelId, latencyMs: Date.now() - startMs }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memuat model';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
