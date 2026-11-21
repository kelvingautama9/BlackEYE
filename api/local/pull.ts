export const config = {
  runtime: 'edge',
};

function normalizeEndpoint(raw: string): string {
  let url = (raw || '').trim();
  if (!url) return 'http://localhost:11434';
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
    modelName?: string;
  } = {};

  try {
    body = (await req.json()) || {};
  } catch {
    body = {};
  }

  const { endpoint, apiKey, modelName } = body;
  if (!modelName) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Nama model wajib diisi (contoh: qwen2.5:3b)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const baseUrl = normalizeEndpoint(endpoint || 'http://localhost:11434');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const r = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: modelName.trim(), stream: false }),
    });
    if (!r.ok) {
      const text = await r.text();
      return new Response(
        JSON.stringify({ ok: false, error: `Gagal menarik model: ${text}` }),
        { status: r.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const data = await r.json();
    return new Response(JSON.stringify({ ok: true, modelName, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Gagal menghubungi endpoint Ollama /api/pull';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
