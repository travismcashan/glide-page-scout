import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, MessageSquare } from 'lucide-react';
import { KnowledgeChatCard } from '@/components/KnowledgeChatCard';
import { VERSIONS, type ModelProvider, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DEFAULT_BEST, DEFAULT_REASONING, persistResolvedChatSelection, resolveStoredChatSelection } from '@/lib/chatPreferences';
import { withQueryTimeout } from '@/lib/queryTimeout';
import { buildCrawlContext } from '@/lib/buildCrawlContext';

const GROUP_CHAT_DOMAIN = '__group_chat__';

type AttachedSite = { session_id: string; domain: string };

type Props = {
  groupId: string;
  groupName: string;
  members: { session_id: string; domain: string }[];
  /** Full session data for building crawl context */
  sessions?: any[];
};

export function GroupChatTab({ groupId, groupName, members, sessions }: Props) {
  const [chatSession, setChatSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const initialChatSelectionRef = useRef(resolveStoredChatSelection());
  const initialChatSelection = initialChatSelectionRef.current;

  const [chatProvider, setChatProviderRaw] = useState<ModelProvider>(() => initialChatSelection.provider);
  const [chatModel, setChatModel] = useState(() => initialChatSelection.model);
  const [chatReasoning, setChatReasoning] = useState<ReasoningEffort>(() => initialChatSelection.reasoning);

  useEffect(() => {
    persistResolvedChatSelection(initialChatSelection);
  }, [initialChatSelection]);

  const setChatProvider = useCallback((p: ModelProvider) => {
    setChatProviderRaw(p);
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

  // Build the attached sites list from group members
  const attachedSites: AttachedSite[] = members.map(m => ({
    session_id: m.session_id,
    domain: m.domain,
  }));

  // Build combined crawl context from all group sessions so the AI always has
  // the raw audit data, even if RAG chunks haven't been ingested yet.
  const combinedCrawlContext = useMemo(() => {
    if (!sessions?.length) return '';
    const parts: string[] = [
      `This is a group chat for "${groupName}" containing ${sessions.length} sites.`,
      `Sites in group: ${sessions.map(s => s.domain).join(', ')}\n`,
    ];
    for (const s of sessions) {
      const ctx = buildCrawlContext(s, []);
      if (ctx) {
        parts.push(`\n========== SITE: ${s.domain} ==========\n`);
        parts.push(ctx);
      }
    }
    return parts.join('\n');
  }, [sessions, groupName]);

  // Create or find a sentinel session for group chat
  useEffect(() => {
    let cancelled = false;
    const groupDomain = `${GROUP_CHAT_DOMAIN}:${groupId}`;

    const init = async () => {
      try {
        const { data: existing, error: existingError } = await withQueryTimeout(
          supabase
            .from('crawl_sessions')
            .select('id, domain, base_url, status, created_at')
            .eq('domain', groupDomain)
            .limit(1)
            .maybeSingle(),
          12000,
          'Loading chat timed out'
        );

        if (cancelled) return;
        if (existingError) throw existingError;

        if (existing) {
          setChatSession(existing);
          return;
        }

        // Create a new sentinel session for this group's chat
        const { data: created, error } = await withQueryTimeout(
          supabase
            .from('crawl_sessions')
            .insert({
              domain: groupDomain,
              base_url: `https://group-chat/${groupId}`,
              status: 'complete',
            } as any)
            .select('id, domain, base_url, status, created_at')
            .single(),
          12000,
          'Creating chat session timed out'
        );

        if (cancelled) return;
        if (error) throw error;

        setChatSession(created);
      } catch (error) {
        console.error('Failed to initialize group chat:', error);
        toast.error('Chat failed to load. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [groupId]);

  if (loading || !chatSession) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Add sites to this group to start chatting about them.</p>
      </div>
    );
  }

  return (
    <div className="relative" style={{ minHeight: 'calc(100vh - 300px)' }}>
      <ErrorBoundary fallback={
        <div className="flex items-center justify-center p-8 text-center">
          <div>
            <p className="text-muted-foreground mb-2">Chat failed to load.</p>
            <button
              className="text-sm underline text-muted-foreground hover:text-foreground"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      }>
        <KnowledgeChatCard
          session={chatSession}
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
          onThreadTitleChange={() => {}}
          crawlContextOverride={combinedCrawlContext}
        />
      </ErrorBoundary>
    </div>
  );
}
