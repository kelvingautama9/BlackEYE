import type { Request, Response } from 'express';

function normalizeEndpoint(raw: string): string {
  let url = (raw || '').trim();
  if (!url) return 'http://localhost:11434';
  if (!/^https?:\/\//i.test(url)) {
    const isLocal = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url);
    url = (isLocal ? 'http://' : 'https://') + url;
  }
  return url.replace(/\/+$/, '').replace(/\/v1$/i, '');
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const { endpoint, apiKey, modelName } = body as {
    endpoint?: string;
    apiKey?: string;
    modelName?: string;
  };
  if (!modelName) {
    return res.status(400).json({ ok: false, error: 'Nama model wajib diisi (contoh: qwen2.5:3b)' });
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
      return res.status(r.status).json({ ok: false, error: `Gagal menarik model: ${text}` });
    }
    const data = await r.json();
    return res.json({ ok: true, modelName, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghubungi endpoint Ollama /api/pull';
    return res.status(502).json({ ok: false, error: message });
  }
}
