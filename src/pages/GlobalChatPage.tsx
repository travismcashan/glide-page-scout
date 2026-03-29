import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { KnowledgeChatCard } from '@/components/KnowledgeChatCard';
import { VERSIONS, type ModelProvider, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { Loader2 } from 'lucide-react';
import { DEFAULT_BEST, DEFAULT_REASONING, persistResolvedChatSelection, resolveStoredChatSelection } from '@/lib/chatPreferences';
import { withQueryTimeout } from '@/lib/queryTimeout';

const GLOBAL_SESSION_DOMAIN = '__global_chat__';

type AttachedSite = { session_id: string; domain: string };

export default function GlobalChatPage() {
  const [globalSession, setGlobalSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const initialChatSelectionRef = useRef(resolveStoredChatSelection());
  const initialChatSelection = initialChatSelectionRef.current;

  // Attached sites
  const [attachedSites, setAttachedSites] = useState<AttachedSite[]>([]);

  // Model state (persisted to localStorage — shared with Settings page)
  const [chatProvider, setChatProviderRaw] = useState<ModelProvider>(() => {
    return initialChatSelection.provider;
  });
  const [chatModel, setChatModel] = useState(() => {
    return initialChatSelection.model;
  });
  const [chatReasoning, setChatReasoning] = useState<ReasoningEffort>(() => {
    return initialChatSelection.reasoning;
  });

  useEffect(() => {
    persistResolvedChatSelection(initialChatSelection);
  }, [initialChatSelection]);

  const setChatProvider = useCallback((p: ModelProvider) => {
    setChatProviderRaw(p);
    // Auto-switch model to best for the new provider
    const best = DEFAULT_BEST[p] || VERSIONS[p]?.[VERSIONS[p].length - 1]?.id;
    const nextReasoning = DEFAULT_REASONING[p] || 'none';
    if (best) {
      setChatModel(best);
      persistResolvedChatSelection({
        mode: p === 'council' ? 'council' : 'individual',
        provider: p,
        model: best,
        reasoning: nextReasoning,
      });
    }
    setChatReasoning(nextReasoning);
  }, []);

  const handleModelChange = useCallback((m: string) => {
    setChatModel(m);
    persistResolvedChatSelection({
      mode: chatProvider === 'council' ? 'council' : 'individual',
      provider: chatProvider,
      model: m,
      reasoning: chatReasoning,
    });
  }, [chatProvider, chatReasoning]);

  const handleReasoningChange = useCallback((r: ReasoningEffort) => {
    setChatReasoning(r);
    persistResolvedChatSelection({
      mode: chatProvider === 'council' ? 'council' : 'individual',
      provider: chatProvider,
      model: chatModel,
      reasoning: r,
    });
  }, [chatModel, chatProvider]);

  // Load or create the global sentinel session
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: existing, error: existingError } = await withQueryTimeout(
          supabase
            .from('crawl_sessions')
            .select('id, domain, base_url, status, created_at')
            .eq('domain', GLOBAL_SESSION_DOMAIN)
            .limit(1)
            .maybeSingle(),
          12000,
          'Loading chat timed out'
        );

        if (cancelled) return;

        if (existingError) {
          throw existingError;
        }

        if (existing) {
          setGlobalSession(existing);
          return;
        }

        const { data: created, error } = await withQueryTimeout(
          supabase
            .from('crawl_sessions')
            .insert({
              domain: GLOBAL_SESSION_DOMAIN,
              base_url: 'https://global-chat',
              status: 'complete',
            } as any)
            .select('id, domain, base_url, status, created_at')
            .single(),
          12000,
          'Creating chat session timed out'
        );

        if (cancelled) return;

        if (error) {
          throw error;
        }

        setGlobalSession(created);
      } catch (error) {
        console.error('Failed to initialize global chat:', error);
        toast.error('Chat failed to load. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
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
