export const config = {
  runtime: 'edge',
};

interface CloudModelItem {
  id: string;
  name: string;
  provider: 'gemini' | 'openrouter';
  providerFormat: 'cloud';
  isLoaded: boolean;
  badgeText: string;
}

function getEnvVar(key: string): string {
  if (typeof process !== 'undefined' && process.env) {
    const val = (process.env as Record<string, string | undefined>)[key];
    return (val || '').trim().replace(/^["']|["']$/g, '').trim();
  }
  return '';
}

const DEFAULT_GEMINI_MODELS: CloudModelItem[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'gemini-2.5-flash',
    provider: 'gemini',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Cepat & Stabil',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'gemini-2.5-flash-lite',
    provider: 'gemini',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Ultra Cepat',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'gemini-2.5-pro',
    provider: 'gemini',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Deep Reasoning',
  },
  {
    id: 'gemini-4-hydrogen',
    name: 'gemini-4-hydrogen',
    provider: 'gemini',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Gemini 4 Flash',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'gemini-3.1-flash-lite',
    provider: 'gemini',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Flash Lite',
  },
];

const DEFAULT_OPENROUTER_MODELS: CloudModelItem[] = [
  {
    id: 'openrouter/free',
    name: 'openrouter/free',
    provider: 'openrouter',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Auto Router',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'google/gemma-4-31b-it:free',
    provider: 'openrouter',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Gemma 4 Free',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'nvidia/nemotron-3.5-lightning:free',
    provider: 'openrouter',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Fast Free',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    provider: 'openrouter',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Reasoning Free',
  },
  {
    id: 'cohere/north-mini-code:free',
    name: 'cohere/north-mini-code:free',
    provider: 'openrouter',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Coder Free',
  },
];

const PREFERRED_GEMINI_ORDER = [
  'gemini-2.5-flash',
  'gemini-4-hydrogen',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-pro',
  'gemma-3-27b-it',
];

function badgeForGemini(id: string): string {
  if (id.includes('4-hydrogen')) return 'Gemini 4 Flash';
  if (id.includes('3.1-flash-lite')) return 'Flash Lite';
  if (id.includes('2.5-pro')) return 'Deep Reasoning';
  if (id.includes('2.5-flash-lite')) return 'Ultra Cepat';
  if (id.includes('2.5-flash')) return 'Cepat & Stabil';
  if (id.includes('gemma')) return 'Gemma Cloud';
  return 'Gemini Live';
}

export default async function handler(): Promise<Response> {
  const geminiKey =
    getEnvVar('GEMINI_API_KEY') ||
    getEnvVar('VITE_GEMINI_API_KEY') ||
    getEnvVar('GOOGLE_API_KEY') ||
    getEnvVar('GOOGLE_GENERATIVE_AI_API_KEY') ||
    getEnvVar('NEXT_PUBLIC_GEMINI_API_KEY');

  const openRouterKey =
    getEnvVar('OPENROUTER_API_KEY') || getEnvVar('VITE_OPENROUTER_API_KEY');

  let geminiModels: CloudModelItem[] = [...DEFAULT_GEMINI_MODELS];
  let openRouterModels: CloudModelItem[] = [...DEFAULT_OPENROUTER_MODELS];
  let geminiLiveVerified = false;
  let openRouterLiveVerified = false;

  const tasks: Promise<void>[] = [];

  // 1. Live discover accessible Gemini models for the configured API key
  if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
    tasks.push(
      (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(
              geminiKey
            )}`,
            {
              headers: { 'User-Agent': 'aistudio-build' },
              signal: controller.signal,
            }
          );
          if (!r.ok) return;
          const data = (await r.json()) as {
            models?: Array<{
              name?: string;
              supportedGenerationMethods?: string[];
            }>;
          };
          const discovered = (data.models || [])
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
                !/(embedding|imagen|veo|tts|audio|live|aqa|robotics|computer-use|vision-001|001$)/i.test(
                  id
                )
            );

          if (discovered.length > 0) {
            const unique = Array.from(new Set(discovered));
            unique.sort((a, b) => {
              const ia = PREFERRED_GEMINI_ORDER.indexOf(a);
              const ib = PREFERRED_GEMINI_ORDER.indexOf(b);
              if (ia !== -1 && ib !== -1) return ia - ib;
              if (ia !== -1) return -1;
              if (ib !== -1) return 1;
              return b.localeCompare(a);
            });
            geminiModels = unique.slice(0, 10).map((id) => ({
              id,
              name: id,
              provider: 'gemini',
              providerFormat: 'cloud',
              isLoaded: true,
              badgeText: badgeForGemini(id),
            }));
            geminiLiveVerified = true;
          }
        } catch {
          // keep defaults
        } finally {
          clearTimeout(timer);
        }
      })()
    );
  }

  // 2. Live discover currently available OpenRouter :free models
  tasks.push(
    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const r = await fetch('https://openrouter.ai/api/v1/models', {
          signal: controller.signal,
        });
        if (!r.ok) return;
        const data = (await r.json()) as {
          data?: Array<{ id?: string; name?: string }>;
        };
        const liveFree = (data.data || [])
          .map((m) => m.id || '')
          .filter((id) => id === 'openrouter/free' || id.endsWith(':free'));

        if (liveFree.length > 0) {
          const prioritized = [
            'openrouter/free',
            'google/gemma-4-31b-it:free',
            'google/gemma-4-26b-a4b-it:free',
            'nvidia/nemotron-3.5-lightning:free',
            'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
            'cohere/north-mini-code:free',
          ];
          const sorted = Array.from(new Set(liveFree)).sort((a, b) => {
            const ia = prioritized.indexOf(a);
            const ib = prioritized.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return a.localeCompare(b);
          });

          openRouterModels = sorted.slice(0, 10).map((id) => ({
            id,
            name: id,
            provider: 'openrouter',
            providerFormat: 'cloud',
            isLoaded: true,
            badgeText:
              id === 'openrouter/free'
                ? 'Auto Router'
                : id.includes('code')
                ? 'Coder Free'
                : id.includes('reason')
                ? 'Reasoning Free'
                : 'Live Free',
          }));
          openRouterLiveVerified = true;
        }
      } catch {
        // keep defaults
      } finally {
        clearTimeout(timer);
      }
    })()
  );

  await Promise.allSettled(tasks);

  return new Response(
    JSON.stringify({
      ok: true,
      geminiConfigured: Boolean(geminiKey && geminiKey !== 'MY_GEMINI_API_KEY'),
      openRouterConfigured: Boolean(openRouterKey),
      geminiLiveVerified,
      openRouterLiveVerified,
      models: [...geminiModels, ...openRouterModels],
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120, s-maxage=300',
      },
    }
  );
}
