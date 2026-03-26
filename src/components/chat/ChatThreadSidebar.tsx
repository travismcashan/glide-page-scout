import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export type ChatThread = {
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
  onWidthChange?: (width: number) => void;
};

export function ChatThreadSidebar({ sessionId, activeThreadId, onSelectThread, onNewThread, onDeleteThread, refreshKey, onWidthChange }: Props) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

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

  // Notify parent of width changes
  useEffect(() => {
    onWidthChange?.(collapsed ? 40 : 240);
  }, [collapsed, onWidthChange]);

  if (collapsed) {
    return (
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
    );
  }

  return (
    <div className="flex flex-col h-full w-[240px] min-w-[240px] border-r border-border bg-muted/30">
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
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-muted-foreground">Loading…</span>
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">No conversations yet</span>
          </div>
        ) : (
          threads.map(thread => (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={cn(
                'group w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 relative',
                thread.id === activeThreadId
                  ? 'bg-muted text-foreground'
                  : 'hover:bg-muted/50 text-foreground'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate text-xs font-medium">{thread.title}</div>
              </div>
              {threads.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteThread(thread.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  title="Delete chat"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
