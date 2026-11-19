import React, { useState } from 'react';
import {
  Plus,
  Search,
  CheckSquare,
  Pin,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Edit3,
  Check,
  X,
  Layers,
  Sun,
  Moon,
  Sparkles,
  Download,
} from 'lucide-react';
import { ChatFolder, ChatThread, ThemeMode } from '../types/ai';

interface SidebarHistoryProps {
  isOpen: boolean;
  onToggleSidebar: () => void;
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewChat: (folderId?: string) => void;
  onDeleteThread: (id: string) => void;
  onBatchDeleteThreads: (ids: string[]) => void;
  onTogglePinThread: (id: string) => void;
  onRenameThread: (id: string, newTitle: string) => void;
  onMoveThreadToFolder: (threadId: string, folderId?: string) => void;
  folders: ChatFolder[];
  onToggleFolder: (folderId: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  serverOnline: boolean;
  onOpenServerModal: () => void;
  onExportChatsJson: () => void;
}

function formatTimeAgoId(ts: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}j lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}h lalu`;
}

export const SidebarHistory: React.FC<SidebarHistoryProps> = ({
  isOpen,
  onToggleSidebar,
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onBatchDeleteThreads,
  onTogglePinThread,
  onRenameThread,
  onMoveThreadToFolder,
  folders,
  onToggleFolder,
  onCreateFolder,
  onDeleteFolder,
  theme,
  onChangeTheme,
  serverOnline,
  onOpenServerModal,
  onExportChatsJson,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedThreadId, setDraggedThreadId] = useState<string | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'pinned'>('all');

  const filteredThreads = threads.filter((t) => {
    if (sidebarFilter === 'pinned' && !t.pinned) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = t.title.toLowerCase().includes(q);
    const msgMatch = t.messages.some((m) => m.content.toLowerCase().includes(q));
    return titleMatch || msgMatch;
  });

  const pinnedThreads = filteredThreads.filter((t) => t.pinned);

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmBatchDelete = () => {
    if (selectedIds.length === 0) return;
    onBatchDeleteThreads(selectedIds);
    setSelectedIds([]);
    setBatchMode(false);
  };

  const handleCycleTheme = () => {
    const order: ThemeMode[] = ['vanilla', 'white', 'dark'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    onChangeTheme(next);
  };

  const themeLabelMap: Record<ThemeMode, string> = {
    vanilla: 'Vanilla Beige',
    white: 'Light White',
    dark: 'Dark Mode',
  };

  const renderThreadCard = (thread: ChatThread) => {
    const isActive = thread.id === activeThreadId;
    const isEditing = editingId === thread.id;
    const isChecked = selectedIds.includes(thread.id);

    return (
      <div
        key={thread.id}
        draggable={!isEditing && !batchMode}
        onDragStart={() => setDraggedThreadId(thread.id)}
        onDragEnd={() => setDraggedThreadId(null)}
        onClick={() => {
          if (batchMode) {
            toggleSelectId(thread.id);
          } else if (!isEditing) {
            onSelectThread(thread.id);
          }
        }}
        className={`group relative rounded-md p-2.5 cursor-pointer transition-all border ${
          isActive
            ? 'bg-[var(--bg-active-row)] border-[var(--accent-border)]'
            : 'bg-transparent border-transparent hover:bg-[var(--bg-muted)]/70'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {batchMode && (
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleSelectId(thread.id)}
                onClick={(e) => e.stopPropagation()}
                className="accent-[#C65D3B] rounded-xs shrink-0"
              />
            )}

            {isEditing ? (
              <div
                className="flex items-center gap-1 flex-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editingTitle.trim()) {
                      onRenameThread(thread.id, editingTitle.trim());
                      setEditingId(null);
                    } else if (e.key === 'Escape') {
                      setEditingId(null);
                    }
                  }}
                  autoFocus
                  className="w-full px-1.5 py-0.5 text-xs rounded-xs border border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (editingTitle.trim()) onRenameThread(thread.id, editingTitle.trim());
                    setEditingId(null);
                  }}
                  className="p-0.5 text-emerald-600"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="p-0.5 text-[var(--text-secondary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {thread.title}
              </span>
            )}
          </div>

          {!isEditing && (
            <span className="text-[11px] font-mono-tabular text-[var(--text-muted)] shrink-0">
              {formatTimeAgoId(thread.updated || thread.created)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
            {thread.messages.length} pesan
          </span>

          {/* Hover Actions */}
          {!batchMode && !isEditing && (
            <div
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onTogglePinThread(thread.id)}
                title={thread.pinned ? 'Lepas Sematan' : 'Sematkan'}
                className={`p-1 rounded-xs hover:bg-[var(--bg-surface)] ${
                  thread.pinned ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Pin className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(thread.id);
                  setEditingTitle(thread.title);
                }}
                title="Ubah Judul"
                className="p-1 rounded-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteThread(thread.id)}
                title="Hapus Percakapan"
                className="p-1 rounded-xs text-[var(--text-secondary)] hover:text-rose-600 hover:bg-[var(--bg-surface)]"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={onToggleSidebar}
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] theme-surface transition-all duration-200 ease-out shrink-0 overflow-hidden ${
          isOpen
            ? 'w-[272px] translate-x-0'
            : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0 border-r-0'
        }`}
      >
        <div className="w-[272px] h-full flex flex-col p-3 gap-2.5">
          {/* Top Switcher Bar + Collapse Button matching image_83a0d862.png */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex-1 grid grid-cols-3 gap-1 p-1 rounded-md bg-[var(--bg-muted)] border border-[var(--border-subtle)] text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setSidebarFilter('all')}
                className={`py-1 px-1.5 rounded-[4px] truncate btn-tactile ${
                  sidebarFilter === 'all'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Riwayat
              </button>
              <button
                type="button"
                onClick={() => setSidebarFilter('pinned')}
                className={`py-1 px-1.5 rounded-[4px] truncate btn-tactile ${
                  sidebarFilter === 'pinned'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Disematkan
              </button>
              <button
                type="button"
                onClick={onExportChatsJson}
                title="Ekspor Riwayat JSON"
                className="py-1 px-1.5 rounded-[4px] truncate text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1 btn-tactile"
              >
                <Download className="w-3 h-3" />
                <span>Backup</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleSidebar}
              title="Tutup Sidebar"
              className="p-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-tactile cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Primary CTA: + Chat AI Baru */}
          <button
            type="button"
            onClick={() => onNewChat()}
            className="w-full py-2 px-3 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs btn-tactile cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Chat AI Baru</span>
          </button>

          {/* Search Input & Batch Select Button */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari obrolan AI..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)]/70 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setBatchMode((b) => !b);
                setSelectedIds([]);
              }}
              className={`px-2.5 py-1.5 rounded-md border text-xs font-medium flex items-center gap-1 btn-tactile cursor-pointer ${
                batchMode
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-muted)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Pilih</span>
            </button>
          </div>

          {/* Batch Mode Action Bar */}
          {batchMode && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-xs">
              <span className="text-rose-700 dark:text-rose-300 font-medium">
                {selectedIds.length} dipilih
              </span>
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={handleConfirmBatchDelete}
                className="px-2 py-0.5 rounded-[4px] bg-rose-600 text-white font-semibold disabled:opacity-40 btn-tactile"
              >
                Hapus
              </button>
            </div>
          )}

          {/* Scrollable Conversations & Folders */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
            {/* Pinned Section */}
            {pinnedThreads.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                  <div className="flex items-center gap-1.5">
                    <Pin className="w-3 h-3 text-[var(--accent)]" />
                    <span>Disematkan</span>
                  </div>
                  <span className="font-mono-tabular">{pinnedThreads.length}</span>
                </div>
                <div className="space-y-1">{pinnedThreads.map(renderThreadCard)}</div>
              </div>
            )}

            {/* Custom Folders */}
            {folders.map((folder) => {
              const folderThreads = filteredThreads.filter((t) => t.folderId === folder.id);
              return (
                <div
                  key={folder.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedThreadId) {
                      onMoveThreadToFolder(draggedThreadId, folder.id);
                      setDraggedThreadId(null);
                    }
                  }}
                  className="space-y-1 pt-1 border-t border-[var(--border-subtle)]/60"
                >
                  <div className="flex items-center justify-between px-1 group">
                    <button
                      type="button"
                      onClick={() => onToggleFolder(folder.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] hover:text-[var(--accent)] btn-tactile cursor-pointer"
                    >
                      <Folder className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span className="truncate max-w-[165px]">{folder.name}</span>
                    </button>

                    <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                      <button
                        type="button"
                        onClick={() => onNewChat(folder.id)}
                        title="Chat Baru di Folder Ini"
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[var(--accent)]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      {folders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteFolder(folder.id)}
                          title="Hapus Folder"
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      <span className="font-mono-tabular">{folderThreads.length}</span>
                      <button
                        type="button"
                        onClick={() => onToggleFolder(folder.id)}
                        className="p-0.5"
                      >
                        {folder.isOpen ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {folder.isOpen && (
                    <div className="space-y-1 pl-1">
                      {folderThreads.length === 0 ? (
                        <div className="px-2 py-1 text-[11px] italic text-[var(--text-muted)]">
                          Kosong
                        </div>
                      ) : (
                        folderThreads.map(renderThreadCard)
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Uncategorized threads (if any) */}
            {filteredThreads.filter((t) => !t.folderId && !t.pinned).length > 0 && (
              <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]/60">
                <div className="px-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                  Lainnya
                </div>
                {filteredThreads.filter((t) => !t.folderId && !t.pinned).map(renderThreadCard)}
              </div>
            )}

            {/* + Folder Baru */}
            <div className="pt-1">
              {creatingFolder ? (
                <div className="flex items-center gap-1 px-1">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Nama folder..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFolderName.trim()) {
                        onCreateFolder(newFolderName.trim());
                        setNewFolderName('');
                        setCreatingFolder(false);
                      } else if (e.key === 'Escape') {
                        setCreatingFolder(false);
                      }
                    }}
                    className="flex-1 px-2 py-1 text-xs rounded-md border border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newFolderName.trim()) {
                        onCreateFolder(newFolderName.trim());
                        setNewFolderName('');
                      }
                      setCreatingFolder(false);
                    }}
                    className="p-1 text-emerald-600"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingFolder(false)}
                    className="p-1 text-[var(--text-secondary)]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingFolder(true)}
                  className="flex items-center gap-1.5 px-1.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] btn-tactile cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ Folder Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Footer Card matching image_83a0d862.png */}
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 p-2.5 space-y-2 theme-surface">
            <button
              type="button"
              onClick={onOpenServerModal}
              className="w-full flex items-center justify-between text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-tactile cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <Layers className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
                <span className="font-medium truncate">Vinns (Local & Cloud)</span>
              </div>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  serverOnline ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                title={serverOnline ? 'Server Online' : 'Server Offline'}
              />
            </button>

            <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border-subtle)]/70">
              <button
                type="button"
                onClick={handleCycleTheme}
                className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-tactile cursor-pointer w-full justify-between"
              >
                <div className="flex items-center gap-2">
                  {theme === 'dark' ? (
                    <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />
                  ) : theme === 'white' ? (
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-[var(--accent)]" />
                  )}
                  <span>Tema Tampilan</span>
                </div>
                <span className="font-semibold text-[var(--text-primary)]">
                  {themeLabelMap[theme]}
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
