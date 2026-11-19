import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const FALLBACK_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
];

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({
        error:
          'GEMINI_API_KEY belum terbaca di Environment Variables server/Vercel. Pastikan Anda sudah menambahkan GEMINI_API_KEY di Vercel Settings > Environment Variables lalu lakukan Redeploy.',
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

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { model, messages = [], systemPrompt, webSearch } = body as {
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
        // If webSearch tool caused error on this model, try once without tools
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
}
