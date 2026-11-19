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

const CLOUDFLARE_ERROR_CODES: Record<number, string> = {
  502: 'Bad Gateway (502): Server lokal di balik Cloudflare Tunnel belum menyala atau port salah.',
  503: 'Service Unavailable (503): Server lokal sedang penuh atau tunnel terputus.',
  504: 'Gateway Timeout (504): Server lokal terlalu lama merespons (Cold start VRAM).',
  520: 'Cloudflare Error (520): Respons tak terduga dari origin server lokal.',
  522: 'Connection Timed Out (522): Cloudflare tidak dapat menjangkau IP PC lokal Anda.',
  524: 'A Timeout Occurred (524): Model terlalu besar untuk dimuat dalam batas waktu Cloudflare.',
  530: 'Origin DNS / Tunnel Error (530): Daemon cloudflared di PC Anda sedang mati / offline.',
};

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const { endpoint, apiKey, payload } = body as {
    endpoint?: string;
    apiKey?: string;
    payload: Record<string, unknown>;
  };

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
      return res.status(upstream.status).json({
        error:
          CLOUDFLARE_ERROR_CODES[upstream.status] ||
          `Server error (${upstream.status}): ${errText}`,
      });
    }

    if (!payload?.stream) {
      const data = await upstream.json();
      return res.json(data);
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    req.on('close', () => {
      reader.cancel().catch(() => {});
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal terhubung ke server lokal';
    if (!res.headersSent) {
      res.status(502).json({ error: `Proxy Error ke ${baseUrl}: ${message}` });
    } else {
      res.end();
    }
  }
}
