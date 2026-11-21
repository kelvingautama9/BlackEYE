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

function getCleanGeminiApiKey(): string {
  return (
    getEnvVar('GEMINI_API_KEY') ||
    getEnvVar('VITE_GEMINI_API_KEY') ||
    getEnvVar('GOOGLE_API_KEY') ||
    getEnvVar('GOOGLE_GENERATIVE_AI_API_KEY') ||
    getEnvVar('NEXT_PUBLIC_GEMINI_API_KEY')
  );
}

const STATIC_GEMINI_FALLBACK_POOL = [
  'gemini-2.5-flash',
  'gemini-4-hydrogen',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-pro',
  'gemma-3-27b-it',
];

const STATIC_OPENROUTER_FALLBACK_POOL = [
  'openrouter/free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'cohere/north-mini-code:free',
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
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }
    }
    const textContent = (m.content || '').trim() || 'Jelaskan lampiran ini.';
    parts.push({ text: textContent });
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
    merged.push({
      role: 'user',
      parts: [{ text: 'Halo' }],
    });
  }

  return merged;
}

function summarizeErrorReason(status: number, rawMsg: string): string {
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(rawMsg)) {
    return 'Kuota / token limit habis (429)';
  }
  if (status === 404 || /NOT_FOUND|not found/i.test(rawMsg)) {
    return 'Model tidak tersedia (404)';
  }
  if (status === 503 || status === 502 || /overloaded|unavailable/i.test(rawMsg)) {
    return 'Server sedang sibuk (503)';
  }
  if (/abort|timeout/i.test(rawMsg)) {
    return 'Model tidak merespons (Timeout)';
  }
  return `Error ${status || 'jaringan'}`;
}

async function discoverLiveGeminiModels(apiKey: string, alreadyTried: Set<string>): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(
        apiKey
      )}`,
      {
        headers: { 'User-Agent': 'aistudio-build' },
        signal: controller.signal,
      }
    );
    if (!r.ok) return [];
    const data = (await r.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    return (data.models || [])
      .filter(
        (m) =>
          m.name &&
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m) => (m.name || '').replace(/^models\//, ''))
      .filter(
        (id) =>
          /^(gemini|gemma)/i.test(id) &&
          !/^gemini-(1\.5|2\.0|pro$)/i.test(id) &&
          !/(embedding|imagen|veo|tts|audio|live|aqa|robotics|computer-use|vision-001|001$)/i.test(id) &&
          !alreadyTried.has(id)
      )
      .slice(0, 5);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function tryStreamGeminiModel(opts: {
  model: string;
  apiKey: string;
  contents: GeminiContent[];
  systemPrompt: string;
  temperature: number;
  webSearch: boolean;
  deepReasoning: boolean;
  writeSse: (chunk: string) => void;
  onFirstToken?: () => void;
}): Promise<{ ok: boolean; status: number; errorMessage: string; fatalAuth?: boolean }> {
  const {
    model,
    apiKey,
    contents,
    systemPrompt,
    temperature,
    webSearch,
    deepReasoning,
    writeSse,
    onFirstToken,
  } = opts;

  const isGemma = model.startsWith('gemma');
  const supportsFastThinking = model.startsWith('gemini-2.5-flash') && !deepReasoning;

  const attempts: Array<{ useTools: boolean; useFastThinking: boolean; useSystemInstruction: boolean }> = [];
  if (webSearch && !isGemma) {
    attempts.push({
      useTools: true,
      useFastThinking: supportsFastThinking,
      useSystemInstruction: Boolean(systemPrompt),
    });
  }
  attempts.push({
    useTools: false,
    useFastThinking: supportsFastThinking,
    useSystemInstruction: Boolean(systemPrompt) && !isGemma,
  });
  if (supportsFastThinking) {
    attempts.push({
      useTools: false,
      useFastThinking: false,
      useSystemInstruction: Boolean(systemPrompt) && !isGemma,
    });
  }

  let lastStatus = 0;
  let lastError = 'Tidak ada respons dari model.';

  for (const attempt of attempts) {
    // If model is Gemma (which doesn't support systemInstruction field), prepend systemPrompt to first user turn
    let effectiveContents = contents;
    if (systemPrompt && !attempt.useSystemInstruction && contents.length > 0) {
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
      generationConfig.temperature = temperature;
    }
    if (attempt.useFastThinking) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const payload: Record<string, unknown> = {
      contents: effectiveContents,
      ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
    };

    if (systemPrompt && attempt.useSystemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }
    if (attempt.useTools) {
      payload.tools = [{ googleSearch: {} }];
    }

    const controller = new AbortController();
    const headerTimeoutMs = model.includes('2.5-pro') ? 14000 : 9500;
    const headerTimer = setTimeout(() => controller.abort(), headerTimeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

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

      if (!upstream.ok) {
        lastStatus = upstream.status;
        const errRaw = await upstream.text();
        let parsedErr = errRaw;
        try {
          const errObj = JSON.parse(errRaw);
          parsedErr = errObj?.error?.message || errRaw;
        } catch {
          // keep raw
        }
        lastError = parsedErr;

        // Fatal invalid API key: stop immediately
        if (
          upstream.status === 401 ||
          /API_KEY_INVALID|API key not valid|ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(parsedErr)
        ) {
          return { ok: false, status: upstream.status, errorMessage: parsedErr, fatalAuth: true };
        }

        // Rate limit or model not found: no point retrying same model with different flags
        if (upstream.status === 429 || upstream.status === 404 || upstream.status === 503) {
          return { ok: false, status: upstream.status, errorMessage: parsedErr };
        }
        continue;
      }

      if (!upstream.body) {
        lastStatus = 502;
        lastError = 'Respons stream kosong dari Google Gemini API.';
        continue;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let emittedAnyToken = false;

      // First-token watchdog: if upstream stays silent without emitting text, abort & fallback!
      let firstTokenTimer: ReturnType<typeof setTimeout> | null = setTimeout(
        () => {
          if (!emittedAnyToken) {
            controller.abort();
            reader.cancel().catch(() => {});
          }
        },
        model.includes('2.5-pro') ? 15000 : 10500
      );

      const markFirstToken = () => {
        if (!emittedAnyToken) {
          emittedAnyToken = true;
          if (firstTokenTimer) {
            clearTimeout(firstTokenTimer);
            firstTokenTimer = null;
          }
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
                markFirstToken();
                writeSse(
                  `data: ${JSON.stringify({
                    choices: [{ delta: { reasoning_content: part.text } }],
                  })}\n\n`
                );
              } else if (typeof part?.text === 'string' && part.text.length > 0) {
                markFirstToken();
                writeSse(
                  `data: ${JSON.stringify({
                    choices: [{ delta: { content: part.text } }],
                  })}\n\n`
                );
              }
            }
          }
        } catch {
          // ignore partial json
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
        if (firstTokenTimer) clearTimeout(firstTokenTimer);
      }

      if (emittedAnyToken) {
        return { ok: true, status: 200, errorMessage: '' };
      }

      lastStatus = 504;
      lastError = 'Model tidak mengirim token jawaban (Timeout / Empty Stream).';
    } catch (err: unknown) {
      clearTimeout(headerTimer);
      lastStatus = 504;
      lastError = err instanceof Error ? err.message : 'Timeout koneksi Gemini API';
    }
  }

  return { ok: false, status: lastStatus, errorMessage: lastError };
}

async function tryStreamOpenRouterFallback(opts: {
  openRouterKey: string;
  model: string;
  messages: IncomingMessageItem[];
  systemPrompt: string;
  temperature: number;
  writeSse: (chunk: string) => void;
  onFirstToken?: () => void;
}): Promise<{ ok: boolean; status: number; errorMessage: string }> {
  const { openRouterKey, model, messages, systemPrompt, temperature, writeSse, onFirstToken } = opts;

  const apiMessages: Array<Record<string, unknown>> = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages) {
    if (
      !m ||
      typeof m.content !== 'string' ||
      m.content.startsWith('**Koneksi Terputus / Gagal**')
    ) {
      continue;
    }
    apiMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.trim() || 'Halo',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterKey}`,
        'HTTP-Referer': getEnvVar('APP_URL') || 'https://vinns.my.id',
        'X-Title': 'Vinns Studio AI',
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature,
        stream: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok || !upstream.body) {
      const errRaw = await upstream.text().catch(() => '');
      return { ok: false, status: upstream.status, errorMessage: errRaw || `HTTP ${upstream.status}` };
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
    }, 10000);

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
    return { ok: false, status: 504, errorMessage: 'OpenRouter empty stream' };
  } catch (err: unknown) {
    clearTimeout(timer);
    return {
      ok: false,
      status: 504,
      errorMessage: err instanceof Error ? err.message : 'OpenRouter timeout',
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
    model?: string;
    messages?: IncomingMessageItem[];
    systemPrompt?: string;
    webSearch?: boolean;
    deepReasoning?: boolean;
    temperature?: number;
    autoFallback?: boolean;
    openRouterApiKey?: string;
    skipModels?: string[];
  } = {};

  try {
    body = (await req.json()) || {};
  } catch {
    body = {};
  }

  const apiKey = getCleanGeminiApiKey();
  const openRouterKey = (
    body.openRouterApiKey ||
    getEnvVar('OPENROUTER_API_KEY') ||
    getEnvVar('VITE_OPENROUTER_API_KEY') ||
    ''
  ).trim();

  if ((!apiKey || apiKey === 'MY_GEMINI_API_KEY') && !openRouterKey) {
    return new Response(
      JSON.stringify({
        error:
          'GEMINI_API_KEY belum terbaca di Environment Variables Vercel. Tambahkan GEMINI_API_KEY di Vercel Settings > Environment Variables lalu Redeploy.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const originalRequested = (body.model || 'gemini-2.5-flash').trim();
  const primaryModel = originalRequested;
  const autoFallback = body.autoFallback !== false;
  const skipSet = new Set(Array.isArray(body.skipModels) ? body.skipModels : []);
  const contents = buildNormalizedGeminiContents(body.messages || []);
  const systemPrompt = (body.systemPrompt || '').trim();
  const webSearch = Boolean(body.webSearch);
  const deepReasoning = Boolean(body.deepReasoning);
  const temperature = typeof body.temperature === 'number' ? body.temperature : 0.7;

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

      // Immediately flush HTTP 200 SSE start byte so Vercel Gateway never hits 504
      writeSse(': stream-start\n\n');
      const heartbeat = setInterval(() => writeSse(': ping\n\n'), 2000);

      try {
        const triedModels = new Set<string>();
        const initialQueue: string[] = [];

        if (!skipSet.has(primaryModel)) {
          initialQueue.push(primaryModel);
        }
        if (autoFallback) {
          for (const m of STATIC_GEMINI_FALLBACK_POOL) {
            if (!initialQueue.includes(m) && !skipSet.has(m)) {
              initialQueue.push(m);
            }
          }
          // Add skipped models at the very end as last resort
          for (const m of [primaryModel, ...STATIC_GEMINI_FALLBACK_POOL]) {
            if (!initialQueue.includes(m)) {
              initialQueue.push(m);
            }
          }
        }

        let succeeded = false;
        let lastErrorMessage = 'Semua model Google Gemini gagal merespons.';
        let lastFailureReason = '';
        let fatalGeminiAuth = false;

        // Tier 1: Try primary + static Gemini fallback pool
        if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
          for (const candidateModel of initialQueue) {
            triedModels.add(candidateModel);
            const result = await tryStreamGeminiModel({
              model: candidateModel,
              apiKey,
              contents,
              systemPrompt,
              temperature,
              webSearch,
              deepReasoning,
              writeSse,
              onFirstToken: () => {
                const switched = candidateModel !== originalRequested;
                writeSse(
                  `data: ${JSON.stringify({
                    meta: {
                      activeModel: candidateModel,
                      activeProvider: 'gemini',
                      switched,
                      fromModel: switched ? originalRequested : undefined,
                      reason: switched
                        ? lastFailureReason || 'Model dialihkan otomatis'
                        : undefined,
                    },
                  })}\n\n`
                );
              },
            });

            if (result.ok) {
              succeeded = true;
              break;
            }

            lastErrorMessage = `Gemini (${candidateModel}): ${result.errorMessage}`;
            lastFailureReason = summarizeErrorReason(result.status, result.errorMessage);

            if (result.fatalAuth) {
              fatalGeminiAuth = true;
              break;
            }
            if (!autoFallback) break;
          }

          // Tier 2: Dynamically discover live Gemini models accessible by this key if static pool failed
          if (!succeeded && autoFallback && !fatalGeminiAuth) {
            const liveExtras = await discoverLiveGeminiModels(apiKey, triedModels);
            for (const candidateModel of liveExtras) {
              triedModels.add(candidateModel);
              const result = await tryStreamGeminiModel({
                model: candidateModel,
                apiKey,
                contents,
                systemPrompt,
                temperature,
                webSearch: false,
                deepReasoning: false,
                writeSse,
                onFirstToken: () => {
                  writeSse(
                    `data: ${JSON.stringify({
                      meta: {
                        activeModel: candidateModel,
                        activeProvider: 'gemini',
                        switched: true,
                        fromModel: originalRequested,
                        reason: lastFailureReason || 'Dialihkan ke model Gemini aktif lain',
                      },
                    })}\n\n`
                  );
                },
              });

              if (result.ok) {
                succeeded = true;
                break;
              }
              lastErrorMessage = `Gemini (${candidateModel}): ${result.errorMessage}`;
              lastFailureReason = summarizeErrorReason(result.status, result.errorMessage);
            }
          }
        }

        // Tier 3: Cross-Provider Cloud Failover to OpenRouter if Gemini exhausted & OpenRouter key exists
        if (!succeeded && autoFallback && openRouterKey) {
          for (const orModel of STATIC_OPENROUTER_FALLBACK_POOL) {
            const orRes = await tryStreamOpenRouterFallback({
              openRouterKey,
              model: orModel,
              messages: body.messages || [],
              systemPrompt,
              temperature,
              writeSse,
              onFirstToken: () => {
                writeSse(
                  `data: ${JSON.stringify({
                    meta: {
                      activeModel: orModel,
                      activeProvider: 'openrouter',
                      switched: true,
                      fromModel: originalRequested,
                      reason: `Auto-Failover ke OpenRouter (${lastFailureReason || 'Gemini penuh'})`,
                    },
                  })}\n\n`
                );
              },
            });
            if (orRes.ok) {
              succeeded = true;
              break;
            }
            lastErrorMessage = `OpenRouter (${orModel}): ${orRes.errorMessage}`;
          }
        }

        if (!succeeded) {
          writeSse(`data: ${JSON.stringify({ error: lastErrorMessage })}\n\n`);
        }

        writeSse('data: [DONE]\n\n');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Google Gemini Stream Error';
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
