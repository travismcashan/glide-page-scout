import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useChatThreads, useInvalidateChatThreads } from '@/hooks/useCachedQueries';
import { Plus, MessageSquare, MoreHorizontal, Trash2, Pencil, Pin, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export type ChatThread = {
  id: string;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  pinned?: boolean;
};

type Props = {
  sessionId: string;
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteThread: (threadId: string) => void;
  refreshKey?: number;
  onWidthChange?: (width: number) => void;
  stickyTabVisible?: boolean;
};

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;
const COLLAPSED_WIDTH = 40;
const SIDEBAR_WIDTH_KEY = 'chat-sidebar-width';

export function ChatThreadSidebar({ sessionId, activeThreadId, onSelectThread, onNewThread, onDeleteThread, refreshKey, onWidthChange, stickyTabVisible }: Props) {
  const { threads, loading } = useChatThreads(sessionId, refreshKey);
  const invalidateThreads = useInvalidateChatThreads();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedWidth, setExpandedWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      if (stored) {
        const w = parseInt(stored, 10);
        if (w >= MIN_WIDTH && w <= MAX_WIDTH) return w;
      }
    } catch {}
    return DEFAULT_WIDTH;
  });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    onWidthChange?.(collapsed ? COLLAPSED_WIDTH : expandedWidth);
  }, [collapsed, expandedWidth, onWidthChange]);

  // Drag-to-resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = expandedWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)));
      setExpandedWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [expandedWidth]);

  // Persist width changes to localStorage (covers drag updates)
  useEffect(() => {
    if (!collapsed) {
      try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(expandedWidth)); } catch {}
    }
  }, [expandedWidth, collapsed]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleRename = useCallback(async (threadId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    await supabase.from('chat_threads').update({ title: trimmed } as any).eq('id', threadId);
    invalidateThreads(sessionId);
    setRenamingId(null);
  }, [renameValue, invalidateThreads, sessionId]);

  const handlePin = useCallback(async (threadId: string) => {
    // Move to top by setting updated_at to far future
    const pinTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString();
    await supabase.from('chat_threads').update({ updated_at: pinTime } as any).eq('id', threadId);
    invalidateThreads(sessionId);
  }, [invalidateThreads, sessionId]);

  const currentWidth = collapsed ? COLLAPSED_WIDTH : expandedWidth;

  return (
    <div
      className={cn("flex flex-col bg-muted/30 overflow-hidden sticky self-start relative", !isResizing && 'transition-all duration-300 ease-in-out')}
      style={{ width: currentWidth, minWidth: currentWidth, height: stickyTabVisible ? 'calc(100vh - 64px)' : 'calc(100vh - 55px)', maxHeight: stickyTabVisible ? 'calc(100vh - 64px)' : 'calc(100vh - 55px)', top: stickyTabVisible ? 64 : 55 }}
    >
      {collapsed ? (
        <div
          className="flex flex-col items-center gap-2 pt-3 px-1 h-full cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setCollapsed(false)}
          title="Show chat history"
        >
          <div className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground">
            <PanelLeftOpen className="h-5 w-5" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onNewThread(); }}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            title="New chat"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chats</span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={onNewThread}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                title="New chat"
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3 -space-y-px">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Loading…</span>
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">No conversations yet</span>
              </div>
            ) : (
              threads.map(thread => (
                <button
                  key={thread.id}
                  onClick={() => renamingId !== thread.id && onSelectThread(thread.id)}
                  className={cn(
                    'group w-full text-left px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 relative',
                    thread.id === activeThreadId
                      ? 'bg-muted text-foreground'
                      : 'hover:bg-muted/50 text-foreground'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    {renamingId === thread.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRename(thread.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(thread.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="w-full text-sm font-medium bg-background border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-ring"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="truncate font-medium" style={{ fontSize: 15 }}>{thread.title}</div>
                    )}
                  </div>
                  {renamingId !== thread.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted-foreground/10 text-muted-foreground transition-all shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => {
                          setRenameValue(thread.title);
                          setRenamingId(thread.id);
                        }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePin(thread.id)}>
                          <Pin className="h-3.5 w-3.5 mr-2" />
                          Pin to top
                        </DropdownMenuItem>
                        {threads.length > 1 && (
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirmId(thread.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  onDeleteThread(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resize handle — right edge */}
      <div
        className={cn(
          "absolute top-0 right-0 h-full z-10 transition-colors",
          collapsed
            ? "w-px bg-border"
            : "w-1 cursor-col-resize bg-border hover:bg-primary/40 active:bg-primary/60"
        )}
        onMouseDown={collapsed ? undefined : handleResizeStart}
      />
    </div>
  );
}
