import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Check,
  X,
  Server,
  Sliders,
  BookOpen,
  Upload,
  Download,
  Plus,
  Trash2,
  Camera,
  RotateCcw,
  Cpu,
  HardDrive,
} from 'lucide-react';
import {
  DetectedModel,
  EngineParameters,
  ProviderType,
  RoleItem,
  DEFAULT_ROLES,
} from '../types/ai';
import { exportRoleToMarkdown, parseRoleMarkdown } from '../utils/documentParser';

interface ModelPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  activeProvider: ProviderType;
  setActiveProvider: (p: ProviderType) => void;
  activeModel: string;
  onSelectModel: (model: DetectedModel) => void;
  localModels: DetectedModel[];
  cloudModels: DetectedModel[];
  localFormat: string;
  isScanning: boolean;
  isLoadingVram: string | null;
  onScanLocal: () => void;
  onOpenServerSettings: () => void;
}

export const ModelPickerPopover: React.FC<ModelPickerPopoverProps> = ({
  isOpen,
  onClose,
  activeProvider,
  setActiveProvider,
  activeModel,
  onSelectModel,
  localModels,
  cloudModels,
  localFormat,
  isScanning,
  isLoadingVram,
  onScanLocal,
  onOpenServerSettings,
}) => {
  if (!isOpen) return null;

  const filteredModels =
    activeProvider === 'local'
      ? localModels
      : cloudModels.filter((m) => m.provider === activeProvider);

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute left-0 top-10 z-40 w-[calc(100vw-24px)] max-w-[360px] sm:w-[380px] sm:max-w-none rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-2.5 sm:p-3 shadow-2xl theme-surface">
        {/* 3 Provider Tabs matching screenshot image_52dc21fa.png */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-[var(--bg-muted)] mb-2.5">
          <button
            type="button"
            onClick={() => setActiveProvider('gemini')}
            className={`py-1.5 px-2 text-xs font-semibold rounded-[4px] btn-tactile whitespace-nowrap ${
              activeProvider === 'gemini'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Google Gemini
          </button>
          <button
            type="button"
            onClick={() => setActiveProvider('openrouter')}
            className={`py-1.5 px-2 text-xs font-semibold rounded-[4px] btn-tactile whitespace-nowrap ${
              activeProvider === 'openrouter'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            OpenRouter
          </button>
          <button
            type="button"
            onClick={() => setActiveProvider('local')}
            className={`py-1.5 px-2 text-xs font-semibold rounded-[4px] btn-tactile whitespace-nowrap ${
              activeProvider === 'local'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Local LM
          </button>
        </div>

        {/* Subheader Row: DAFTAR MODEL + format badge + Pindai + Atur Server */}
        <div className="flex items-center justify-between gap-2 px-1 mb-2.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-wider uppercase text-[var(--text-secondary)]">
              DAFTAR MODEL:
            </span>
            <span className="px-1.5 py-0.5 rounded-[3px] font-mono text-[10px] font-medium bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
              {activeProvider === 'local' ? localFormat || 'openai-compatible' : activeProvider}
            </span>
          </div>

          {activeProvider === 'local' && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onScanLocal}
                disabled={isScanning}
                className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium btn-tactile cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin text-[var(--accent)]' : ''}`} />
                <span>Pindai</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenServerSettings();
                }}
                className="font-semibold text-[var(--accent)] hover:underline btn-tactile cursor-pointer"
              >
                Atur Server
              </button>
            </div>
          )}
        </div>

        {/* Model List */}
        <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
          {filteredModels.length === 0 ? (
            <div className="py-6 px-3 text-center rounded-md bg-[var(--bg-muted)]/50 border border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-secondary)] mb-2">
                Belum ada model lokal terdeteksi dari server.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onScanLocal}
                  className="px-2.5 py-1 text-xs font-medium rounded-[4px] bg-[var(--accent)] text-white btn-tactile"
                >
                  Pindai Ulang
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenServerSettings();
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded-[4px] border border-[var(--border-strong)] text-[var(--text-primary)] btn-tactile"
                >
                  Atur URL Server
                </button>
              </div>
            </div>
          ) : (
            filteredModels.map((m) => {
              const isSelected = activeModel === m.id;
              const isBeingLoaded = isLoadingVram === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectModel(m)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-left btn-tactile cursor-pointer border ${
                    isSelected
                      ? 'bg-[var(--bg-active-row)] border-[var(--accent-border)] text-[var(--accent)]'
                      : 'bg-transparent border-transparent hover:bg-[var(--bg-muted)] text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`font-mono text-xs font-semibold truncate ${
                        isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                      }`}
                      title={m.id}
                    >
                      {m.id}
                    </span>

                    {isBeingLoaded ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        Memuat VRAM...
                      </span>
                    ) : m.isLoaded ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {m.badgeText || 'VRAM Aktif'}
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium bg-[var(--accent-soft)] text-[var(--accent)]">
                        {m.badgeText || 'Local Server'}
                      </span>
                    )}
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

interface RoleLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: RoleItem[];
  setRoles: React.Dispatch<React.SetStateAction<RoleItem[]>>;
  activeRoleId: string;
  setActiveRoleId: (id: string) => void;
  onApplyRolePrompt: (role: RoleItem) => void;
  showToast: (type: 'success' | 'error', msg: string) => void;
}

export const RoleLibraryModal: React.FC<RoleLibraryModalProps> = ({
  isOpen,
  onClose,
  roles,
  setRoles,
  activeRoleId,
  setActiveRoleId,
  onApplyRolePrompt,
  showToast,
}) => {
  const [selectedId, setSelectedId] = useState<string>(activeRoleId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setSelectedId(activeRoleId);
  }, [isOpen, activeRoleId]);

  if (!isOpen) return null;

  const currentRole = roles.find((r) => r.id === selectedId) || roles[0];

  const handleUpdateCurrent = (patch: Partial<RoleItem>) => {
    if (!currentRole) return;
    setRoles((prev) => prev.map((r) => (r.id === currentRole.id ? { ...r, ...patch } : r)));
  };

  const handleCreateNewRole = () => {
    const newRole: RoleItem = {
      id: `role_${Date.now()}`,
      name: 'Role Kustom Baru',
      description: 'Instruksi sistem kustom',
      category: 'custom',
      temperature: 0.7,
      systemPrompt: 'Anda adalah asisten AI profesional.',
    };
    setRoles((prev) => [newRole, ...prev]);
    setSelectedId(newRole.id);
  };

  const handleDeleteRole = (id: string) => {
    if (roles.length <= 1) {
      showToast('error', 'Minimal harus ada 1 role tersimpan');
      return;
    }
    const remaining = roles.filter((r) => r.id !== id);
    setRoles(remaining);
    if (selectedId === id) setSelectedId(remaining[0].id);
    if (activeRoleId === id) {
      setActiveRoleId(remaining[0].id);
      onApplyRolePrompt(remaining[0]);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          setRoles(parsed);
          showToast('success', `Berhasil mengimpor ${parsed.length} role dari JSON`);
        }
      } else {
        const roleData = parseRoleMarkdown(text, file.name);
        const newRole: RoleItem = {
          id: `role_${Date.now()}`,
          ...roleData,
        };
        setRoles((prev) => [newRole, ...prev]);
        setSelectedId(newRole.id);
        setActiveRoleId(newRole.id);
        onApplyRolePrompt(newRole);
        showToast('success', `Berhasil memuat role dari: ${file.name}`);
      }
    } catch {
      showToast('error', 'Format file role tidak valid');
    }
    e.target.value = '';
  };

  const handleExportMd = () => {
    if (!currentRole) return;
    const md = exportRoleToMarkdown(currentRole);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentRole.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'File Role (.md) berhasil diunduh');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-3xl rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] theme-surface">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3.5 sm:px-5 py-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
              Role & System Prompt
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.json"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 text-[11px] sm:text-xs font-medium rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] hover:border-[var(--accent)] btn-tactile whitespace-nowrap"
            >
              <Upload className="w-3 h-3 text-[var(--accent)]" />
              <span>Load .md</span>
            </button>
            <button
              type="button"
              onClick={handleExportMd}
              className="flex items-center gap-1 px-2 py-1 text-[11px] sm:text-xs font-medium rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] hover:border-[var(--accent)] btn-tactile whitespace-nowrap"
            >
              <Download className="w-3 h-3" />
              <span>Ekspor</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] btn-tactile"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[var(--border-subtle)]">
          {/* Left Role List */}
          <div className="md:col-span-5 p-3 space-y-2 overflow-y-auto max-h-72 md:max-h-none">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Daftar Role ({roles.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setRoles(DEFAULT_ROLES);
                    setSelectedId(DEFAULT_ROLES[0].id);
                    showToast('success', 'Role dikembalikan ke default');
                  }}
                  className="px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-tactile"
                  title="Reset Default"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewRole}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-[4px] bg-[var(--accent)] text-white btn-tactile"
                >
                  <Plus className="w-3 h-3" />
                  <span>Role Baru</span>
                </button>
              </div>
            </div>

            {roles.map((r) => {
              const isCurrent = r.id === currentRole?.id;
              const isActive = r.id === activeRoleId;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`p-2.5 rounded-md border cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-[var(--bg-active-row)] border-[var(--accent-border)]'
                      : 'bg-[var(--bg-muted)]/40 border-[var(--border-subtle)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {r.name}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[3px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shrink-0">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                    {r.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right Role Editor */}
          {currentRole && (
            <div className="md:col-span-7 p-4 space-y-3.5 flex flex-col">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Nama Role
                  </label>
                  <input
                    type="text"
                    value={currentRole.name}
                    onChange={(e) => handleUpdateCurrent({ name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Default Temp ({currentRole.temperature})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.05"
                    value={currentRole.temperature}
                    onChange={(e) =>
                      handleUpdateCurrent({ temperature: parseFloat(e.target.value) || 0.7 })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Deskripsi Singkat
                </label>
                <input
                  type="text"
                  value={currentRole.description}
                  onChange={(e) => handleUpdateCurrent({ description: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  System Prompt (Instruksi Sifat Dasar AI)
                </label>
                <textarea
                  rows={8}
                  value={currentRole.systemPrompt}
                  onChange={(e) => handleUpdateCurrent({ systemPrompt: e.target.value })}
                  className="w-full flex-1 p-3 text-xs font-mono leading-relaxed rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => handleDeleteRole(currentRole.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/10 rounded-md btn-tactile"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Role</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveRoleId(currentRole.id);
                    onApplyRolePrompt(currentRole);
                    showToast('success', `Role aktif: ${currentRole.name}`);
                    onClose();
                  }}
                  className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white btn-tactile"
                >
                  Gunakan Role Ini
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ServerAndParamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: EngineParameters;
  setParams: React.Dispatch<React.SetStateAction<EngineParameters>>;
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;
  onConnectAndTest: () => Promise<void>;
  onPullOllamaModel: (modelName: string) => Promise<void>;
  isScanning: boolean;
  isPulling: boolean;
  serverStatus: { online: boolean; latencyMs?: number; error?: string };
  onLoadRoleMdFile: (file: File) => void;
}

export const ServerAndParamsModal: React.FC<ServerAndParamsModalProps> = ({
  isOpen,
  onClose,
  params,
  setParams,
  systemPrompt,
  setSystemPrompt,
  onConnectAndTest,
  onPullOllamaModel,
  isScanning,
  isPulling,
  serverStatus,
  onLoadRoleMdFile,
}) => {
  const [activeTab, setActiveTab] = useState<'server' | 'params'>('server');
  const [pullModelName, setPullModelName] = useState('');
  const mdInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const updateParam = <K extends keyof EngineParameters>(key: K, value: EngineParameters[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[88dvh] theme-surface">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 min-w-0">
            <Sliders className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
              Pengaturan Server & Parameter AI
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] btn-tactile shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1.5 bg-[var(--bg-muted)]/60 border-b border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setActiveTab('server')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-md btn-tactile whitespace-nowrap ${
              activeTab === 'server'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Server className="w-3.5 h-3.5 shrink-0" />
            <span>Server & VRAM</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-md btn-tactile whitespace-nowrap ${
              activeTab === 'params'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>Parameter & Prompt</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5">
          {activeTab === 'server' ? (
            <>
              {/* Connection Status Banner */}
              <div
                className={`p-2.5 sm:p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 ${
                  serverStatus.online
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      serverStatus.online ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="font-semibold">
                    {serverStatus.online
                      ? `Terhubung ke Server (${serverStatus.latencyMs || 0} ms)`
                      : 'Server Lokal Belum Terhubung / Offline'}
                  </span>
                </div>
                <span className="font-mono text-[11px] truncate opacity-85 pl-4 sm:pl-0">
                  {params.serverUrl}
                </span>
              </div>

              {serverStatus.error && !serverStatus.online && (
                <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-600 dark:text-rose-300 font-mono">
                  {serverStatus.error}
                </div>
              )}

              {/* Server URL */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Server URL (Cloudflare Tunnel / LM Studio / Ollama)
                </label>
                <p className="text-[11px] text-[var(--text-secondary)] mb-2">
                  Mendukung domain Cloudflare Tunnel (misal <code>https://api.vinns.my.id</code>)
                  atau IP lokal (<code>http://192.168.147.33:1234</code> /{' '}
                  <code>http://localhost:11434</code>).
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={params.serverUrl}
                    onChange={(e) => updateParam('serverUrl', e.target.value)}
                    placeholder="https://api.vinns.my.id atau http://192.168.147.33:1234"
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { label: 'Cloudflare Tunnel (api.vinns.my.id)', url: 'https://api.vinns.my.id' },
                    { label: 'LAN PC (192.168.147.33:1234)', url: 'http://192.168.147.33:1234' },
                    { label: 'LM Studio Local (:1234)', url: 'http://localhost:1234' },
                    { label: 'Ollama Local (:11434)', url: 'http://localhost:11434' },
                  ].map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => updateParam('serverUrl', preset.url)}
                      className="px-2 py-1 text-[11px] font-mono rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] btn-tactile"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional API Key */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    Local Server API Key (Opsional)
                  </label>
                  <input
                    type="password"
                    value={params.apiKey}
                    onChange={(e) => updateParam('apiKey', e.target.value)}
                    placeholder="lm-studio (atau kosongkan)"
                    className="w-full px-3 py-2 text-xs font-mono rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    OpenRouter API Key (Opsional)
                  </label>
                  <input
                    type="password"
                    value={params.openRouterApiKey}
                    onChange={(e) => updateParam('openRouterApiKey', e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full px-3 py-2 text-xs font-mono rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Auto-Load VRAM Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-[var(--accent)]" />
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      Auto-Load Model ke VRAM saat Dipilih
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      Memicu warmup otomatis ke GPU agar tidak terjadi cold-start timeout
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateParam('autoLoadVram', !params.autoLoadVram)}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                    params.autoLoadVram ? 'bg-[var(--accent)]' : 'bg-neutral-400/40'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      params.autoLoadVram ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Ollama Pull New Model */}
              <div className="p-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/30 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                  <HardDrive className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Tarik Model Baru (Ollama Pull)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pullModelName}
                    onChange={(e) => setPullModelName(e.target.value)}
                    placeholder="Contoh: qwen2.5-coder:7b atau deepseek-r1:8b"
                    className="flex-1 px-3 py-1.5 text-xs font-mono rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    disabled={isPulling || !pullModelName.trim()}
                    onClick={() => onPullOllamaModel(pullModelName)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-50 btn-tactile"
                  >
                    {isPulling ? 'Mengunduh...' : 'Pull Model'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* System Prompt with Load .md */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">
                    System Prompt Aktif
                  </label>
                  <input
                    ref={mdInputRef}
                    type="file"
                    accept=".md,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onLoadRoleMdFile(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => mdInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline btn-tactile"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Load .md</span>
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mb-1.5">
                  Instruksi sifat dasar AI. Klik &apos;Load .md&apos; untuk memuat file role
                  eksternal.
                </p>
                <textarea
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Sliders grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Temperature</span>
                    <span className="font-mono-tabular text-[var(--accent)]">
                      {params.temperature.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[var(--text-secondary)] mb-1.5">
                    0.1 = Faktual & Presisi, 1.0 = Kreatif
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={params.temperature}
                    onChange={(e) => updateParam('temperature', parseFloat(e.target.value))}
                    className="w-full accent-[#C65D3B]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Max Tokens</span>
                    <span className="font-mono-tabular text-[var(--accent)]">
                      {params.maxTokens === -1 ? 'Auto' : params.maxTokens}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[var(--text-secondary)] mb-1.5">
                    Geser paling kiri untuk Auto (mengikuti kapasitas LM Studio)
                  </p>
                  <input
                    type="range"
                    min="-1"
                    max="32768"
                    step="256"
                    value={params.maxTokens}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateParam('maxTokens', val <= 0 ? -1 : val);
                    }}
                    className="w-full accent-[#C65D3B]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Context Window Budget</span>
                    <span className="font-mono-tabular text-[var(--accent)]">
                      {params.contextWindow} tok
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[var(--text-secondary)] mb-1.5">
                    Batas ingatan riwayat obrolan sesuai kapasitas VRAM
                  </p>
                  <input
                    type="range"
                    min="1024"
                    max="32768"
                    step="512"
                    value={params.contextWindow}
                    onChange={(e) => updateParam('contextWindow', parseInt(e.target.value, 10))}
                    className="w-full accent-[#C65D3B]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Top P</span>
                    <span className="font-mono-tabular text-[var(--accent)]">
                      {params.topP.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[var(--text-secondary)] mb-1.5">
                    Mengontrol ragam variasi kata (Default: 0.95)
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={params.topP}
                    onChange={(e) => updateParam('topP', parseFloat(e.target.value))}
                    className="w-full accent-[#C65D3B]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Frequency Penalty</span>
                    <span className="font-mono-tabular text-[var(--accent)]">
                      {params.frequencyPenalty.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={params.frequencyPenalty}
                    onChange={(e) => updateParam('frequencyPenalty', parseFloat(e.target.value))}
                    className="w-full accent-[#C65D3B]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Presence Penalty</span>
                    <span className="font-mono-tabular text-[var(--accent)]">
                      {params.presencePenalty.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={params.presencePenalty}
                    onChange={(e) => updateParam('presencePenalty', parseFloat(e.target.value))}
                    className="w-full accent-[#C65D3B]"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                {[
                  { key: 'stream' as const, label: 'SSE Live Streaming' },
                  { key: 'markdown' as const, label: 'Markdown & KaTeX' },
                  { key: 'autoScroll' as const, label: 'Smart Auto-Scroll' },
                  { key: 'showTimestamps' as const, label: 'Tampilkan Waktu' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => updateParam(item.key, !params[item.key])}
                    className="flex items-center justify-between p-2.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40 text-xs font-medium text-[var(--text-primary)] btn-tactile"
                  >
                    <span>{item.label}</span>
                    <span
                      className={`w-8 h-4 rounded-full relative transition-colors ${
                        params[item.key] ? 'bg-[var(--accent)]' : 'bg-neutral-400/40'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                          params[item.key] ? 'translate-x-4' : ''
                        }`}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-muted)]/40">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-tactile"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={isScanning}
            onClick={async () => {
              await onConnectAndTest();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white btn-tactile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Simpan & Tes Koneksi</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureImage: (dataUrl: string) => void;
  showToast: (type: 'success' | 'error', msg: string) => void;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCaptureImage,
  showToast,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
      return;
    }

    let activeStream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode } })
      .then((mediaStream) => {
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch(() => {
        showToast('error', 'Tidak dapat mengakses kamera perangkat');
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onCaptureImage(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-bold text-[var(--text-primary)]">Kamera Multimodal</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative bg-black aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex items-center justify-between p-3.5 bg-[var(--bg-muted)]/50">
          <button
            type="button"
            onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] btn-tactile"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Putar Kamera</span>
          </button>

          <button
            type="button"
            onClick={handleCapture}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-[var(--accent)] text-white btn-tactile"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Jepret Foto</span>
          </button>
        </div>
      </div>
    </div>
  );
};
