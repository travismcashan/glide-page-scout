import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Database } from 'lucide-react';
import { DocumentLibrary } from '@/components/DocumentLibrary';
import { autoIngestIntegrations, autoIngestPages } from '@/lib/ragIngest';

type Props = {
  session: Record<string, any> & { id: string; domain: string; base_url: string };
  scrapedPages: { url: string; title: string | null; ai_outline: string | null; raw_content: string | null; screenshot_url?: string | null }[];
};

export function KnowledgeTabContent({
  session,
  scrapedPages,
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
      }
      // Silently skip if everything is already indexed — no need to notify
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
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Database className="h-5 w-5 text-foreground" />
        <h3 className="text-lg font-semibold">Document Library</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Indexed documents from integrations, scraped pages, uploads, and chat notes. These power the AI chat's context.
      </p>
      <DocumentLibrary
        sessionId={session.id}
        refreshKey={refreshKey}
        onIngestIntegrations={runIngest}
        ingesting={ingesting}
      />
    </div>
  );
}
