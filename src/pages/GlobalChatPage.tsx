import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { KnowledgeChatCard } from '@/components/KnowledgeChatCard';
import { type ModelProvider, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { Loader2, Globe, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

const GLOBAL_SESSION_DOMAIN = '__global_chat__';

type AttachedSite = { session_id: string; domain: string };

export default function GlobalChatPage() {
  const [globalSession, setGlobalSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Attached sites
  const [attachedSites, setAttachedSites] = useState<AttachedSite[]>([]);
  const [availableSites, setAvailableSites] = useState<{ id: string; domain: string }[]>([]);
  const [showSitePicker, setShowSitePicker] = useState(false);

  // Model state (persisted to localStorage)
  const [chatProvider, setChatProviderRaw] = useState<ModelProvider>(() => {
    return (localStorage.getItem('chat-provider') as ModelProvider) || 'gemini';
  });
  const [chatModel, setChatModel] = useState(() => {
    return localStorage.getItem('chat-model') || 'google/gemini-3.1-pro-preview';
  });
  const [chatReasoning, setChatReasoning] = useState<ReasoningEffort>(() => {
    const savedProvider = (localStorage.getItem('chat-provider') as ModelProvider) || 'gemini';
    return savedProvider === 'claude' ? 'high' : savedProvider === 'perplexity' ? 'none' : 'medium';
  });

  const setChatProvider = useCallback((p: ModelProvider) => {
    setChatProviderRaw(p);
    localStorage.setItem('chat-provider', p);
  }, []);

  const handleModelChange = useCallback((m: string) => {
    setChatModel(m);
    localStorage.setItem('chat-model', m);
  }, []);

  const handleReasoningChange = useCallback((r: ReasoningEffort) => {
    setChatReasoning(r);
  }, []);

  // Load or create the global sentinel session
  useEffect(() => {
    const init = async () => {
      // Check for existing global session
      const { data: existing } = await supabase
        .from('crawl_sessions')
        .select('*')
        .eq('domain', GLOBAL_SESSION_DOMAIN)
        .limit(1)
        .single();

      if (existing) {
        setGlobalSession(existing);
        setLoading(false);
        return;
      }

      // Create sentinel session
      const { data: created, error } = await supabase
        .from('crawl_sessions')
        .insert({
          domain: GLOBAL_SESSION_DOMAIN,
          base_url: 'https://global-chat',
          status: 'complete',
        } as any)
        .select()
        .single();

      if (error) {
        console.error('Failed to create global session:', error);
        toast.error('Failed to initialize chat');
        setLoading(false);
        return;
      }

      setGlobalSession(created);
      setLoading(false);
    };
    init();
  }, []);

  // Load available sites for attachment
  useEffect(() => {
    supabase
      .from('crawl_sessions')
      .select('id, domain')
      .neq('domain', GLOBAL_SESSION_DOMAIN)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setAvailableSites(data);
      });
  }, []);

  const handleSelectSite = useCallback((sessionId: string, domain: string) => {
    if (attachedSites.some(s => s.session_id === sessionId)) {
      toast.info(`${domain} is already attached`);
      return;
    }
    setAttachedSites(prev => [...prev, { session_id: sessionId, domain }]);
    toast.success(`Added ${domain} knowledge`);
  }, [attachedSites]);

  const handleDetachSite = useCallback((sessionId: string) => {
    setAttachedSites(prev => prev.filter(s => s.session_id !== sessionId));
  }, []);

  if (loading || !globalSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading chat…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Attached sites bar */}
      {(attachedSites.length > 0 || showSitePicker) && (
        <div className="border-b border-border px-6 py-2 flex items-center gap-2 bg-muted/30">
          <span className="text-xs text-muted-foreground font-medium mr-1">Sources:</span>
          {attachedSites.map(s => (
            <div key={s.session_id} className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium">
              <Globe className="h-3 w-3" />
              {s.domain}
              <button onClick={() => handleDetachSite(s.session_id)} className="hover:text-destructive ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <DropdownMenu open={showSitePicker} onOpenChange={setShowSitePicker}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 gap-1 text-xs rounded-full px-2">
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
              <DropdownMenuLabel className="text-xs">Attach a Site</DropdownMenuLabel>
              {availableSites.map(site => {
                const alreadyAttached = attachedSites.some(a => a.session_id === site.id);
                return (
                  <DropdownMenuItem
                    key={site.id}
                    disabled={alreadyAttached}
                    onClick={() => handleSelectSite(site.id, site.domain)}
                    className="text-xs"
                  >
                    <Globe className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <span className="truncate">{site.domain}</span>
                    {alreadyAttached && <span className="ml-auto text-muted-foreground text-[10px]">Added</span>}
                  </DropdownMenuItem>
                );
              })}
              {availableSites.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">No sites available.</p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="flex-1">
        <KnowledgeChatCard
          session={globalSession}
          pages={[]}
          selectedModel={chatModel}
          provider={chatProvider}
          reasoning={chatReasoning}
          onProviderChange={setChatProvider}
          onModelChange={handleModelChange}
          onReasoningChange={handleReasoningChange}
          globalMode
          attachedSessionIds={attachedSites.map(s => s.session_id)}
          attachedSites={attachedSites}
          onAttachSite={handleAttachSite}
          onDetachSite={handleDetachSite}
        />
      </div>
    </div>
  );
}
