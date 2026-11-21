import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  ChevronDown,
  BookOpen,
  Sliders,
  Plus,
  Globe,
  Mic,
  Send,
  Square,
  ArrowDown,
  Copy,
  Check,
  RotateCcw,
  Edit3,
  Trash2,
  Paperclip,
  Camera,
  Code2,
  FileSpreadsheet,
  X,
  Brain,
  Download,
  ExternalLink,
} from 'lucide-react';
import {
  AttachmentItem,
  ChatFolder,
  ChatMessage,
  ChatThread,
  CodeArtifact,
  DEFAULT_CLOUD_MODELS,
  DEFAULT_FOLDERS,
  DEFAULT_ROLES,
  DetectedModel,
  EngineParameters,
  INITIAL_DEMO_THREADS,
  ProviderType,
  RoleItem,
  ThemeMode,
} from './types/ai';
import {
  compressImageFile,
  estimateTokens,
  parseRoleMarkdown,
  parseUploadedFile,
  truncateMessagesByBudget,
} from './utils/documentParser';
import { RichMessageContent, extractCodeArtifact } from './components/RichMessageContent';
import {
  LiveCameraModal,
  ModelPickerPopover,
  RoleLibraryModal,
  ServerAndParamsModal,
} from './components/Modals';
import { SidebarHistory } from './components/SidebarHistory';
import { exportStandaloneAiHtml } from './utils/standaloneHtmlExporter';

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
  length: number;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
}
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function App() {
  // 1. Theme State (Vanilla Beige, Light White, Dark Mode)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('lms_theme');
    if (saved === 'vanilla' || saved === 'white' || saved === 'dark') return saved;
    if (saved === 'light') return 'vanilla';
    return 'vanilla';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('lms_theme', theme);
  }, [theme]);

  // 2. Engine & Server Parameters (Compatible with original ai.html localStorage keys)
  const [params, setParams] = useState<EngineParameters>(() => {
    const savedServer = localStorage.getItem('lms_server') || 'https://api.vinns.my.id';
    const savedKey = localStorage.getItem('lms_apikey') || '';
    const savedOrKey = localStorage.getItem('lms_openrouter_key') || '';
    const savedAutoFallback = localStorage.getItem('vinns_autofallback');
    return {
      serverUrl: savedServer,
      apiKey: savedKey,
      openRouterApiKey: savedOrKey,
      autoLoadVram: true,
      autoFallback: savedAutoFallback === null ? true : savedAutoFallback === 'true',
      temperature: 0.7,
      maxTokens: -1,
      topP: 0.95,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      contextWindow: 4096,
      stream: true,
      markdown: true,
      autoScroll: true,
      showTimestamps: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('lms_server', params.serverUrl);
    localStorage.setItem('lms_apikey', params.apiKey);
    localStorage.setItem('lms_openrouter_key', params.openRouterApiKey);
    localStorage.setItem('vinns_autofallback', String(params.autoFallback));
  }, [params.serverUrl, params.apiKey, params.openRouterApiKey, params.autoFallback]);

  // 3. Roles & System Prompt
  const [roles, setRoles] = useState<RoleItem[]>(() => {
    try {
      const saved = localStorage.getItem('vinns_roles');
      if (saved) {
        const parsed = JSON.parse(saved) as RoleItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed
            .filter((r) => r.id !== 'role_pricing_arch')
            .map((r) => (r.id === 'role_blackeye' ? DEFAULT_ROLES[0] : r));
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_ROLES;
  });

  const [activeRoleId, setActiveRoleId] = useState<string>(() => {
    const savedId = localStorage.getItem('vinns_active_role');
    if (!savedId || savedId === 'role_pricing_arch') {
      return DEFAULT_ROLES[0].id;
    }
    return savedId;
  });

  const activeRole = roles.find((r) => r.id === activeRoleId) || DEFAULT_ROLES[0];
  const [systemPrompt, setSystemPrompt] = useState<string>(() => activeRole.systemPrompt);

  useEffect(() => {
    localStorage.setItem('vinns_roles', JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    localStorage.setItem('vinns_active_role', activeRoleId);
  }, [activeRoleId]);

  // 4. Folders & Chat Threads (Migrates existing lms_chats from ai.html if present, starts empty for new user)
  const [folders, setFolders] = useState<ChatFolder[]>(() => {
    try {
      const saved = localStorage.getItem('vinns_folders');
      if (saved) {
        const parsed = JSON.parse(saved) as ChatFolder[];
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((f) => f.id !== 'folder_pricing');
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_FOLDERS;
  });

  const [threads, setThreads] = useState<ChatThread[]>(() => {
    try {
      const saved = localStorage.getItem('lms_chats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const realChats = parsed.filter(
            (c: Partial<ChatThread>) =>
              c.id !== 'chat_demo_sqli' && c.id !== 'chat_demo_general'
          );
          return realChats.map((c: Partial<ChatThread>, idx: number) => ({
            id: c.id || `chat_${Date.now()}_${idx}`,
            title: c.title || 'Percakapan Baru',
            created: c.created || Date.now(),
            updated: c.updated || c.created || Date.now(),
            pinned: Boolean(c.pinned),
            folderId:
              c.folderId && c.folderId !== 'folder_pricing'
                ? c.folderId
                : DEFAULT_FOLDERS[0].id,
            messages: Array.isArray(c.messages)
              ? c.messages.map((m, mIdx) => ({
                  id: m.id || `msg_${idx}_${mIdx}`,
                  role: m.role || 'user',
                  content: m.content || '',
                  reasoning: m.reasoning,
                  time: m.time || Date.now(),
                  model: m.model,
                  provider: m.provider,
                  images: m.images,
                  attachments: m.attachments,
                }))
              : [],
          }));
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_DEMO_THREADS;
  });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    return threads[0]?.id || null;
  });

  useEffect(() => {
    try {
      const toSave = threads.slice(0, 50).map((t) => ({
        ...t,
        messages: t.messages.slice(-100),
      }));
      localStorage.setItem('lms_chats', JSON.stringify(toSave));
    } catch {
      // ignore quota error
    }
  }, [threads]);

  useEffect(() => {
    localStorage.setItem('vinns_folders', JSON.stringify(folders));
  }, [folders]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const activeMessages = activeThread?.messages || [];

  // 5. Models & Provider State
  const [activeProvider, setActiveProvider] = useState<ProviderType>('local');
  const [localModels, setLocalModels] = useState<DetectedModel[]>([
    {
      id: 'google/gemma-4-e4b',
      name: 'google/gemma-4-e4b',
      provider: 'local',
      providerFormat: 'openai-compatible',
      isLoaded: true,
      badgeText: 'VRAM Aktif',
    },
    {
      id: 'qwen/qwen3.5-9b',
      name: 'qwen/qwen3.5-9b',
      provider: 'local',
      providerFormat: 'openai-compatible',
      isLoaded: true,
      badgeText: 'VRAM Aktif',
    },
    {
      id: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
      name: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
      provider: 'local',
      providerFormat: 'openai-compatible',
      isLoaded: true,
      badgeText: 'VRAM Aktif',
    },
    {
      id: 'text-embedding-nomic-embed-text-v1.5',
      name: 'text-embedding-nomic-embed-text-v1.5',
      provider: 'local',
      providerFormat: 'openai-compatible',
      isLoaded: false,
      badgeText: 'Local Server',
    },
  ]);
  const [localFormat, setLocalFormat] = useState<string>('openai-compatible');
  const [cloudModels, setCloudModels] = useState<DetectedModel[]>(DEFAULT_CLOUD_MODELS);
  const [activeModel, setActiveModel] = useState<string>('qwen/qwen3.5-9b');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isScanningCloud, setIsScanningCloud] = useState<boolean>(false);
  const [isLoadingVram, setIsLoadingVram] = useState<string | null>(null);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<{
    online: boolean;
    latencyMs?: number;
    error?: string;
  }>({ online: false });
  // Cooldown tracker for models that recently hit 429/timeout (modelId -> expiry timestamp ms)
  const modelCooldownRef = useRef<Record<string, number>>({});

  // 6. UI Layout & Modal States
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => window.innerWidth >= 1024);
  const [modelPickerOpen, setModelPickerOpen] = useState<boolean>(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState<boolean>(false);
  const [roleModalOpen, setRoleModalOpen] = useState<boolean>(false);
  const [serverModalOpen, setServerModalOpen] = useState<boolean>(false);
  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState<boolean>(false);
  const [activeArtifact, setActiveArtifact] = useState<CodeArtifact | null>(null);

  // 7. Input, Multimodal & Streaming State
  const [userInput, setUserInput] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);
  const [deepReasoningEnabled, setDeepReasoningEnabled] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);

  // Voice-to-Text
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [voiceLang, setVoiceLang] = useState<'id-ID' | 'en-US'>('id-ID');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Refs
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const userScrolledUpRef = useRef<boolean>(false);

  // Toast Notifications
  const [toasts, setToasts] = useState<
    Array<{ id: string; type: 'success' | 'error'; message: string }>
  >([]);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  // ============================================================
  // SERVER DETECTION (Client direct + Backend Auto-Rescue Proxy)
  // ============================================================
  const scanLocalServer = useCallback(
    async (silent = false) => {
      setIsScanning(true);
      const startMs = Date.now();
      const cleanUrl = params.serverUrl.trim().replace(/\/+$/, '');

      try {
        // 1. Try Backend Auto-Rescue Proxy first (probes Ollama /api/tags, /api/ps, LM Studio /api/v0/models, and /v1/models)
        const proxyRes = await fetch(
          `/api/local/detect?endpoint=${encodeURIComponent(cleanUrl)}&apiKey=${encodeURIComponent(
            params.apiKey
          )}`
        );

        if (proxyRes.ok) {
          const data = await proxyRes.json();
          if (data.ok && Array.isArray(data.models) && data.models.length > 0) {
            const mapped: DetectedModel[] = data.models.map(
              (m: {
                id: string;
                name?: string;
                providerFormat?: 'ollama' | 'lm-studio' | 'openai-compatible';
                isLoaded?: boolean;
                parameterSize?: string;
                quantization?: string;
              }) => ({
                id: m.id,
                name: m.name || m.id,
                provider: 'local',
                providerFormat: m.providerFormat || data.providerFormat || 'openai-compatible',
                isLoaded: Boolean(m.isLoaded),
                parameterSize: m.parameterSize,
                quantization: m.quantization,
                badgeText: m.isLoaded ? 'VRAM Aktif' : 'Local Server',
              })
            );
            setLocalModels(mapped);
            setLocalFormat(data.providerFormat || 'openai-compatible');
            setActiveModel((prev) =>
              mapped.some((x) => x.id === prev) ? prev : mapped[0].id
            );
            setServerStatus({ online: true, latencyMs: data.latencyMs || Date.now() - startMs });
            if (!silent) showToast('success', `Terhubung ke ${cleanUrl} (${mapped.length} model)`);
            setIsScanning(false);
            return;
          }
        }

        // 2. Fallback: Direct client-side browser fetch (when user accesses LAN IP directly)
        const headers: Record<string, string> = {};
        if (params.apiKey) headers['Authorization'] = `Bearer ${params.apiKey}`;
        const directRes = await fetch(`${cleanUrl}/v1/models`, {
          headers,
          signal: AbortSignal.timeout(4500),
        });
        if (!directRes.ok) throw new Error(`HTTP ${directRes.status}`);
        const directData = await directRes.json();
        const rawList = Array.isArray(directData.data) ? directData.data : [];
        if (rawList.length > 0) {
          const mapped: DetectedModel[] = rawList.map((m: { id: string }) => {
            const isEmbed = /embed|nomic/i.test(m.id);
            return {
              id: m.id,
              name: m.id,
              provider: 'local',
              providerFormat: 'openai-compatible',
              isLoaded: !isEmbed,
              badgeText: !isEmbed ? 'VRAM Aktif' : 'Local Server',
            };
          });
          setLocalModels(mapped);
          setLocalFormat('openai-compatible');
          setActiveModel((prev) => (mapped.some((x) => x.id === prev) ? prev : mapped[0].id));
          setServerStatus({ online: true, latencyMs: Date.now() - startMs });
          if (!silent) showToast('success', `Terhubung langsung ke ${cleanUrl}`);
          setIsScanning(false);
          return;
        }
        throw new Error('Tidak ada model ditemukan');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Koneksi gagal';
        setServerStatus({
          online: false,
          error: `Tidak dapat menjangkau ${cleanUrl} (${msg}). Pastikan server lokal / Cloudflare Tunnel aktif.`,
        });
        if (!silent) {
          showToast('error', `Server ${cleanUrl} sedang offline`);
        }
      } finally {
        setIsScanning(false);
      }
    },
    [params.serverUrl, params.apiKey, showToast]
  );

  const scanCloudModels = useCallback(
    async (silent = false) => {
      setIsScanningCloud(true);
      try {
        const res = await fetch('/api/cloud/models');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.models) && data.models.length > 0) {
          setCloudModels(data.models);
          if (!silent) {
            showToast('success', `Daftar model Cloud diperbarui (${data.models.length} model aktif)`);
          }
        }
      } catch {
        if (!silent) {
          showToast('error', 'Gagal menyegarkan daftar model Cloud, menggunakan daftar bawaan');
        }
      } finally {
        setIsScanningCloud(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    scanLocalServer(true);
    scanCloudModels(true);
  }, []);

  // Select Model & Auto-Load VRAM if local
  const handleSelectModel = async (model: DetectedModel) => {
    setActiveProvider(model.provider);
    setActiveModel(model.id);
    setModelPickerOpen(false);

    if (model.provider === 'local' && params.autoLoadVram && !model.isLoaded) {
      setIsLoadingVram(model.id);
      try {
        const res = await fetch('/api/local/load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: params.serverUrl,
            apiKey: params.apiKey,
            modelId: model.id,
            providerFormat: model.providerFormat || localFormat,
          }),
        });
        if (res.ok) {
          setLocalModels((prev) =>
            prev.map((m) =>
              m.id === model.id ? { ...m, isLoaded: true, badgeText: 'VRAM Aktif' } : m
            )
          );
          showToast('success', `Model ${model.id} aktif di VRAM`);
        }
      } catch {
        // ignore preload error
      } finally {
        setIsLoadingVram(null);
      }
    }
  };

  const handlePullOllamaModel = async (modelName: string) => {
    setIsPulling(true);
    try {
      const res = await fetch('/api/local/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: params.serverUrl,
          apiKey: params.apiKey,
          modelName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Gagal menarik model');
      }
      showToast('success', `Model ${modelName} berhasil diunduh!`);
      await scanLocalServer(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menarik model';
      showToast('error', msg);
    } finally {
      setIsPulling(false);
    }
  };

  // ============================================================
  // SCROLL MANAGEMENT
  // ============================================================
  const scrollToBottom = useCallback((smooth = true) => {
    const el = chatScrollRef.current;
    if (!el) return;
    userScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isUp = distanceFromBottom > 140;
    userScrolledUpRef.current = isUp;
    setShowScrollBottomBtn(isUp);
  };

  // ============================================================
  // THREAD & FOLDER CRUD
  // ============================================================
  const handleNewChat = (folderId?: string) => {
    const id = `chat_${Date.now()}`;
    const targetFolderId = folderId || folders[0]?.id;
    const newThread: ChatThread = {
      id,
      title: 'Percakapan Baru',
      messages: [],
      created: Date.now(),
      updated: Date.now(),
      pinned: false,
      folderId: targetFolderId,
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(id);
    if (window.innerWidth < 1024) setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleDeleteThread = (id: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeThreadId === id) {
        setActiveThreadId(next[0]?.id || null);
      }
      return next;
    });
  };

  const handleBatchDeleteThreads = (ids: string[]) => {
    setThreads((prev) => {
      const next = prev.filter((t) => !ids.includes(t.id));
      if (activeThreadId && ids.includes(activeThreadId)) {
        setActiveThreadId(next[0]?.id || null);
      }
      return next;
    });
    showToast('success', `${ids.length} percakapan dihapus`);
  };

  const handleTogglePinThread = (id: string) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
  };

  const handleRenameThread = (id: string, newTitle: string) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t)));
  };

  const handleMoveThreadToFolder = (threadId: string, folderId?: string) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, folderId } : t))
    );
    showToast('success', 'Percakapan dipindahkan ke folder');
  };

  const handleToggleFolder = (folderId: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, isOpen: !f.isOpen } : f))
    );
  };

  const handleCreateFolder = (name: string) => {
    const newF: ChatFolder = {
      id: `folder_${Date.now()}`,
      name,
      isOpen: true,
    };
    setFolders((prev) => [...prev, newF]);
    showToast('success', `Folder "${name}" dibuat`);
  };

  const handleDeleteFolder = (folderId: string) => {
    const fallbackId = folders.find((f) => f.id !== folderId)?.id;
    setThreads((prev) =>
      prev.map((t) => (t.folderId === folderId ? { ...t, folderId: fallbackId } : t))
    );
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
  };

  // ============================================================
  // MULTIMODAL FILE UPLOAD & CLIPBOARD PASTE
  // ============================================================
  const handleFilesSelected = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const file of arr) {
      try {
        const parsed = await parseUploadedFile(file);
        setAttachments((prev) => [...prev, parsed]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal membaca file';
        showToast('error', `${file.name}: ${msg}`);
      }
    }
  };

  const handlePasteClipboard = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      for (const imgFile of imageFiles) {
        const compressed = await compressImageFile(imgFile);
        setAttachments((prev) => [
          ...prev,
          {
            id: `paste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: `Clipboard_${new Date().toLocaleTimeString()}.jpg`,
            type: 'image',
            mimeType: 'image/jpeg',
            content: compressed,
            sizeLabel: 'Gambar',
          },
        ]);
      }
      showToast('success', 'Gambar dari clipboard berhasil dilampirkan');
    }
  };

  // ============================================================
  // VOICE-TO-TEXT (Web Speech API id-ID & en-US)
  // ============================================================
  const toggleVoiceRecording = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast('error', 'Voice input tidak didukung di browser ini');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = voiceLang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setUserInput((prev) => {
        const base = prev ? prev.replace(/\s*\[⏳.*\]$/, '') : '';
        return (base ? base + ' ' : '') + transcript.trim();
      });
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // ============================================================
  // SEND MESSAGE & 120FPS STREAMING ENGINE WITH SMART AUTO-FALLBACK
  // ============================================================
  const streamAiCompletion = async (
    threadId: string,
    conversationHistory: ChatMessage[],
    assistantMsgId: string
  ) => {
    setIsStreaming(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Defensively infer true provider from activeModel so tab switches or stale state never route Cloud models to Local server
    const resolveEffectiveProvider = (): ProviderType => {
      const m = (activeModel || '').trim();
      if (/^(gemini-|gemma-3-)/i.test(m)) return 'gemini';
      if (m === 'openrouter/free' || /:free$/i.test(m)) return 'openrouter';
      if (cloudModels.some((cm) => cm.id === m && cm.provider === 'gemini')) return 'gemini';
      if (cloudModels.some((cm) => cm.id === m && cm.provider === 'openrouter')) return 'openrouter';
      return activeProvider;
    };

    const effectiveProvider = resolveEffectiveProvider();

    // Active cooldown list (models that recently hit 429/timeout within the last 60s)
    const now = Date.now();
    const activeCooldownModels = Object.entries(modelCooldownRef.current)
      .filter(([, expiresAt]) => expiresAt > now)
      .map(([id]) => id);

    const markModelCooldown = (modelId: string, durationMs = 60000) => {
      if (modelId) {
        modelCooldownRef.current[modelId] = Date.now() + durationMs;
      }
    };

    // 120fps requestAnimationFrame typewriter state
    let targetText = '';
    let displayedText = '';
    let targetReasoning = '';
    let streamFinished = false;
    let rafId: number | null = null;
    let resolvedModelName = activeModel;
    let resolvedProvider: ProviderType = effectiveProvider;
    let resolvedFallbackNote = '';

    const updateAssistantInThread = (
      content: string,
      reasoning?: string,
      metaOverride?: { model?: string; provider?: ProviderType; fallbackNote?: string }
    ) => {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          return {
            ...t,
            updated: Date.now(),
            messages: t.messages.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content,
                    reasoning: reasoning || m.reasoning,
                    model: metaOverride?.model || resolvedModelName || m.model,
                    provider: metaOverride?.provider || resolvedProvider || m.provider,
                    fallbackNote:
                      metaOverride?.fallbackNote !== undefined
                        ? metaOverride.fallbackNote
                        : resolvedFallbackNote || m.fallbackNote,
                  }
                : m
            ),
          };
        })
      );
    };

    const tickTypewriter = () => {
      if (displayedText.length < targetText.length) {
        const backlog = targetText.length - displayedText.length;
        const step = Math.max(2, Math.min(56, Math.ceil(backlog * 0.3)));
        displayedText = targetText.slice(0, displayedText.length + step);
        updateAssistantInThread(displayedText, targetReasoning);

        if (params.autoScroll && !userScrolledUpRef.current) {
          const el = chatScrollRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        }
      } else if (targetReasoning) {
        updateAssistantInThread(displayedText, targetReasoning);
      }

      if (!streamFinished || displayedText.length < targetText.length) {
        rafId = requestAnimationFrame(tickTypewriter);
      }
    };

    rafId = requestAnimationFrame(tickTypewriter);

    try {
      // Build effective System Prompt with active tools
      let effectiveSystemPrompt = systemPrompt.trim();
      if (deepReasoningEnabled) {
        effectiveSystemPrompt +=
          '\n\n[DEEP REASONING MODE]: Analisis masalah ini secara mendalam langkah demi langkah sebelum memberikan kesimpulan akhir.';
      }

      // Context Window Budgeting
      const budgetedHistory = truncateMessagesByBudget(
        conversationHistory,
        effectiveSystemPrompt,
        params.contextWindow
      );

      // Helper to consume an SSE stream with client-side first-token stall watchdog
      const consumeCloudSseStream = async (res: Response, stallTimeoutMs = 24000) => {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) return;

        let lineBuffer = '';
        let receivedAnyContent = false;
        let stallAborted = false;

        const stallTimer = setTimeout(() => {
          if (!receivedAnyContent) {
            stallAborted = true;
            reader.cancel().catch(() => {});
          }
        }, stallTimeoutMs);

        const processSseLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) return;
          const raw = trimmed.slice(5).trim();
          if (!raw || raw === '[DONE]') return;

          let parsed: {
            error?: string | { message?: string };
            meta?: {
              activeModel?: string;
              activeProvider?: ProviderType;
              switched?: boolean;
              fromModel?: string;
              reason?: string;
            };
            choices?: Array<{
              delta?: { content?: string; reasoning_content?: string };
            }>;
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string; thought?: boolean }> };
            }>;
          } | null = null;

          try {
            parsed = JSON.parse(raw);
          } catch {
            return;
          }

          if (parsed?.meta) {
            if (parsed.meta.activeModel) {
              resolvedModelName = parsed.meta.activeModel;
            }
            if (parsed.meta.activeProvider) {
              resolvedProvider = parsed.meta.activeProvider;
            }
            if (parsed.meta.switched && parsed.meta.activeModel) {
              if (parsed.meta.fromModel) {
                markModelCooldown(parsed.meta.fromModel, 60000);
              }
              const note = `Auto-Fallback → ${parsed.meta.activeModel}${
                parsed.meta.reason ? ` (${parsed.meta.reason})` : ''
              }`;
              resolvedFallbackNote = note;
              showToast('success', note);
              updateAssistantInThread(displayedText, targetReasoning, {
                model: resolvedModelName,
                provider: resolvedProvider,
                fallbackNote: note,
              });
            }
          }

          if (parsed?.error) {
            const errMsg =
              typeof parsed.error === 'string'
                ? parsed.error
                : parsed.error.message || JSON.stringify(parsed.error);
            throw new Error(errMsg);
          }

          const delta = parsed?.choices?.[0]?.delta;
          if (delta?.reasoning_content) {
            receivedAnyContent = true;
            clearTimeout(stallTimer);
            targetReasoning += delta.reasoning_content;
          }
          if (delta?.content) {
            receivedAnyContent = true;
            clearTimeout(stallTimer);
            targetText += delta.content;
          }

          const parts = parsed?.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            for (const part of parts) {
              if (part?.thought && part?.text) {
                receivedAnyContent = true;
                clearTimeout(stallTimer);
                targetReasoning += part.text;
              } else if (part?.text) {
                receivedAnyContent = true;
                clearTimeout(stallTimer);
                targetText += part.text;
              }
            }
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split(/\r?\n/);
            lineBuffer = lines.pop() || '';
            for (const line of lines) {
              processSseLine(line);
            }
          }
          if (lineBuffer.trim()) {
            processSseLine(lineBuffer);
          }
        } finally {
          clearTimeout(stallTimer);
        }

        if (stallAborted) {
          throw new Error('Model tidak memberikan respons dalam batas waktu (Timeout)');
        }
      };

      // Helper: Execute Gemini Cloud stream (/api/gemini/stream)
      const executeGeminiStream = async (modelId: string) => {
        const res = await fetch('/api/gemini/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelId || 'gemini-2.5-flash',
            systemPrompt: effectiveSystemPrompt,
            webSearch: webSearchEnabled,
            deepReasoning: deepReasoningEnabled,
            temperature: params.temperature,
            autoFallback: params.autoFallback,
            openRouterApiKey: params.openRouterApiKey,
            skipModels: activeCooldownModels,
            messages: budgetedHistory.map((m) => ({
              role: m.role,
              content: m.content,
              images: m.images,
            })),
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(errData.error || `Gemini API Error (${res.status})`);
        }

        await consumeCloudSseStream(res);
        if (!targetText.trim() && !targetReasoning.trim()) {
          throw new Error('Model tidak mengirimkan jawaban teks (Empty response)');
        }
      };

      // Helper: Execute OpenRouter Cloud stream (/api/openrouter/stream)
      const executeOpenRouterStream = async (modelId: string) => {
        const apiMessages: Array<Record<string, unknown>> = [];
        if (effectiveSystemPrompt) {
          apiMessages.push({ role: 'system', content: effectiveSystemPrompt });
        }

        budgetedHistory.forEach((m) => {
          if (m.images && m.images.length > 0) {
            const contentArr: Array<Record<string, unknown>> = [
              { type: 'text', text: m.content || 'Tolong jelaskan gambar ini.' },
            ];
            m.images.forEach((imgUrl) => {
              contentArr.push({ type: 'image_url', image_url: { url: imgUrl } });
            });
            apiMessages.push({ role: m.role, content: contentArr });
          } else {
            apiMessages.push({ role: m.role, content: m.content });
          }
        });

        const payload: Record<string, unknown> = {
          model: modelId,
          messages: apiMessages,
          temperature: params.temperature,
          top_p: params.topP,
          frequency_penalty: params.frequencyPenalty,
          presence_penalty: params.presencePenalty,
          stream: true,
        };

        if (params.maxTokens !== -1 && params.maxTokens > 0) {
          payload.max_tokens = params.maxTokens;
        }

        const res = await fetch('/api/openrouter/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: params.openRouterApiKey,
            payload,
            systemPrompt: effectiveSystemPrompt,
            deepReasoning: deepReasoningEnabled,
            autoFallback: params.autoFallback,
            skipModels: activeCooldownModels,
            messages: budgetedHistory.map((m) => ({
              role: m.role,
              content: m.content,
              images: m.images,
            })),
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(errData.error || `Cloud AI Error (${res.status})`);
        }

        await consumeCloudSseStream(res);
        if (!targetText.trim() && !targetReasoning.trim()) {
          throw new Error('Model tidak mengirimkan jawaban teks (Empty response)');
        }
      };

      // Helper: Execute Local LM stream (LM Studio / Ollama / Cloudflare Tunnel)
      const executeLocalStream = async (modelId: string) => {
        const apiMessages: Array<Record<string, unknown>> = [];
        if (effectiveSystemPrompt) {
          apiMessages.push({ role: 'system', content: effectiveSystemPrompt });
        }

        budgetedHistory.forEach((m) => {
          if (m.images && m.images.length > 0) {
            const contentArr: Array<Record<string, unknown>> = [
              { type: 'text', text: m.content || 'Tolong jelaskan gambar ini.' },
            ];
            m.images.forEach((imgUrl) => {
              contentArr.push({ type: 'image_url', image_url: { url: imgUrl } });
            });
            apiMessages.push({ role: m.role, content: contentArr });
          } else {
            apiMessages.push({ role: m.role, content: m.content });
          }
        });

        const payload: Record<string, unknown> = {
          model: modelId,
          messages: apiMessages,
          temperature: params.temperature,
          top_p: params.topP,
          frequency_penalty: params.frequencyPenalty,
          presence_penalty: params.presencePenalty,
          stream: params.stream,
        };

        if (params.maxTokens !== -1 && params.maxTokens > 0) {
          payload.max_tokens = params.maxTokens;
        }

        const targetEndpoint = params.serverUrl.trim().replace(/\/+$/, '');
        const targetKey = params.apiKey;

        let res: Response | null = null;
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (targetKey) headers['Authorization'] = `Bearer ${targetKey}`;

          res = await fetch(`${targetEndpoint}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: abortController.signal,
          });

          if (!res.ok && res.status === 400 && 'max_tokens' in payload) {
            const retryPayload = { ...payload };
            delete retryPayload.max_tokens;
            res = await fetch(`${targetEndpoint}/v1/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify(retryPayload),
              signal: abortController.signal,
            });
          }
        } catch (directErr: unknown) {
          if (directErr instanceof Error && directErr.name === 'AbortError') {
            throw directErr;
          }
          res = await fetch('/api/local/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: targetEndpoint,
              apiKey: targetKey,
              payload,
            }),
            signal: abortController.signal,
          });
        }

        if (!res || !res.ok) {
          const errText = res ? await res.text() : 'No response';
          throw new Error(`API Error (${res?.status || 'Network'}): ${errText}`);
        }

        if (params.stream && res.body) {
          await consumeCloudSseStream(res, 35000);
        } else {
          const data = await res.json();
          targetText = data.choices?.[0]?.message?.content || '';
          targetReasoning = data.choices?.[0]?.message?.reasoning_content || '';
        }

        if (!targetText.trim() && !targetReasoning.trim()) {
          throw new Error('Server lokal tidak mengirimkan token jawaban.');
        }
      };

      // ============================================================
      // DISPATCH WITH CROSS-TIER AUTO-FALLBACK ORCHESTRATION
      // ============================================================
      if (effectiveProvider === 'gemini') {
        try {
          await executeGeminiStream(activeModel || 'gemini-2.5-flash');
        } catch (geminiErr: unknown) {
          if (geminiErr instanceof Error && geminiErr.name === 'AbortError') throw geminiErr;
          markModelCooldown(activeModel, 60000);

          if (params.autoFallback && serverStatus.online && localModels.length > 0) {
            // Ultimate Cross-Tier Failover: All Cloud APIs failed -> fallback to active Local LM!
            const localCandidate =
              localModels.find((m) => m.isLoaded && !/embed|nomic/i.test(m.id)) || localModels[0];
            if (localCandidate) {
              resolvedModelName = localCandidate.id;
              resolvedProvider = 'local';
              resolvedFallbackNote = `Auto-Failover ke Local LM (${localCandidate.id}) karena Cloud API tidak merespons`;
              showToast('success', resolvedFallbackNote);
              await executeLocalStream(localCandidate.id);
            } else {
              throw geminiErr;
            }
          } else {
            throw geminiErr;
          }
        }
      } else if (effectiveProvider === 'openrouter') {
        try {
          await executeOpenRouterStream(activeModel || 'openrouter/free');
        } catch (orErr: unknown) {
          if (orErr instanceof Error && orErr.name === 'AbortError') throw orErr;
          markModelCooldown(activeModel, 60000);

          if (params.autoFallback && serverStatus.online && localModels.length > 0) {
            const localCandidate =
              localModels.find((m) => m.isLoaded && !/embed|nomic/i.test(m.id)) || localModels[0];
            if (localCandidate) {
              resolvedModelName = localCandidate.id;
              resolvedProvider = 'local';
              resolvedFallbackNote = `Auto-Failover ke Local LM (${localCandidate.id}) karena Cloud API tidak merespons`;
              showToast('success', resolvedFallbackNote);
              await executeLocalStream(localCandidate.id);
            } else {
              throw orErr;
            }
          } else {
            throw orErr;
          }
        }
      } else {
        // LOCAL LM PROVIDER (with automatic Cloud Gemini Failover if PC/Cloudflare Tunnel is offline)
        try {
          await executeLocalStream(activeModel);
        } catch (localErr: unknown) {
          if (localErr instanceof Error && localErr.name === 'AbortError') throw localErr;
          if (params.autoFallback) {
            try {
              resolvedModelName = 'gemini-2.5-flash';
              resolvedProvider = 'gemini';
              resolvedFallbackNote = `Auto-Failover ke Cloud Gemini (Server lokal ${params.serverUrl} tidak merespons)`;
              showToast('success', 'Server lokal tidak merespons — beralih otomatis ke Cloud Gemini');
              await executeGeminiStream('gemini-2.5-flash');
            } catch {
              // If Cloud Gemini also fails, report original local error clearly
              throw localErr;
            }
          } else {
            throw localErr;
          }
        }
      }

      streamFinished = true;
      if (rafId) cancelAnimationFrame(rafId);
      updateAssistantInThread(targetText, targetReasoning, {
        model: resolvedModelName,
        provider: resolvedProvider,
        fallbackNote: resolvedFallbackNote || undefined,
      });
    } catch (err: unknown) {
      streamFinished = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (err instanceof Error && err.name === 'AbortError') {
        updateAssistantInThread(
          targetText + '\n\n*[Generasi dihentikan oleh pengguna]*',
          targetReasoning
        );
      } else {
        const errMsg = err instanceof Error ? err.message : 'Koneksi gagal';
        showToast('error', errMsg);
        const targetLabel =
          effectiveProvider === 'gemini'
            ? 'Google Gemini Cloud API (/api/gemini/stream)'
            : effectiveProvider === 'openrouter'
            ? 'Cloud AI Proxy (/api/openrouter/stream)'
            : params.serverUrl;
        updateAssistantInThread(
          `**Koneksi Terputus / Gagal**\n\nGagal terhubung ke \`${targetLabel}\`.\n\nDetail Error: \`${errMsg}\``,
          targetReasoning
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (overrideText?: string) => {
    const rawText = (overrideText !== undefined ? overrideText : userInput).trim();
    if (!rawText && attachments.length === 0) return;
    if (isStreaming) return;

    // Combine text with any non-image document/spreadsheet/code attachments
    const docAttachments = attachments.filter((a) => a.type !== 'image');
    const imageAttachments = attachments.filter((a) => a.type === 'image').map((a) => a.content);

    let fullUserContent = rawText;
    if (docAttachments.length > 0) {
      const docsBlock = docAttachments.map((d) => d.content).join('\n\n');
      fullUserContent = fullUserContent ? `${fullUserContent}\n\n${docsBlock}` : docsBlock;
    }

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: fullUserContent,
      time: Date.now(),
      images: imageAttachments.length > 0 ? imageAttachments : undefined,
      attachments: attachments.map((a) => ({
        name: a.name,
        type: a.type,
        sizeLabel: a.sizeLabel,
      })),
    };

    const assistantMsg: ChatMessage = {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: '',
      time: Date.now(),
      model: activeModel,
      provider: activeProvider,
    };

    setUserInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    let targetThreadId = activeThreadId;
    let updatedHistory: ChatMessage[] = [];

    if (!targetThreadId) {
      targetThreadId = `chat_${Date.now()}`;
      const newTitle = (rawText || attachments[0]?.name || 'Percakapan Baru').slice(0, 42);
      const newThread: ChatThread = {
        id: targetThreadId,
        title: newTitle,
        messages: [userMsg, assistantMsg],
        created: Date.now(),
        updated: Date.now(),
        folderId: folders[0]?.id,
      };
      updatedHistory = [userMsg];
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(targetThreadId);
    } else {
      const current = threads.find((t) => t.id === targetThreadId);
      updatedHistory = [...(current?.messages || []), userMsg];
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== targetThreadId) return t;
          const isFirstUser = t.messages.length === 0;
          const title = isFirstUser
            ? (rawText || attachments[0]?.name || t.title).slice(0, 42)
            : t.title;
          return {
            ...t,
            title,
            updated: Date.now(),
            messages: [...t.messages, userMsg, assistantMsg],
          };
        })
      );
    }

    setTimeout(() => scrollToBottom(true), 30);
    await streamAiCompletion(targetThreadId, updatedHistory, assistantMsg.id);
  };

  const handleStopStream = () => {
    abortControllerRef.current?.abort();
  };

  // ============================================================
  // MESSAGE ACTIONS (Copy, Edit, Retry, Delete)
  // ============================================================

  const handleDeleteMessage = (msgId: string) => {
    if (!activeThreadId) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThreadId
          ? { ...t, messages: t.messages.filter((m) => m.id !== msgId) }
          : t
      )
    );
  };

  const handleEditMessage = (msgIndex: number) => {
    if (!activeThread) return;
    const targetMsg = activeThread.messages[msgIndex];
    if (!targetMsg || targetMsg.role !== 'user') return;
    setUserInput(targetMsg.content);
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? { ...t, messages: t.messages.slice(0, msgIndex) }
          : t
      )
    );
    setTimeout(() => textareaRef.current?.focus(), 40);
  };

  const handleRegenerateFrom = async (msgIndex: number) => {
    if (!activeThread || isStreaming) return;
    const historyUpTo = activeThread.messages.slice(0, msgIndex);
    const assistantMsg: ChatMessage = {
      id: `msg_${Date.now()}_regen`,
      role: 'assistant',
      content: '',
      time: Date.now(),
      model: activeModel,
      provider: activeProvider,
    };

    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? { ...t, messages: [...historyUpTo, assistantMsg] }
          : t
      )
    );

    await streamAiCompletion(activeThread.id, historyUpTo, assistantMsg.id);
  };

  const handleExportChatsJson = () => {
    const data = JSON.stringify({ exported: new Date().toISOString(), chats: threads }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vinns-studio-chats-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Riwayat percakapan berhasil diekspor (JSON)');
  };

  const handleLoadRoleMdFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseRoleMarkdown(text, file.name);
      setSystemPrompt(parsed.systemPrompt);
      const newRole: RoleItem = {
        id: `role_${Date.now()}`,
        ...parsed,
      };
      setRoles((prev) => [newRole, ...prev]);
      setActiveRoleId(newRole.id);
      showToast('success', `Berhasil memuat role dari: ${file.name}`);
    } catch {
      showToast('error', 'Gagal membaca file .md');
    }
  };

  const approxInputTokens = estimateTokens(
    userInput,
    attachments.filter((a) => a.type === 'image').length
  );

  const currentModelObj =
    activeProvider === 'local'
      ? localModels.find((m) => m.id === activeModel)
      : DEFAULT_CLOUD_MODELS.find((m) => m.id === activeModel);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)] theme-surface">
      {/* Left Collapsible Sidebar */}
      <SidebarHistory
        isOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={(id) => {
          setActiveThreadId(id);
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onDeleteThread={handleDeleteThread}
        onBatchDeleteThreads={handleBatchDeleteThreads}
        onTogglePinThread={handleTogglePinThread}
        onRenameThread={handleRenameThread}
        onMoveThreadToFolder={handleMoveThreadToFolder}
        folders={folders}
        onToggleFolder={handleToggleFolder}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        theme={theme}
        onChangeTheme={setTheme}
        serverOnline={serverStatus.online}
        onOpenServerModal={() => setServerModalOpen(true)}
        onExportChatsJson={handleExportChatsJson}
      />

      {/* Main Content Area — Full-Width Unboxed Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[var(--bg-surface)] theme-surface">
        {/* Unified Responsive Top Header Bar with Dropdown Menu */}
        <header className="h-10.5 sm:h-12 px-2 sm:px-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-2 shrink-0 z-20 theme-surface">
          {/* Left: Sidebar Hamburger + Model & Provider Picker */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle Sidebar (Ctrl+B)"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] flex items-center justify-center hover:border-[var(--border-strong)] btn-tactile cursor-pointer shrink-0"
            >
              <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Unified Floating Model & Provider Picker */}
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setModelPickerOpen((v) => !v)}
                className={`h-7 sm:h-8 px-2 sm:px-3 rounded-md border flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono font-semibold btn-tactile cursor-pointer max-w-full ${
                  modelPickerOpen
                    ? 'border-[var(--text-primary)] bg-[var(--bg-muted)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-muted)]/60 hover:border-[var(--border-strong)]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-xs shrink-0 ${
                    activeProvider === 'local'
                      ? currentModelObj?.isLoaded
                        ? 'bg-emerald-600'
                        : 'bg-[var(--accent)]'
                      : 'bg-[var(--accent)]'
                  }`}
                />
                <span className="truncate max-w-[145px] xs:max-w-[190px] sm:max-w-[280px] text-[var(--text-primary)]">
                  {activeModel || 'Pilih Model'}
                </span>
                <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--text-secondary)] shrink-0" />
              </button>

              <ModelPickerPopover
                isOpen={modelPickerOpen}
                onClose={() => setModelPickerOpen(false)}
                activeProvider={activeProvider}
                activeModel={activeModel}
                onSelectModel={handleSelectModel}
                localModels={localModels}
                cloudModels={cloudModels}
                localFormat={localFormat}
                isScanning={isScanning}
                isScanningCloud={isScanningCloud}
                isLoadingVram={isLoadingVram}
                autoFallback={params.autoFallback}
                onToggleAutoFallback={() =>
                  setParams((p) => ({ ...p, autoFallback: !p.autoFallback }))
                }
                onScanLocal={() => scanLocalServer(false)}
                onScanCloud={() => scanCloudModels(false)}
                onOpenServerSettings={() => setServerModalOpen(true)}
              />
            </div>
          </div>

          {/* Right: Unified Header Dropdown Menu (Role & Server/Parameter inside) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setHeaderMenuOpen((v) => !v)}
                className={`h-7 sm:h-8 px-2 sm:px-3 rounded-md border flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium btn-tactile cursor-pointer ${
                  headerMenuOpen
                    ? 'border-[var(--text-primary)] bg-[var(--bg-muted)] text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-muted)]/60 hover:border-[var(--border-strong)] text-[var(--text-primary)]'
                }`}
              >
                <Sliders className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--accent)] shrink-0" />
                <span>Menu</span>
                <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--text-secondary)] shrink-0" />
              </button>

              {headerMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setHeaderMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-9 sm:top-10 z-40 w-64 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1.5 shadow-xl space-y-1 text-xs">
                    {/* Active Role info & Role Library */}
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setRoleModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--bg-muted)] text-left text-[var(--text-primary)] btn-tactile cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold">Role Library</div>
                          <div className="text-[11px] text-[var(--text-secondary)] truncate">
                            {activeRole.name}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
                        Atur
                      </span>
                    </button>

                    {/* Server Lokal & Parameter AI */}
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setServerModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--bg-muted)] text-left text-[var(--text-primary)] btn-tactile cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Sliders className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold">Server Lokal & Parameter</div>
                          <div className="text-[11px] text-[var(--text-secondary)] truncate">
                            {params.serverUrl}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          serverStatus.online ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        title={serverStatus.online ? 'Server Online' : 'Server Standby'}
                      />
                    </button>

                    <div className="border-t border-[var(--border-subtle)] my-1" />

                    {/* Quick Theme Switcher */}
                    <div className="px-2.5 py-1.5">
                      <div className="text-[10.5px] font-semibold text-[var(--text-secondary)] mb-1.5">
                        Tema Tampilan
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {(['vanilla', 'white', 'dark'] as ThemeMode[]).map((tMode) => (
                          <button
                            key={tMode}
                            type="button"
                            onClick={() => setTheme(tMode)}
                            className={`px-2 py-1 rounded-md text-[11px] font-medium border text-center capitalize btn-tactile cursor-pointer ${
                              theme === tMode
                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {tMode === 'vanilla'
                              ? 'Beige'
                              : tMode === 'white'
                              ? 'White'
                              : 'Dark'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-[var(--border-subtle)] my-1" />

                    {/* New Chat & Clear Current Chat */}
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        handleNewChat();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--bg-muted)] text-left text-[var(--text-primary)] font-medium btn-tactile cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Chat AI Baru</span>
                    </button>

                    {activeThread && activeMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          handleDeleteThread(activeThread.id);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-rose-500/10 text-left text-rose-600 dark:text-rose-400 font-medium btn-tactile cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Percakapan Ini</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Central Full-Width Workspace Stage (Unboxed Chat + Optional Right Live Artifact Sandbox) */}
        <div className="flex-1 flex min-h-0 w-full overflow-hidden relative">
          {/* Main Unboxed Chat Column */}
          <main className="flex-1 flex flex-col min-w-0 h-full bg-[var(--bg-surface)] overflow-hidden theme-surface relative">
            {/* Messages Scroll Stage — Wide & Spacious */}
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="chat-scroll-container flex-1 overflow-y-auto px-2.5 sm:px-6 lg:px-10 py-3 sm:py-6"
            >
              <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-6">
                <AnimatePresence key={activeThreadId || 'empty'} initial={false}>
                  {activeMessages.length > 0 &&
                    activeMessages.map((msg, idx) => {
                      const isUser = msg.role === 'user';
                      const isLastAiStreaming =
                        isStreaming && !isUser && idx === activeMessages.length - 1;
                      const detectedArtifact = !isUser ? extractCodeArtifact(msg.content) : null;

                      return (
                        <motion.div
                          key={msg.id || idx}
                          initial={{ opacity: 0, y: 12, scale: 0.99 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                          transition={{
                            duration: 0.28,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="group will-change-transform"
                        >
                          {isUser ? (
                          <div className="flex flex-col items-end">
                            <div className="user-chat-bubble max-w-[90%] sm:max-w-[78%] rounded-xl bg-[var(--accent)] text-white px-3 py-2 sm:px-4 sm:py-2.5 text-[12.5px] sm:text-[14px] leading-relaxed shadow-2xs break-words">
                              <div className="whitespace-pre-wrap">{msg.content}</div>

                              {msg.images && msg.images.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {msg.images.map((img, i) => (
                                    <img
                                      key={i}
                                      src={img}
                                      alt="Lampiran"
                                      className="max-h-40 sm:max-h-48 rounded-md border border-white/20 object-contain"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* User Message Actions */}
                            <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1.5 mt-1 transition-opacity text-[10px] sm:text-[11px] text-[var(--text-secondary)]">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.content);
                                  showToast('success', 'Pesan disalin');
                                }}
                                className="px-1.5 py-0.5 rounded-xs hover:bg-[var(--bg-muted)] flex items-center gap-1"
                              >
                                <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span>Salin</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditMessage(idx)}
                                className="px-1.5 py-0.5 rounded-xs hover:bg-[var(--bg-muted)] flex items-center gap-1"
                              >
                                <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="px-1.5 py-0.5 rounded-xs hover:bg-[var(--bg-muted)] hover:text-rose-600 flex items-center gap-1"
                              >
                                <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full min-w-0">
                            <RichMessageContent
                              content={msg.content}
                              reasoning={msg.reasoning}
                              isStreaming={isLastAiStreaming}
                              useMarkdown={params.markdown}
                              onOpenArtifact={(art) => setActiveArtifact(art)}
                            />

                            {/* Assistant Message Footer Actions */}
                            {!isLastAiStreaming && (
                              <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 pt-1 transition-opacity text-[10px] sm:text-[11px] text-[var(--text-secondary)]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.content);
                                    showToast('success', 'Jawaban disalin ke clipboard');
                                  }}
                                  className="px-2 py-0.5 sm:py-1 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 hover:text-[var(--text-primary)] flex items-center gap-1 btn-tactile"
                                >
                                  <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  <span>Salin</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRegenerateFrom(idx)}
                                  className="px-2 py-0.5 sm:py-1 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 hover:text-[var(--text-primary)] flex items-center gap-1 btn-tactile"
                                >
                                  <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  <span>Ulangi</span>
                                </button>
                                {detectedArtifact && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveArtifact(detectedArtifact)}
                                    className="px-2 py-0.5 sm:py-1 rounded-[4px] border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] font-medium flex items-center gap-1 btn-tactile"
                                  >
                                    <Code2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                    <span>Preview HTML / Code</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="px-2 py-0.5 sm:py-1 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 hover:text-rose-600 flex items-center gap-1 btn-tactile"
                                >
                                  <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  <span>Hapus</span>
                                </button>
                                {msg.model && (
                                  <span className="font-mono text-[9.5px] sm:text-[10.5px] text-[var(--text-muted)] ml-1 truncate max-w-[160px] sm:max-w-none">
                                    {msg.model}
                                  </span>
                                )}
                                {msg.fallbackNote && (
                                  <span
                                    title={msg.fallbackNote}
                                    className="px-1.5 py-0.5 rounded-[3px] bg-amber-500/12 text-amber-700 dark:text-amber-300 font-mono text-[9px] sm:text-[10px] truncate max-w-[200px] sm:max-w-[320px]"
                                  >
                                    {msg.fallbackNote}
                                  </span>
                                )}
                                {params.showTimestamps && msg.time && (
                                  <span className="font-mono-tabular text-[9.5px] sm:text-[10.5px] text-[var(--text-muted)]">
                                    ·{' '}
                                    {new Date(msg.time).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                          </motion.div>
                      );
                    })}
                </AnimatePresence>
              </div>
            </div>

            {/* Floating "↓ Ke Bawah" Button */}
            <AnimatePresence>
              {showScrollBottomBtn && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.94 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bottom-14 sm:bottom-16 left-1/2 -translate-x-1/2 z-20"
                >
                  <button
                    type="button"
                    onClick={() => scrollToBottom(true)}
                    className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-[#2B2927] hover:bg-[#1C1B1A] text-white text-[11px] sm:text-xs font-semibold shadow-lg flex items-center gap-1.5 border border-white/10 btn-tactile cursor-pointer"
                  >
                    <ArrowDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--accent)]" />
                    <span>Ke Bawah</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Conditional Status & Attachment Preview Bar */}
            {(attachments.length > 0 || isRecording || deepReasoningEnabled || webSearchEnabled) && (
              <div className="px-2.5 sm:px-6 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--bg-muted)]/40">
                <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {isRecording && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <span>Mendengarkan ({voiceLang})...</span>
                      <button
                        type="button"
                        onClick={() =>
                          setVoiceLang((l) => (l === 'id-ID' ? 'en-US' : 'id-ID'))
                        }
                        className="px-1.5 py-0.5 rounded-xs bg-rose-500/20 font-mono text-[9.5px]"
                      >
                        {voiceLang === 'id-ID' ? 'EN' : 'ID'}
                      </button>
                    </div>
                  )}

                  {webSearchEnabled && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent)] text-[11px] font-medium">
                      <Globe className="w-3 h-3" />
                      <span>Web Search Aktif</span>
                      <button
                        type="button"
                        onClick={() => setWebSearchEnabled(false)}
                        className="ml-0.5 hover:opacity-75 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {deepReasoningEnabled && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent)] text-[11px] font-medium">
                      <Brain className="w-3 h-3" />
                      <span>Deep Reasoning Aktif</span>
                      <button
                        type="button"
                        onClick={() => setDeepReasoningEnabled(false)}
                        className="ml-0.5 hover:opacity-75 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px]"
                    >
                      {att.type === 'image' ? (
                        <img
                          src={att.content}
                          alt={att.name}
                          className="w-4 h-4 rounded-xs object-cover"
                        />
                      ) : (
                        <FileSpreadsheet className="w-3 h-3 text-[var(--accent)]" />
                      )}
                      <span className="truncate max-w-[120px] font-medium">{att.name}</span>
                      <span className="text-[9.5px] font-mono text-[var(--text-muted)]">
                        ({att.sizeLabel})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((x) => x.id !== att.id))
                        }
                        className="text-[var(--text-muted)] hover:text-rose-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Multimodal Input Dock — Single Compact 1-Row Bar on All Screens */}
            <div className="px-2 sm:px-6 py-1.5 sm:py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 relative">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,.js,.ts,.tsx,.py,.html,.css,.json,.csv,.tsv,.xlsx,.xls,.docx,.sql"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />

              <div className="max-w-5xl mx-auto flex items-end gap-1.5 sm:gap-2">
                {/* [ + ] Multimodal & Tools Dropdown Button (Includes Web Search Toggle) */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setPlusMenuOpen((v) => !v)}
                    title="Lampirkan File, Kamera, Pencarian Web, atau Deep Reasoning"
                    className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg border flex items-center justify-center btn-tactile cursor-pointer relative ${
                      webSearchEnabled || deepReasoningEnabled
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 hover:bg-[var(--bg-muted)] text-[var(--text-primary)]'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    {(webSearchEnabled || deepReasoningEnabled) && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--accent)]" />
                    )}
                  </button>

                  {plusMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setPlusMenuOpen(false)}
                      />
                      <div className="absolute bottom-10 sm:bottom-11 left-0 z-40 w-60 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1.5 shadow-xl space-y-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setPlusMenuOpen(false);
                            fileInputRef.current?.click();
                          }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-[var(--bg-muted)] text-left text-[var(--text-primary)] btn-tactile cursor-pointer"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                          <span>Upload File / Excel / Word</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPlusMenuOpen(false);
                            setCameraModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-[var(--bg-muted)] text-left text-[var(--text-primary)] btn-tactile cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                          <span>Kamera Live (WebRTC)</span>
                        </button>

                        <div className="border-t border-[var(--border-subtle)] my-1" />

                        {/* Pencarian Web Toggle inside + Dropdown */}
                        <button
                          type="button"
                          onClick={() => {
                            setWebSearchEnabled((v) => !v);
                            setPlusMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-[var(--bg-muted)] text-left text-[var(--text-primary)] btn-tactile cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Globe className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                            <span>Pencarian Web (Web)</span>
                          </div>
                          {webSearchEnabled && (
                            <Check className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                          )}
                        </button>

                        {/* Mode Deep Reasoning Toggle inside + Dropdown */}
                        <button
                          type="button"
                          onClick={() => {
                            setDeepReasoningEnabled((v) => !v);
                            setPlusMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-[var(--bg-muted)] text-left text-[var(--text-primary)] btn-tactile cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Brain className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                            <span>Mode Deep Reasoning</span>
                          </div>
                          {deepReasoningEnabled && (
                            <Check className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Single-Bar Auto-Resizing Input Box */}
                <div className="flex-1 min-w-0 flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] focus-within:border-[var(--accent)] px-2.5 sm:px-3 min-h-8 sm:min-h-9 py-1 sm:py-1.5 transition-colors">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={userInput}
                    placeholder="Ask anything..."
                    onPaste={handlePasteClipboard}
                    onChange={(e) => {
                      setUserInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="w-full bg-transparent text-[12.5px] sm:text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none max-h-32 leading-snug"
                  />
                  {userInput.length > 0 && (
                    <span
                      className="hidden md:inline-block ml-2 font-mono-tabular text-[10px] text-[var(--text-muted)] shrink-0"
                      title="Estimasi Token Input"
                    >
                      ~{approxInputTokens}t
                    </span>
                  )}
                </div>

                {/* [ 🎤 Mic ] Compact Button */}
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  title="Input Suara (Voice-to-Text)"
                  className={`h-8 w-8 sm:h-9 sm:w-auto sm:px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 btn-tactile cursor-pointer shrink-0 ${
                    isRecording
                      ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 hover:bg-[var(--bg-muted)] text-[var(--text-primary)]'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mic</span>
                </button>

                {/* [ ◁ Kirim ] or [ ■ Stop ] Button */}
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStopStream}
                    className="h-8 px-2.5 sm:h-9 sm:px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11.5px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 shadow-2xs btn-tactile cursor-pointer shrink-0"
                  >
                    <Square className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!userInput.trim() && attachments.length === 0}
                    className="h-8 px-2.5 sm:h-9 sm:px-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-45 text-white text-[11.5px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 shadow-2xs btn-tactile cursor-pointer shrink-0"
                  >
                    <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Kirim</span>
                  </button>
                )}
              </div>
            </div>
          </main>

          {/* Right Split-Pane Live HTML & Code Artifact Sandbox (Full overlay on mobile, split pane on desktop) */}
          {activeArtifact && (
            <aside className="fixed inset-0 z-40 lg:static lg:inset-auto lg:w-[460px] xl:w-[540px] border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col overflow-hidden shadow-2xl lg:shadow-none shrink-0">
              <div className="h-12 px-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-muted)]/40">
                <div className="flex items-center gap-2 min-w-0">
                  <Code2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <span className="text-xs font-bold truncate">{activeArtifact.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeArtifact.code);
                      showToast('success', 'Kode Artifact disalin');
                    }}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent)] cursor-pointer"
                  >
                    Salin Kode
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveArtifact(null)}
                    className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {['html', 'svg'].includes(activeArtifact.language) ? (
                <div className="flex-1 flex flex-col divide-y divide-[var(--border-subtle)] min-h-0">
                  <div className="flex-1 bg-white relative min-h-[240px]">
                    <iframe
                      title="Live Artifact Sandbox"
                      sandbox="allow-scripts"
                      srcDoc={activeArtifact.code}
                      className="w-full h-full border-0"
                    />
                  </div>
                  <pre className="h-48 p-3 text-[11.5px] font-mono bg-[var(--bg-code)] overflow-auto shrink-0">
                    <code>{activeArtifact.code}</code>
                  </pre>
                </div>
              ) : (
                <pre className="flex-1 p-4 text-xs font-mono bg-[var(--bg-code)] overflow-auto">
                  <code>{activeArtifact.code}</code>
                </pre>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* Modals */}
      <RoleLibraryModal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        roles={roles}
        setRoles={setRoles}
        activeRoleId={activeRoleId}
        setActiveRoleId={setActiveRoleId}
        onApplyRolePrompt={(role) => {
          setSystemPrompt(role.systemPrompt);
          setParams((prev) => ({ ...prev, temperature: role.temperature }));
        }}
        showToast={showToast}
      />

      <ServerAndParamsModal
        isOpen={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        params={params}
        setParams={setParams}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        onConnectAndTest={async () => {
          await scanLocalServer(false);
        }}
        onPullOllamaModel={handlePullOllamaModel}
        isScanning={isScanning}
        isPulling={isPulling}
        serverStatus={serverStatus}
        onLoadRoleMdFile={handleLoadRoleMdFile}
      />

      <LiveCameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCaptureImage={(dataUrl) => {
          setAttachments((prev) => [
            ...prev,
            {
              id: `cam_${Date.now()}`,
              name: `Camera_${new Date().toLocaleTimeString()}.jpg`,
              type: 'image',
              mimeType: 'image/jpeg',
              content: dataUrl,
              sizeLabel: 'Kamera Live',
            },
          ]);
          showToast('success', 'Foto kamera berhasil dilampirkan');
        }}
        showToast={showToast}
      />

      {/* Toast Notification Stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2.5 rounded-lg border shadow-lg text-xs font-medium bg-[var(--bg-surface)] ${
              t.type === 'success'
                ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/40 text-rose-600 dark:text-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                t.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
