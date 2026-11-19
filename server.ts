import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

// Helper to normalize local/tunnel endpoint URLs
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

// 1. GET /api/local/detect?endpoint=...
app.get('/api/local/detect', async (req: Request, res: Response) => {
  const rawEndpoint = String(req.query.endpoint || 'https://api.vinns.my.id');
  const apiKey = String(req.query.apiKey || '');
  const baseUrl = normalizeEndpoint(rawEndpoint);
  const startMs = Date.now();

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

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

    // Check for Cloudflare specific status codes on any fulfilled response
    for (const r of [ollamaTagsRes, lmsModelsRes, oaiModelsRes]) {
      if (r.status === 'fulfilled' && CLOUDFLARE_ERROR_CODES[r.value.status]) {
        cfErrorMsg = CLOUDFLARE_ERROR_CODES[r.value.status];
      }
    }

    // Parse Ollama /api/ps (active VRAM models)
    const loadedOllamaSet = new Set<string>();
    if (ollamaPsRes.status === 'fulfilled' && ollamaPsRes.value.ok) {
      try {
        const psData = (await ollamaPsRes.value.json()) as { models?: Array<{ name?: string; model?: string }> };
        (psData.models || []).forEach((m) => {
          if (m.name) loadedOllamaSet.add(m.name);
          if (m.model) loadedOllamaSet.add(m.model);
        });
      } catch {
        // ignore JSON parse error
      }
    }

    // Parse Ollama /api/tags
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

    // Parse LM Studio /api/v0/models
    if (lmsModelsRes.status === 'fulfilled' && lmsModelsRes.value.ok) {
      try {
        const lmsData = (await lmsModelsRes.value.json()) as {
          data?: Array<{
            id: string;
            state?: string;
            quantization?: string;
            arch?: string;
          }>;
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

    // Parse OpenAI-Compatible /v1/models
    if (oaiModelsRes.status === 'fulfilled' && oaiModelsRes.value.ok) {
      try {
        const oaiData = (await oaiModelsRes.value.json()) as {
          data?: Array<{ id: string }>;
        };
        if (Array.isArray(oaiData.data)) {
          oaiData.data.forEach((m) => {
            if (!m.id || modelsMap.has(m.id)) return;
            const isEmbedding = /embed|nomic/i.test(m.id);
            modelsMap.set(m.id, {
              id: m.id,
              name: m.id,
              providerFormat: detectedFormat,
              // In standard /v1/models on LM Studio, listed models are typically ready/active unless embedding
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
      return res.status(502).json({
        ok: false,
        endpoint: baseUrl,
        latencyMs,
        error:
          cfErrorMsg ||
          `Tidak dapat menemukan model aktif di ${baseUrl}. Pastikan LM Studio / Ollama dan Cloudflare Tunnel sedang berjalan.`,
      });
    }

    return res.json({
      ok: true,
      endpoint: baseUrl,
      providerFormat: detectedFormat,
      latencyMs,
      models,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown connection error';
    return res.status(502).json({
      ok: false,
      endpoint: baseUrl,
      error: `Koneksi gagal ke ${baseUrl}: ${message}`,
    });
  }
});

// 2. POST /api/local/load
app.post('/api/local/load', async (req: Request, res: Response) => {
  const { endpoint, apiKey, modelId, providerFormat } = req.body as {
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

    // Universal 1-token warmup ping
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

    return res.json({
      ok: true,
      modelId,
      latencyMs: Date.now() - startMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memuat model';
    return res.status(502).json({ ok: false, error: message });
  }
});

// 3. POST /api/local/pull (Ollama Pull)
app.post('/api/local/pull', async (req: Request, res: Response) => {
  const { endpoint, apiKey, modelName } = req.body as {
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
});

// 4. POST /api/local/stream (Auto-Rescue Proxy for CORS / Mixed-Content & Smart Retry HTTP 400)
app.post('/api/local/stream', async (req: Request, res: Response) => {
  const { endpoint, apiKey, payload } = req.body as {
    endpoint?: string;
    apiKey?: string;
    payload: Record<string, unknown>;
  };

  const baseUrl = normalizeEndpoint(endpoint || 'https://api.vinns.my.id');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    let upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    // Smart Retry HTTP 400 on LM Studio when max_tokens exceeds remaining context length
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
        error: CLOUDFLARE_ERROR_CODES[upstream.status] || `Server error (${upstream.status}): ${errText}`,
      });
    }

    if (!payload.stream) {
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
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
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
});

// 5. POST /api/gemini/stream (Server-Side Google Gemini API with automatic model fallback)
const FALLBACK_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
];

app.post('/api/gemini/stream', async (req: Request, res: Response) => {
  try {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({
        error:
          'GEMINI_API_KEY belum dikonfigurasi di environment server. Silakan gunakan Local LM atau atur GEMINI_API_KEY di Environment Variables.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const { model, messages = [], systemPrompt, webSearch } = req.body as {
      model?: string;
      messages: Array<{ role: string; content: string; images?: string[] }>;
      systemPrompt?: string;
      webSearch?: boolean;
    };

    const requestedModel = model || 'gemini-2.5-flash';
    const candidateModels = [
      requestedModel,
      ...FALLBACK_GEMINI_MODELS.filter((m) => m !== requestedModel),
    ];

    // Convert conversation history into contents format for @google/genai
    const contents = messages.map((m) => {
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      if (m.images && m.images.length > 0) {
        m.images.forEach((dataUrl) => {
          const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            });
          }
        });
      }
      parts.push({ text: m.content || 'Jelaskan lampiran ini.' });
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });

    const baseConfig: Record<string, unknown> = {};
    if (systemPrompt) {
      baseConfig.systemInstruction = systemPrompt;
    }

    let streamResponse: AsyncGenerator<{ text?: string }, void, unknown> | null = null;
    let lastError: unknown = null;

    for (const candidateModel of candidateModels) {
      try {
        const config = { ...baseConfig };
        if (webSearch) {
          config.tools = [{ googleSearch: {} }];
        }
        streamResponse = (await ai.models.generateContentStream({
          model: candidateModel,
          contents,
          config,
        })) as unknown as AsyncGenerator<{ text?: string }, void, unknown>;
        break;
      } catch (err: unknown) {
        lastError = err;
        if (webSearch) {
          try {
            streamResponse = (await ai.models.generateContentStream({
              model: candidateModel,
              contents,
              config: baseConfig,
            })) as unknown as AsyncGenerator<{ text?: string }, void, unknown>;
            break;
          } catch (retryErr: unknown) {
            lastError = retryErr;
          }
        }
      }
    }

    if (!streamResponse) {
      const errMsg =
        lastError instanceof Error ? lastError.message : 'Gagal memulai stream Gemini API';
      return res.status(500).json({ error: errMsg });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of streamResponse) {
      const text = chunk.text;
      if (text) {
        const ssePayload = JSON.stringify({
          choices: [{ delta: { content: text } }],
        });
        res.write(`data: ${ssePayload}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Google Gemini API Error';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      const errPayload = JSON.stringify({
        choices: [{ delta: { content: `\n\n**[Error Gemini API]:** ${message}` } }],
      });
      res.write(`data: ${errPayload}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// 6. POST /api/openrouter/stream (OpenRouter proxy with automatic GEMINI_API_KEY fallback)
app.post('/api/openrouter/stream', async (req: Request, res: Response) => {
  try {
    const {
      apiKey: clientOrKey,
      payload = {},
      messages: rawMessages = [],
      systemPrompt,
    } = req.body as {
      apiKey?: string;
      payload?: Record<string, unknown>;
      messages?: Array<{ role: string; content: string; images?: string[] }>;
      systemPrompt?: string;
    };

    const openRouterKey = (
      clientOrKey ||
      process.env.OPENROUTER_API_KEY ||
      process.env.VITE_OPENROUTER_API_KEY ||
      ''
    ).trim();

    if (openRouterKey) {
      const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterKey}`,
          'HTTP-Referer': process.env.APP_URL || 'https://vinns.my.id',
          'X-Title': 'Vinns Studio AI',
        },
        body: JSON.stringify(payload),
      });

      if (upstream.ok) {
        if (!payload.stream) {
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
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
        res.end();
        return;
      }
    }

    // Automatic Fallback to GEMINI_API_KEY when OpenRouter key is not set
    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
      return res.status(401).json({
        error:
          'Model OpenRouter membutuhkan OPENROUTER_API_KEY, atau konfigurasi GEMINI_API_KEY di Environment Variables sebagai Cloud AI utama.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contents = rawMessages.map((m) => {
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      if (m.images && m.images.length > 0) {
        m.images.forEach((dataUrl) => {
          const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            });
          }
        });
      }
      parts.push({ text: m.content || 'Jelaskan lampiran ini.' });
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });

    const config: Record<string, unknown> = {};
    if (systemPrompt) {
      config.systemInstruction = systemPrompt;
    }

    let streamResponse: AsyncGenerator<{ text?: string }, void, unknown> | null = null;
    let lastError: unknown = null;

    for (const candidateModel of FALLBACK_GEMINI_MODELS) {
      try {
        streamResponse = (await ai.models.generateContentStream({
          model: candidateModel,
          contents,
          config,
        })) as unknown as AsyncGenerator<{ text?: string }, void, unknown>;
        break;
      } catch (err: unknown) {
        lastError = err;
      }
    }

    if (!streamResponse) {
      const errMsg =
        lastError instanceof Error ? lastError.message : 'Gagal memulai Cloud AI stream';
      return res.status(500).json({ error: errMsg });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of streamResponse) {
      const text = chunk.text;
      if (text) {
        const ssePayload = JSON.stringify({
          choices: [{ delta: { content: text } }],
        });
        res.write(`data: ${ssePayload}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cloud AI Error';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.end();
    }
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vinns Studio Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
