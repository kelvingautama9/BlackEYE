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

interface NodeLikeRequest {
  method?: string;
  body?: unknown;
  json?: () => Promise<unknown>;
}

interface NodeLikeResponse {
  status: (code: number) => NodeLikeResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  flushHeaders?: () => void;
  write: (chunk: string) => void;
  end: () => void;
  headersSent?: boolean;
}

export default async function handler(
  req: Request | NodeLikeRequest,
  res?: NodeLikeResponse
): Promise<Response | void> {
  const isNodeMode = Boolean(res && typeof res.setHeader === 'function');
  const method = req.method || 'POST';

  if (method !== 'POST') {
    if (isNodeMode && res) {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: {
    endpoint?: string;
    apiKey?: string;
    payload?: Record<string, unknown>;
  } = {};

  try {
    if (typeof (req as Request).json === 'function' && !isNodeMode) {
      body = (await (req as Request).json()) || {};
    } else {
      const rawBody = (req as NodeLikeRequest).body;
      body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody as typeof body) || {};
    }
  } catch {
    body = {};
  }

  const { endpoint, apiKey, payload = {} } = body;
  const baseUrl = normalizeEndpoint(endpoint || 'https://api.vinns.my.id');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    let upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!upstream.ok && upstream.status === 400 && payload && 'max_tokens' in payload) {
      const retryPayload = { ...payload };
      delete retryPayload.max_tokens;
      upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(retryPayload),
      });
    }

    if (!upstream.ok) {
      const errText = await upstream.text();
      const errPayload = {
        error:
          CLOUDFLARE_ERROR_CODES[upstream.status] ||
          `Server error (${upstream.status}): ${errText}`,
      };
      if (isNodeMode && res) {
        res.status(upstream.status).json(errPayload);
        return;
      }
      return new Response(JSON.stringify(errPayload), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!payload?.stream) {
      const data = await upstream.json();
      if (isNodeMode && res) {
        res.status(200).json(data);
        return;
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (isNodeMode && res) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      if (!upstream.body) {
        res.end();
        return;
      }
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
      return;
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal terhubung ke server lokal';
    const errPayload = { error: `Proxy Error ke ${baseUrl}: ${message}` };
    if (isNodeMode && res) {
      if (!res.headersSent) res.status(502).json(errPayload);
      else res.end();
      return;
    }
    return new Response(JSON.stringify(errPayload), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
