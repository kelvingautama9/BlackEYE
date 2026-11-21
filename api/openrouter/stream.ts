export const config = {
  runtime: 'edge',
};

interface IncomingMessageItem {
  role: string;
  content: string;
  images?: string[];
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

function getEnvVar(key: string): string {
  if (typeof process !== 'undefined' && process.env) {
    const val = (process.env as Record<string, string | undefined>)[key];
    return (val || '').trim().replace(/^["']|["']$/g, '').trim();
  }
  return '';
}

const STATIC_OPENROUTER_FALLBACK_POOL = [
  'openrouter/free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'cohere/north-mini-code:free',
];

const STATIC_GEMINI_FALLBACK_POOL = [
  'gemini-2.5-flash',
  'gemini-4-hydrogen',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-pro',
  'gemma-3-27b-it',
];

function buildNormalizedGeminiContents(messages: IncomingMessageItem[]): GeminiContent[] {
  const cleaned = (messages || []).filter(
    (m) =>
      m &&
      typeof m.content === 'string' &&
      !m.content.startsWith('**Koneksi Terputus / Gagal**') &&
      !m.content.startsWith('⚠️ **Koneksi Terputus / Gagal**')
  );

  const rawTurns: GeminiContent[] = cleaned.map((m) => {
    const parts: GeminiPart[] = [];
    if (Array.isArray(m.images) && m.images.length > 0) {
      for (const dataUrl of m.images) {
        const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) {
          parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      }
    }
    parts.push({ text: (m.content || '').trim() || 'Jelaskan lampiran ini.' });
    return {
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts,
    };
  });

  while (rawTurns.length > 0 && rawTurns[0].role !== 'user') {
    rawTurns.shift();
  }

  const merged: GeminiContent[] = [];
  for (const turn of rawTurns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.parts.push(...turn.parts);
    } else {
      merged.push({ role: turn.role, parts: [...turn.parts] });
    }
  }

  if (merged.length === 0) {
    merged.push({ role: 'user', parts: [{ text: 'Halo' }] });
  }
  return merged;
}

function summarizeReason(status: number, msg: string): string {
  if (status === 401 || status === 402 || /cookie auth|credits|unauthorized/i.test(msg)) {
    return 'API Key OpenRouter belum aktif / kredit habis';
  }
  if (status === 429 || /rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    return 'Kuota / token limit habis (429)';
  }
  if (status === 404 || /not found|no endpoints/i.test(msg)) {
    return 'Model OpenRouter tidak aktif (404)';
  }
  if (status === 503 || status === 502) {
    return 'Provider sibuk (503)';
  }
  if (/abort|timeout/i.test(msg)) {
    return 'Model tidak merespons (Timeout)';
  }
  return `Error ${status || 'jaringan'}`;
}

async function tryStreamOpenRouterModel(opts: {
  openRouterKey: string;
  model: string;
  payload: Record<string, unknown>;
  writeSse: (chunk: string) => void;
  onFirstToken?: () => void;
}): Promise<{ ok: boolean; status: number; errorMessage: string; fatalAuth?: boolean }> {
  const { openRouterKey, model, payload, writeSse, onFirstToken } = opts;

  const controller = new AbortController();
  const headerTimer = setTimeout(() => controller.abort(), 9500);

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterKey}`,
        'HTTP-Referer': getEnvVar('APP_URL') || 'https://vinns.my.id',
        'X-Title': 'Vinns Studio AI',
      },
      body: JSON.stringify({ ...payload, model, stream: true }),
      signal: controller.signal,
    });
    clearTimeout(headerTimer);

    if (!upstream.ok) {
      const errRaw = await upstream.text().catch(() => '');
      let parsedErr = errRaw;
      try {
        const obj = JSON.parse(errRaw);
        parsedErr = obj?.error?.message || errRaw;
      } catch {
        // keep raw
      }
      const fatalAuth =
        upstream.status === 401 ||
        upstream.status === 402 ||
        /No cookie auth credentials|Invalid API key|User not found/i.test(parsedErr);
      return { ok: false, status: upstream.status, errorMessage: parsedErr, fatalAuth };
    }

    if (!upstream.body) {
      return { ok: false, status: 502, errorMessage: 'OpenRouter empty stream' };
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let emitted = false;

    const firstTokenTimer = setTimeout(() => {
      if (!emitted) {
        controller.abort();
        reader.cancel().catch(() => {});
      }
    }, 10500);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const raw = trimmed.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.error) {
              const eMsg =
                typeof parsed.error === 'string'
                  ? parsed.error
                  : parsed.error.message || JSON.stringify(parsed.error);
              return { ok: false, status: 502, errorMessage: eMsg };
            }
            const delta = parsed?.choices?.[0]?.delta;
            if (delta?.content || delta?.reasoning_content) {
              if (!emitted) {
                emitted = true;
                clearTimeout(firstTokenTimer);
                onFirstToken?.();
              }
              writeSse(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
            }
          } catch {
            // ignore
          }
        }
      }
    } finally {
      clearTimeout(firstTokenTimer);
    }

    if (emitted) return { ok: true, status: 200, errorMessage: '' };
    return { ok: false, status: 504, errorMessage: 'Model tidak mengirim token jawaban (Timeout)' };
  } catch (err: unknown) {
    clearTimeout(headerTimer);
    return {
      ok: false,
      status: 504,
      errorMessage: err instanceof Error ? err.message : 'Timeout koneksi OpenRouter',
    };
  }
}

async function tryStreamGeminiFallback(opts: {
  geminiKey: string;
  model: string;
  contents: GeminiContent[];
  systemPrompt: string;
  deepReasoning: boolean;
  writeSse: (chunk: string) => void;
  onFirstToken?: () => void;
}): Promise<{ ok: boolean; status: number; errorMessage: string; fatalAuth?: boolean }> {
  const { geminiKey, model, contents, systemPrompt, deepReasoning, writeSse, onFirstToken } = opts;

  const isGemma = model.startsWith('gemma');
  const supportsFastThinking = model.startsWith('gemini-2.5-flash') && !deepReasoning;

  let effectiveContents = contents;
  if (systemPrompt && isGemma && contents.length > 0) {
    effectiveContents = contents.map((turn, idx) =>
      idx === 0 && turn.role === 'user'
        ? {
            ...turn,
            parts: [{ text: `[System Instructions]\n${systemPrompt}\n\n[User]\n` }, ...turn.parts],
          }
        : turn
    );
  }

  const isGemini4 = model.startsWith('gemini-4-');
  const generationConfig: Record<string, unknown> = {};
  if (!isGemini4) {
    generationConfig.temperature = 0.7;
  }
  if (supportsFastThinking) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const payload: Record<string, unknown> = {
    contents: effectiveContents,
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  };
  if (systemPrompt && !isGemma) {
    payload.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const controller = new AbortController();
  const headerTimer = setTimeout(() => controller.abort(), 9500);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(geminiKey)}`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'aistudio-build',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(headerTimer);

    if (!upstream.ok || !upstream.body) {
      const errRaw = await upstream.text().catch(() => '');
      let parsedErr = errRaw;
      try {
        const obj = JSON.parse(errRaw);
        parsedErr = obj?.error?.message || errRaw;
      } catch {
        // keep raw
      }
      const fatalAuth =
        upstream.status === 401 ||
        /API_KEY_INVALID|API key not valid|ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(parsedErr);
      return { ok: false, status: upstream.status, errorMessage: parsedErr, fatalAuth };
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let emitted = false;

    const firstTokenTimer = setTimeout(() => {
      if (!emitted) {
        controller.abort();
        reader.cancel().catch(() => {});
      }
    }, 10500);

    const markFirst = () => {
      if (!emitted) {
        emitted = true;
        clearTimeout(firstTokenTimer);
        onFirstToken?.();
      }
    };

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') return;
      try {
        const parsed = JSON.parse(jsonStr);
        const parts = parsed?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part?.thought && typeof part?.text === 'string' && part.text) {
              markFirst();
              writeSse(
                `data: ${JSON.stringify({
                  choices: [{ delta: { reasoning_content: part.text } }],
                })}\n\n`
              );
            } else if (typeof part?.text === 'string' && part.text.length > 0) {
              markFirst();
              writeSse(
                `data: ${JSON.stringify({
                  choices: [{ delta: { content: part.text } }],
                })}\n\n`
              );
            }
          }
        }
      } catch {
        // ignore
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          processLine(line);
        }
      }
      if (buffer.trim()) {
        processLine(buffer);
      }
    } finally {
      clearTimeout(firstTokenTimer);
    }

    if (emitted) return { ok: true, status: 200, errorMessage: '' };
    return { ok: false, status: 504, errorMessage: 'Gemini fallback empty stream' };
  } catch (err: unknown) {
    clearTimeout(headerTimer);
    return {
      ok: false,
      status: 504,
      errorMessage: err instanceof Error ? err.message : 'Timeout koneksi Gemini fallback',
    };
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: {
    apiKey?: string;
    payload?: Record<string, unknown>;
    messages?: IncomingMessageItem[];
    systemPrompt?: string;
    deepReasoning?: boolean;
    autoFallback?: boolean;
    skipModels?: string[];
  } = {};

  try {
    body = (await req.json()) || {};
  } catch {
    body = {};
  }

  const openRouterKey = (
    body.apiKey ||
    getEnvVar('OPENROUTER_API_KEY') ||
    getEnvVar('VITE_OPENROUTER_API_KEY') ||
    ''
  ).trim();

  const geminiKey =
    getEnvVar('GEMINI_API_KEY') ||
    getEnvVar('VITE_GEMINI_API_KEY') ||
    getEnvVar('GOOGLE_API_KEY') ||
    getEnvVar('GOOGLE_GENERATIVE_AI_API_KEY') ||
    getEnvVar('NEXT_PUBLIC_GEMINI_API_KEY');

  if (!openRouterKey && (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY')) {
    return new Response(
      JSON.stringify({
        error:
          'Model Cloud membutuhkan OPENROUTER_API_KEY atau GEMINI_API_KEY di Vercel Environment Variables.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const payload = body.payload || {};
  const requestedModel = String(payload.model || 'openrouter/free');
  const rawMessages = body.messages || [];
  const systemPrompt = (body.systemPrompt || '').trim();
  const deepReasoning = Boolean(body.deepReasoning);
  const autoFallback = body.autoFallback !== false;
  const skipSet = new Set(Array.isArray(body.skipModels) ? body.skipModels : []);

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const writeSse = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // stream closed
        }
      };

      writeSse(': stream-start\n\n');
      const heartbeat = setInterval(() => writeSse(': ping\n\n'), 2000);

      try {
        let succeeded = false;
        let lastError = 'Gagal terhubung ke OpenRouter & Cloud Fallback.';
        let lastReason = openRouterKey
          ? ''
          : 'OPENROUTER_API_KEY belum diatur, otomatis dialihkan ke Google Gemini';

        // Tier 1: Try OpenRouter requested model + active free models
        if (openRouterKey) {
          const orQueue: string[] = [];
          if (!skipSet.has(requestedModel)) orQueue.push(requestedModel);
          if (autoFallback) {
            for (const m of STATIC_OPENROUTER_FALLBACK_POOL) {
              if (!orQueue.includes(m) && !skipSet.has(m)) orQueue.push(m);
            }
          }

          for (const orModel of orQueue) {
            const orRes = await tryStreamOpenRouterModel({
              openRouterKey,
              model: orModel,
              payload,
              writeSse,
              onFirstToken: () => {
                const switched = orModel !== requestedModel;
                writeSse(
                  `data: ${JSON.stringify({
                    meta: {
                      activeModel: orModel,
                      activeProvider: 'openrouter',
                      switched,
                      fromModel: switched ? requestedModel : undefined,
                      reason: switched ? lastReason || 'Dialihkan ke model OpenRouter aktif' : undefined,
                    },
                  })}\n\n`
                );
              },
            });

            if (orRes.ok) {
              succeeded = true;
              break;
            }

            lastError = `OpenRouter (${orModel}): ${orRes.errorMessage}`;
            lastReason = summarizeReason(orRes.status, orRes.errorMessage);

            if (orRes.fatalAuth || !autoFallback) {
              break;
            }
          }
        }

        // Tier 2: Automatic Cross-Provider Failover to Google Gemini Cloud (using server GEMINI_API_KEY)
        if (!succeeded && autoFallback && geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
          const contents = buildNormalizedGeminiContents(rawMessages);
          const geminiQueue = [
            ...STATIC_GEMINI_FALLBACK_POOL.filter((m) => !skipSet.has(m)),
            ...STATIC_GEMINI_FALLBACK_POOL.filter((m) => skipSet.has(m)),
          ];

          for (const gModel of geminiQueue) {
            const gRes = await tryStreamGeminiFallback({
              geminiKey,
              model: gModel,
              contents,
              systemPrompt,
              deepReasoning,
              writeSse,
              onFirstToken: () => {
                writeSse(
                  `data: ${JSON.stringify({
                    meta: {
                      activeModel: gModel,
                      activeProvider: 'gemini',
                      switched: true,
                      fromModel: requestedModel,
                      reason: lastReason || 'Auto-Failover ke Google Gemini Cloud',
                    },
                  })}\n\n`
                );
              },
            });

            if (gRes.ok) {
              succeeded = true;
              break;
            }

            lastError = `Gemini Fallback (${gModel}): ${gRes.errorMessage}`;
            lastReason = summarizeReason(gRes.status, gRes.errorMessage);
            if (gRes.fatalAuth) break;
          }
        }

        if (!succeeded) {
          writeSse(`data: ${JSON.stringify({ error: lastError })}\n\n`);
        }

        writeSse('data: [DONE]\n\n');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Cloud Stream Error';
        writeSse(`data: ${JSON.stringify({ error: msg })}\n\ndata: [DONE]\n\n`);
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
