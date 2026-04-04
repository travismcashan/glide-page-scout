import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DocumentLibrary } from '@/components/DocumentLibrary';
import { BrandLoader } from '@/components/BrandLoader';
import { withQueryTimeout } from '@/lib/queryTimeout';
import { autoIngestIntegrations } from '@/lib/ragIngest';

const GLOBAL_SESSION_DOMAIN = '__global_chat__';

export default function KnowledgePage() {
  const [globalSession, setGlobalSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ingesting, setIngesting] = useState(false);
  const ingestTriggeredRef = useRef(false);
  const abortRef = useRef(false);

  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Load or create the global sentinel session (same as GlobalChatPage)
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
          'Loading knowledge timed out'
        );

        if (cancelled) return;
        if (existingError) throw existingError;

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
          'Creating knowledge session timed out'
        );

        if (cancelled) return;
        if (error) throw error;

        setGlobalSession(created);
      } catch (error) {
        console.error('Failed to initialize knowledge:', error);
        toast.error('Knowledge failed to load. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  const runIngest = useCallback(async () => {
    if (!globalSession) return;
    abortRef.current = false;
    setIngesting(true);
    try {
      const result = await autoIngestIntegrations(globalSession.id, globalSession);
      if (abortRef.current) {
        toast.info('Sync stopped');
        return;
      }
      if (result.ingested > 0) {
        toast.success(`Indexed ${result.ingested} document${result.ingested !== 1 ? 's' : ''} into knowledge base`);
      }
      triggerRefresh();
    } catch (err) {
      console.error('Ingest error:', err);
      if (!abortRef.current) toast.error('Failed to ingest documents');
    } finally {
      setIngesting(false);
    }
  }, [globalSession, triggerRefresh]);

  const stopIngest = useCallback(() => {
    abortRef.current = true;
    setIngesting(false);
    toast.info('Sync stopped — indexed documents are preserved.');
  }, []);

  if (loading || !globalSession) {
    return (
      <div className="flex flex-col">
        <div className="flex-1 flex items-center justify-center animate-in fade-in duration-300">
          <BrandLoader size={96} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 w-full px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Knowledge</h1>
          <p className="text-sm text-muted-foreground mt-1">Documents, transcripts, and research across all companies.</p>
        </div>
        <DocumentLibrary
          sessionId={globalSession.id}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  );
}
