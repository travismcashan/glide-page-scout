import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { KnowledgeChatCard } from '@/components/KnowledgeChatCard';
import { type ModelProvider, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { Loader2 } from 'lucide-react';

const GLOBAL_SESSION_DOMAIN = '__global_chat__';

type AttachedSite = { session_id: string; domain: string };

export default function GlobalChatPage() {
  const [globalSession, setGlobalSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Attached sites
  const [attachedSites, setAttachedSites] = useState<AttachedSite[]>([]);


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
          onSelectSite={handleSelectSite}
          onDetachSite={handleDetachSite}
        />
      </div>
    </div>
  );
}
