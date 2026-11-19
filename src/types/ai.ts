export type ProviderType = 'local' | 'openrouter' | 'gemini';
export type ThemeMode = 'vanilla' | 'white' | 'dark';

export interface DetectedModel {
  id: string;
  name: string;
  provider: ProviderType;
  providerFormat?: 'ollama' | 'lm-studio' | 'openai-compatible' | 'cloud';
  isLoaded?: boolean;
  parameterSize?: string;
  quantization?: string;
  sizeBytes?: number;
  family?: string;
  badgeText?: string;
}

export interface AttachmentItem {
  id: string;
  name: string;
  type: 'image' | 'document' | 'spreadsheet' | 'code';
  mimeType: string;
  content: string; // Base64 data URL for images, extracted Markdown/text for docs
  sizeLabel: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  time: number;
  model?: string;
  provider?: ProviderType;
  images?: string[];
  attachments?: Array<{ name: string; type: string; sizeLabel: string }>;
}

export interface ChatFolder {
  id: string;
  name: string;
  isOpen: boolean;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  created: number;
  updated: number;
  pinned?: boolean;
  folderId?: string;
}

export interface RoleItem {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'coding' | 'analysis' | 'security' | 'custom';
  temperature: number;
  systemPrompt: string;
}

export interface EngineParameters {
  serverUrl: string;
  apiKey: string;
  openRouterApiKey: string;
  autoLoadVram: boolean;
  temperature: number;
  maxTokens: number; // -1 for Auto
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  contextWindow: number;
  stream: boolean;
  markdown: boolean;
  autoScroll: boolean;
  showTimestamps: boolean;
}

export interface CodeArtifact {
  title: string;
  language: string;
  code: string;
}

export const DEFAULT_ROLES: RoleItem[] = [
  {
    id: 'role_blackeye',
    name: 'BlackEYE (Full-Stack & Security)',
    description:
      "Kelvin's AI — Full-Stack Dev, AI Engineering, Security, Finance, SEO, Digital Marketing & Business Expert",
    category: 'security',
    temperature: 0.7,
    systemPrompt: `You are BlackEYE, Kelvin's AI. Expert in Full-Stack Dev (backend/frontend), AI Engineering, Hacking, Cracking, Reverse Engineering, Financial Analysis, Financial Planning, Search Engine Optimization, Digital Marketing, and Businnes Expert.
Rules:
1. Facts, data, and logic only. State clearly when info is missing; never fabricate.
2. Strictly rational and objective. Do not blindly agree—challenge flawed code, logic, or financial assumptions directly and give better alternatives.
3. Direct, concise, high-signal. No filler, pleasantries, or disclaimers.
4. Reply in the user's language.`,
  },
  {
    id: 'role_antislop',
    name: 'Anti-Slop UI & Visual Architect',
    description: 'Spesialis UI/UX kelas produksi dengan standar disiplin anti-AI slop & clean minimalism',
    category: 'coding',
    temperature: 0.2,
    systemPrompt: `You are an elite Frontend & UI/UX Architect following the Anti-Slop Design Constitution.
Rules:
1. Never use generic blue-to-purple gradients, excessive glassmorphism, or decorative emoji in UI code.
2. Enforce deliberate typography, tabular numerals for data, high-contrast surfaces, and functional controls.
3. Write clean, modular TypeScript, React, or HTML/CSS code ready for production deployment.`,
  },
  {
    id: 'role_general',
    name: 'Asisten Riset & Analisis Lokal',
    description: 'Asisten serbaguna untuk merangkum dokumen, spreadsheet, dan tanya jawab teknis',
    category: 'general',
    temperature: 0.6,
    systemPrompt: `Anda adalah asisten AI lokal yang objektif, terstruktur, dan ringkas. Gunakan format Markdown, tabel, atau blok kode yang rapi saat menjelaskan konsep teknis maupun data.`,
  },
];

export const DEFAULT_FOLDERS: ChatFolder[] = [
  { id: 'folder_general', name: 'Diskusi Umum', isOpen: true },
  { id: 'folder_dev', name: 'Arsitektur & Dev', isOpen: true },
];

export const DEFAULT_CLOUD_MODELS: DetectedModel[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'gemini-2.5-flash',
    provider: 'gemini',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Gemini 2.5 Flash',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'gemini-2.5-pro',
    provider: 'gemini',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Gemini 2.5 Pro',
  },
  {
    id: 'gemini-4-hydrogen',
    name: 'gemini-4-hydrogen',
    provider: 'gemini',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Cloud Ready',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'gemini-3.1-flash-lite',
    provider: 'gemini',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Fast Lite',
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'deepseek/deepseek-r1:free',
    provider: 'openrouter',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Reasoning Cloud',
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'qwen/qwen-2.5-coder-32b-instruct:free',
    provider: 'openrouter',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Coder Cloud',
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'google/gemma-3-27b-it:free',
    provider: 'openrouter',
    providerFormat: 'cloud',
    isLoaded: true,
    badgeText: 'Gemma 3 Cloud',
  },
];

export const INITIAL_DEMO_THREADS: ChatThread[] = [];

