import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Database, BookOpen } from 'lucide-react';
import { DocumentLibrary } from '@/components/DocumentLibrary';
import { KnowledgeChatCard } from '@/components/KnowledgeChatCard';
import { SectionCard } from '@/components/SectionCard';
import { ChatModelSelector, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { autoIngestIntegrations, autoIngestPages } from '@/lib/ragIngest';

type Props = {
  session: Record<string, any> & { id: string; domain: string; base_url: string };
  scrapedPages: { url: string; title: string | null; ai_outline: string | null; raw_content: string | null; screenshot_url?: string | null }[];
  chatModel: string;
  chatReasoning: ReasoningEffort;
  setChatModel: (m: string) => void;
  setChatReasoning: (r: ReasoningEffort) => void;
  isSectionCollapsed: (id: string) => boolean;
  toggleSection: (id: string, collapsed: boolean) => void;
  allCollapsed: boolean;
};

export function KnowledgeTabContent({
  session,
  scrapedPages,
  chatModel,
  chatReasoning,
  setChatModel,
  setChatReasoning,
  isSectionCollapsed,
  toggleSection,
  allCollapsed,
}: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [ingesting, setIngesting] = useState(false);
  const ingestTriggeredRef = useRef(false);

  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const runIngest = useCallback(async () => {
    setIngesting(true);
    try {
      const [integrationResult, pageCount] = await Promise.all([
        autoIngestIntegrations(session.id, session),
        scrapedPages.length > 0 ? autoIngestPages(session.id, scrapedPages) : Promise.resolve(0),
      ]);
      
      const total = integrationResult.ingested + pageCount;
      if (total > 0) {
        toast.success(`Indexed ${total} document${total !== 1 ? 's' : ''} into knowledge base`);
      } else if (integrationResult.skipped > 0) {
        toast.info('All integration data already indexed');
      } else {
        toast.info('No integration data available to index');
      }
      triggerRefresh();
    } catch (err) {
      console.error('Ingest error:', err);
      toast.error('Failed to ingest documents');
    } finally {
      setIngesting(false);
    }
  }, [session, scrapedPages, triggerRefresh]);

  // Auto-ingest on first mount
  useEffect(() => {
    if (ingestTriggeredRef.current) return;
    ingestTriggeredRef.current = true;
    runIngest();
  }, [session.id]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
      {/* Document Library sidebar */}
      <div className="border rounded-lg p-4 h-[700px]">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Database className="h-4 w-4" />
          Document Library
        </h3>
        <DocumentLibrary
          sessionId={session.id}
          refreshKey={refreshKey}
          onIngestIntegrations={runIngest}
          ingesting={ingesting}
        />
      </div>

      {/* Chat */}
      <SectionCard
        sectionId="knowledge-chat"
        persistedCollapsed={isSectionCollapsed("knowledge-chat")}
        onCollapseChange={toggleSection}
        title="Knowledge Chat"
        icon={<BookOpen className="h-5 w-5 text-foreground" />}
        collapsed={allCollapsed}
        headerExtra={
          <ChatModelSelector
            model={chatModel}
            reasoning={chatReasoning}
            onModelChange={setChatModel}
            onReasoningChange={setChatReasoning}
          />
        }
      >
        <KnowledgeChatCard session={session} pages={scrapedPages} selectedModel={chatModel} reasoning={chatReasoning} />
      </SectionCard>
    </div>
  );
}
