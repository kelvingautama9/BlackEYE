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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const {
      apiKey: clientOrKey,
      payload = {},
      messages: rawMessages = [],
      systemPrompt,
    } = body as {
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

    // 1. If OpenRouter API Key is configured, try OpenRouter first
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

    // 2. Automatic Fallback to GEMINI_API_KEY when OpenRouter key is not set or OpenRouter free tier fails
    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
      return res.status(401).json({
        error:
          'Model OpenRouter membutuhkan OPENROUTER_API_KEY, atau konfigurasi GEMINI_API_KEY di Vercel Environment Variables sebagai Cloud AI utama.',
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
}
