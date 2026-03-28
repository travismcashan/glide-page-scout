import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, MessageSquare, Globe, Trash2, Pencil, ChevronLeft, ChevronRight, MoreHorizontal, Send, Square, Loader2, X, Upload, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/knowledge-chat`;

type GlobalThread = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type AttachedSite = {
  session_id: string;
  domain: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  rag_documents?: any;
  web_citations?: any;
};

export default function GlobalChatPage() {
  const [threads, setThreads] = useState<GlobalThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [attachedSites, setAttachedSites] = useState<AttachedSite[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [availableSites, setAvailableSites] = useState<{ id: string; domain: string; base_url: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Load threads
  const loadThreads = useCallback(async () => {
    const { data } = await supabase
      .from('global_chat_threads')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) setThreads(data as GlobalThread[]);
  }, []);

  // Load available sites for attachment
  const loadAvailableSites = useCallback(async () => {
    const { data } = await supabase
      .from('crawl_sessions')
      .select('id, domain, base_url')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setAvailableSites(data);
  }, []);

  // Load attached sites for current thread
  const loadAttachedSites = useCallback(async (threadId: string) => {
    const { data } = await supabase
      .from('global_chat_sources')
      .select('session_id')
      .eq('thread_id', threadId);
    if (data && data.length > 0) {
      const sessionIds = data.map(d => d.session_id);
      const { data: sessions } = await supabase
        .from('crawl_sessions')
        .select('id, domain')
        .in('id', sessionIds);
      setAttachedSites((sessions || []).map(s => ({ session_id: s.id, domain: s.domain })));
    } else {
      setAttachedSites([]);
    }
  }, []);

  // Load messages for current thread
  const loadMessages = useCallback(async (threadId: string) => {
    const { data } = await supabase
      .from('global_chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as ChatMessage[]);
  }, []);

  useEffect(() => { loadThreads(); loadAvailableSites(); }, [loadThreads, loadAvailableSites]);

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
      loadAttachedSites(activeThreadId);
    } else {
      setMessages([]);
      setAttachedSites([]);
    }
  }, [activeThreadId, loadMessages, loadAttachedSites]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Create new thread
  const handleNewThread = useCallback(async () => {
    const { data, error } = await supabase
      .from('global_chat_threads')
      .insert({ title: 'New Chat' } as any)
      .select()
      .single();
    if (data) {
      setThreads(prev => [data as GlobalThread, ...prev]);
      setActiveThreadId(data.id);
    }
  }, []);

  // Attach a site
  const attachSite = useCallback(async (sessionId: string, domain: string) => {
    if (!activeThreadId) return;
    if (attachedSites.some(s => s.session_id === sessionId)) {
      toast.info(`${domain} is already attached`);
      return;
    }
    const { error } = await supabase
      .from('global_chat_sources')
      .insert({ thread_id: activeThreadId, session_id: sessionId } as any);
    if (!error) {
      setAttachedSites(prev => [...prev, { session_id: sessionId, domain }]);
      toast.success(`Added ${domain} knowledge base`);
    }
  }, [activeThreadId, attachedSites]);

  // Detach a site
  const detachSite = useCallback(async (sessionId: string) => {
    if (!activeThreadId) return;
    await supabase
      .from('global_chat_sources')
      .delete()
      .eq('thread_id', activeThreadId)
      .eq('session_id', sessionId);
    setAttachedSites(prev => prev.filter(s => s.session_id !== sessionId));
  }, [activeThreadId]);

  // Delete thread
  const handleDeleteThread = useCallback(async (threadId: string) => {
    await supabase.from('global_chat_messages').delete().eq('thread_id', threadId);
    await supabase.from('global_chat_sources').delete().eq('thread_id', threadId);
    await supabase.from('global_chat_threads').delete().eq('id', threadId);
    setThreads(prev => prev.filter(t => t.id !== threadId));
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
    }
    setDeleteConfirmId(null);
  }, [activeThreadId]);

  // Rename thread
  const handleRename = useCallback(async (threadId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    await supabase.from('global_chat_threads').update({ title: trimmed } as any).eq('id', threadId);
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title: trimmed } : t));
    setRenamingId(null);
  }, [renameValue]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeThreadId || isStreaming) return;
    const userContent = input.trim();
    setInput('');

    // Save user message
    const { data: userMsg } = await supabase
      .from('global_chat_messages')
      .insert({ thread_id: activeThreadId, role: 'user', content: userContent } as any)
      .select()
      .single();
    if (userMsg) setMessages(prev => [...prev, userMsg as ChatMessage]);

    // Get personalization from localStorage
    const tonePreset = localStorage.getItem('ai-tone-preset') || 'default';
    let characteristics: string[] = [];
    try { characteristics = JSON.parse(localStorage.getItem('ai-characteristics') || '[]'); } catch {}
    const customInstructions = localStorage.getItem('ai-custom-instructions') || '';
    let aboutMe: any = null;
    try { aboutMe = JSON.parse(localStorage.getItem('ai-about-me') || 'null'); } catch {}
    const personalBio = localStorage.getItem('ai-bio') || '';
    const myRole = localStorage.getItem('ai-role') || '';
    let locationData: any = null;
    try { locationData = JSON.parse(localStorage.getItem('ai-location') || 'null'); } catch {}

    // RAG depth settings
    const matchCount = parseInt(localStorage.getItem('ai-rag-match-count') || '50', 10);
    const matchThreshold = parseFloat(localStorage.getItem('ai-rag-match-threshold') || '0.20');

    // Build messages array
    const chatMessages = [...messages, { role: 'user' as const, content: userContent }].map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Session IDs for RAG
    const sessionIds = attachedSites.map(s => s.session_id);

    setIsStreaming(true);
    setStreamContent('');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: chatMessages,
          model: 'google/gemini-2.5-flash',
          session_ids: sessionIds.length > 0 ? sessionIds : undefined,
          sources: { documents: sessionIds.length > 0, web: false },
          rag_depth: { match_count: matchCount, match_threshold: matchThreshold },
          tonePreset,
          characteristics,
          customInstructions: customInstructions || undefined,
          aboutMe: aboutMe || undefined,
          personalBio: personalBio || undefined,
          myRole: myRole || undefined,
          locationData: locationData || undefined,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) throw new Error(`Chat failed: ${resp.status}`);

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setStreamContent(accumulated);
            }
          } catch {}
        }
      }

      // Save assistant message
      if (accumulated) {
        const { data: asstMsg } = await supabase
          .from('global_chat_messages')
          .insert({ thread_id: activeThreadId, role: 'assistant', content: accumulated } as any)
          .select()
          .single();
        if (asstMsg) setMessages(prev => [...prev, asstMsg as ChatMessage]);
      }

      // Auto-title if first message
      if (messages.length === 0 && accumulated) {
        try {
          const titleResp = await fetch(CHAT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              messages: [
                { role: 'user', content: userContent },
                { role: 'assistant', content: accumulated.slice(0, 500) },
                { role: 'user', content: 'Generate a short 3-6 word title for this conversation. Reply with ONLY the title, no quotes or formatting.' },
              ],
              model: 'google/gemini-2.5-flash-lite',
            }),
          });
          const titleReader = titleResp.body?.getReader();
          if (titleReader) {
            let title = '';
            const dec = new TextDecoder();
            while (true) {
              const { done, value } = await titleReader.read();
              if (done) break;
              const tLines = dec.decode(value, { stream: true }).split('\n');
              for (const l of tLines) {
                if (!l.startsWith('data: ')) continue;
                const p = l.slice(6);
                if (p === '[DONE]') continue;
                try { title += JSON.parse(p).choices?.[0]?.delta?.content || ''; } catch {}
              }
            }
            const cleanTitle = title.replace(/["']/g, '').trim().slice(0, 80);
            if (cleanTitle) {
              await supabase.from('global_chat_threads').update({ title: cleanTitle } as any).eq('id', activeThreadId);
              setThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, title: cleanTitle } : t));
            }
          }
        } catch {}
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error('Failed to send message');
        console.error(err);
      }
    } finally {
      setIsStreaming(false);
      setStreamContent('');
      abortRef.current = null;
    }
  }, [input, activeThreadId, isStreaming, messages, attachedSites]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamContent('');
  }, []);

  const SIDEBAR_WIDTH = sidebarCollapsed ? 48 : 280;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className="border-r border-border flex flex-col bg-muted/30 shrink-0 transition-all duration-200"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {!sidebarCollapsed ? (
            <>
              <div className="p-3 flex items-center justify-between border-b border-border">
                <span className="text-sm font-semibold">Threads</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewThread}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarCollapsed(true)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {threads.map(t => (
                  <div
                    key={t.id}
                    className={cn(
                      'group flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors',
                      t.id === activeThreadId ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                    )}
                    onClick={() => setActiveThreadId(t.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {renamingId === t.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => handleRename(t.id)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(t.id); if (e.key === 'Escape') setRenamingId(null); }}
                        className="flex-1 bg-background border border-border rounded px-1.5 py-0.5 text-xs"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 truncate">{t.title}</span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingId(t.id); setRenameValue(t.title); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(t.id); }}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                {threads.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8 px-4">
                    No threads yet. Click + to start a conversation.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center pt-3 gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarCollapsed(false)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewThread}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeThreadId ? (
            <>
              {/* Header with attached sources */}
              <div className="border-b border-border px-4 py-2 flex items-center gap-2 min-h-[48px]">
                <div className="flex items-center gap-2 flex-1 overflow-x-auto">
                  {attachedSites.map(s => (
                    <div key={s.session_id} className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium shrink-0">
                      <Globe className="h-3 w-3" />
                      {s.domain}
                      <button onClick={() => detachSite(s.session_id)} className="hover:text-destructive ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {attachedSites.length === 0 && (
                    <span className="text-xs text-muted-foreground">No knowledge sources attached — add a site to enable RAG context</span>
                  )}
                </div>

                {/* Add source dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs shrink-0">
                      <Plus className="h-3.5 w-3.5" />
                      Add Source
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Attach a Site</DropdownMenuLabel>
                    {availableSites.map(site => {
                      const alreadyAttached = attachedSites.some(a => a.session_id === site.id);
                      return (
                        <DropdownMenuItem
                          key={site.id}
                          disabled={alreadyAttached}
                          onClick={() => attachSite(site.id, site.domain)}
                          className="text-xs"
                        >
                          <Globe className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                          <span className="truncate">{site.domain}</span>
                          {alreadyAttached && <span className="ml-auto text-muted-foreground text-[10px]">Added</span>}
                        </DropdownMenuItem>
                      );
                    })}
                    {availableSites.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-3 text-center">No sites available. Crawl a site first.</p>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Coming Soon</DropdownMenuLabel>
                    <DropdownMenuItem disabled className="text-xs">
                      <Upload className="h-3.5 w-3.5 mr-2" /> Upload Document
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled className="text-xs">
                      <HardDrive className="h-3.5 w-3.5 mr-2" /> Google Drive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                  {messages.map(msg => (
                    <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : '')}>
                      {msg.role === 'assistant' && (
                        <Avatar className="h-7 w-7 shrink-0 mt-1">
                          <AvatarFallback className="text-[10px] bg-primary/15 text-primary">AI</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn(
                        'rounded-xl px-4 py-3 max-w-[85%] text-sm',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/60'
                      )}>
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Streaming */}
                  {isStreaming && streamContent && (
                    <div className="flex gap-3">
                      <Avatar className="h-7 w-7 shrink-0 mt-1">
                        <AvatarFallback className="text-[10px] bg-primary/15 text-primary">AI</AvatarFallback>
                      </Avatar>
                      <div className="rounded-xl px-4 py-3 max-w-[85%] text-sm bg-muted/60">
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamContent}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {isStreaming && !streamContent && (
                    <div className="flex gap-3">
                      <Avatar className="h-7 w-7 shrink-0 mt-1">
                        <AvatarFallback className="text-[10px] bg-primary/15 text-primary">AI</AvatarFallback>
                      </Avatar>
                      <div className="rounded-xl px-4 py-3 bg-muted/60">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input */}
              <div className="border-t border-border p-4">
                <div className="max-w-3xl mx-auto flex gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={attachedSites.length > 0
                      ? `Ask about ${attachedSites.map(s => s.domain).join(', ')}...`
                      : 'Start typing...'
                    }
                    className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm resize-none min-h-[44px] max-h-32 focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={1}
                  />
                  {isStreaming ? (
                    <Button variant="outline" size="icon" className="shrink-0 h-[44px] w-[44px]" onClick={handleStop}>
                      <div className="relative">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <Square className="h-2.5 w-2.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-current" />
                      </div>
                    </Button>
                  ) : (
                    <Button size="icon" className="shrink-0 h-[44px] w-[44px]" onClick={handleSend} disabled={!input.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <div>
                  <h2 className="text-lg font-semibold">Global Chat</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start a new conversation and attach site knowledge bases.
                  </p>
                </div>
                <Button onClick={handleNewThread} className="gap-2">
                  <Plus className="h-4 w-4" /> New Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this thread?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the conversation and all its messages.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDeleteThread(deleteConfirmId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
