import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Plus, MoreHorizontal, Pencil, Pin, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ChatThread = {
  id: string;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  sessionId: string;
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteThread: (threadId: string) => void;
  refreshKey?: number;
};

export function MobileChatDrawer({ sessionId, activeThreadId, onSelectThread, onNewThread, onDeleteThread, refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
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
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleRename = useCallback(async (threadId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    await supabase.from('chat_threads').update({ title: trimmed } as any).eq('id', threadId);
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title: trimmed } : t));
    setRenamingId(null);
  }, [renameValue]);

  const handlePin = useCallback(async (threadId: string) => {
    const pinTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString();
    await supabase.from('chat_threads').update({ updated_at: pinTime } as any).eq('id', threadId);
    loadThreads();
  }, [loadThreads]);

  const activeTitle = threads.find(t => t.id === activeThreadId)?.title || 'Chat';

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 h-12 border-b border-border bg-background sticky top-[55px] z-30">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="p-0 bg-transparent border-none">
              <Menu className="h-6 w-6 text-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-[340px] p-0 border-none bg-background flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-14 pb-3">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recents</span>
              <button
                onClick={() => { onNewThread(); setOpen(false); }}
                className="p-2 rounded-full hover:bg-muted/50 transition-colors"
              >
                <Plus className="h-5 w-5 text-foreground" />
              </button>
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto px-3 pb-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="text-sm text-muted-foreground">Loading…</span>
                </div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageSquare className="h-6 w-6 text-muted-foreground/40 mb-3" />
                  <span className="text-base text-muted-foreground">No conversations yet</span>
                </div>
              ) : (
                <div className="flex flex-col">
                  {threads.map(thread => (
                    <div
                      key={thread.id}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-4 py-3.5 transition-colors',
                        thread.id === activeThreadId
                          ? 'bg-muted'
                          : 'active:bg-muted/50'
                      )}
                    >
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
                          className="flex-1 text-base font-medium bg-background border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <button
                          onClick={() => { onSelectThread(thread.id); setOpen(false); }}
                          className="flex-1 text-left min-w-0"
                        >
                          <span className="text-base font-medium text-foreground truncate block">
                            {thread.title}
                          </span>
                        </button>
                      )}
                      {renamingId !== thread.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-all shrink-0 ml-2"
                            >
                              <MoreHorizontal className="h-5 w-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => {
                              setRenameValue(thread.title);
                              setRenamingId(thread.id);
                            }}>
                              <Pencil className="h-4 w-4 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePin(thread.id)}>
                              <Pin className="h-4 w-4 mr-2" /> Pin to top
                            </DropdownMenuItem>
                            {threads.length > 1 && (
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirmId(thread.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
          {activeTitle}
        </span>

        <button
          onClick={onNewThread}
          className="p-0 bg-transparent border-none"
        >
          <Plus className="h-6 w-6 text-foreground" />
        </button>
      </div>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages.
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
    </>
  );
}
