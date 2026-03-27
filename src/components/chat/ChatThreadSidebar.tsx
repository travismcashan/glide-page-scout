import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, MessageSquare, MoreHorizontal, Trash2, Pencil, Pin, ChevronLeft, ChevronRight } from 'lucide-react';
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

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 40;

export function ChatThreadSidebar({ sessionId, activeThreadId, onSelectThread, onNewThread, onDeleteThread, refreshKey, onWidthChange, stickyTabVisible }: Props) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const loadThreads = useCallback(async () => {
    const { data } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false });
    if (data) setThreads(data as ChatThread[]);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads, refreshKey]);

  useEffect(() => {
    onWidthChange?.(collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
  }, [collapsed, onWidthChange]);

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
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title: trimmed } : t));
    setRenamingId(null);
  }, [renameValue]);

  const handlePin = useCallback(async (threadId: string) => {
    // Move to top by setting updated_at to far future
    const pinTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString();
    await supabase.from('chat_threads').update({ updated_at: pinTime } as any).eq('id', threadId);
    loadThreads();
  }, [loadThreads]);

  return (
    <div
      className="flex flex-col border-r border-border bg-muted/30 overflow-hidden transition-all duration-300 ease-in-out sticky self-start"
      style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH, minWidth: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH, maxHeight: stickyTabVisible ? 'calc(100vh - 64px)' : '100vh', top: stickyTabVisible ? 64 : 0 }}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 pt-3 px-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(false)}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            title="Show chat history"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewThread}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
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
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                title="New chat"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
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
                            onClick={() => onDeleteThread(thread.id)}
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
    </div>
  );
}
