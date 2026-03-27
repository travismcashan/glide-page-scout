import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Database } from 'lucide-react';
import { DocumentLibrary } from '@/components/DocumentLibrary';
import { autoIngestIntegrations, autoIngestPages, autoIngestScreenshots } from '@/lib/ragIngest';

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
  const screenshotIngestRunning = useRef(false);
  const abortRef = useRef(false);

  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const runScreenshotIngest = useCallback((sessionId: string) => {
    if (screenshotIngestRunning.current || abortRef.current) return;
    screenshotIngestRunning.current = true;

    toast.info('Captioning screenshots in background…', { duration: 4000 });

    autoIngestScreenshots(sessionId).then(count => {
      if (count > 0) {
        toast.success(`Indexed ${count} screenshot${count !== 1 ? 's' : ''} into knowledge base`);
        triggerRefresh();
      }
    }).catch(err => {
      console.error('Screenshot ingest error:', err);
    }).finally(() => {
      screenshotIngestRunning.current = false;
    });
  }, [triggerRefresh]);

  const runIngest = useCallback(async () => {
    abortRef.current = false;
    setIngesting(true);
    try {
      const refreshEarly = setTimeout(() => triggerRefresh(), 500);

      const [integrationResult, pageCount] = await Promise.all([
        autoIngestIntegrations(session.id, session),
        scrapedPages.length > 0 ? autoIngestPages(session.id, scrapedPages) : Promise.resolve(0),
      ]);
      
      clearTimeout(refreshEarly);

      if (abortRef.current) {
        toast.info('Sync stopped');
        return;
      }

      const total = integrationResult.ingested + pageCount;
      if (total > 0) {
        toast.success(`Indexed ${total} document${total !== 1 ? 's' : ''} into knowledge base`);
      }
      triggerRefresh();
    } catch (err) {
      console.error('Ingest error:', err);
      if (!abortRef.current) toast.error('Failed to ingest documents');
    } finally {
      setIngesting(false);
    }

    if (!abortRef.current) {
      runScreenshotIngest(session.id);
    }
  }, [session, scrapedPages, triggerRefresh, runScreenshotIngest]);

  const stopIngest = useCallback(() => {
    abortRef.current = true;
    setIngesting(false);
    toast.info('Sync stopped — indexed documents are preserved.');
  }, []);

  // Auto-ingest on first mount
  useEffect(() => {
    if (ingestTriggeredRef.current) return;
    ingestTriggeredRef.current = true;
    runIngest();
  }, [session.id]);

  return (
    <div>
      <DocumentLibrary
        sessionId={session.id}
        refreshKey={refreshKey}
        onIngestIntegrations={runIngest}
        onStopIngestion={stopIngest}
        ingesting={ingesting}
      />
    </div>
  );
}
