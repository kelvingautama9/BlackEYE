import type { Request, Response } from 'express';

function normalizeEndpoint(raw: string): string {
  let url = (raw || '').trim();
  if (!url) return 'https://api.vinns.my.id';
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
  const { endpoint, apiKey, modelId, providerFormat } = body as {
    endpoint?: string;
    apiKey?: string;
    modelId?: string;
    providerFormat?: string;
  };
  if (!modelId) {
    return res.status(400).json({ ok: false, error: 'modelId wajib diisi' });
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
        return res.json({ ok: true, modelId, latencyMs: Date.now() - startMs });
      }
    }

    if (providerFormat === 'lm-studio') {
      const r = await fetch(`${baseUrl}/api/v0/models/load`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ modelKey: modelId, identifier: modelId }),
      });
      if (r.ok) {
        return res.json({ ok: true, modelId, latencyMs: Date.now() - startMs });
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
      return res.status(warmup.status).json({
        ok: false,
        error: `Gagal memuat model ke VRAM (${warmup.status}): ${errText}`,
      });
    }

    return res.json({ ok: true, modelId, latencyMs: Date.now() - startMs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memuat model';
    return res.status(502).json({ ok: false, error: message });
  }
}
