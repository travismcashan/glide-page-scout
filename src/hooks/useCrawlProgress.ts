import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Phase 1 integration keys */
const PHASE1_KEYS = new Set([
  'builtwith', 'semrush', 'psi', 'detectzestack', 'gtmetrix', 'carbon',
  'crux', 'wave', 'observatory', 'httpstatus', 'w3c', 'schema', 'readable',
  'yellowlab', 'ocean', 'hubspot', 'sitemap', 'nav-structure', 'firecrawl-map',
  'avoma', 'apollo',
]);

/** Phase 2 integration keys */
const PHASE2_KEYS = new Set(['tech-analysis', 'content-types', 'forms', 'link-checker']);

/** Phase 3 integration keys */
const PHASE3_KEYS = new Set(['apollo-team', 'page-tags']);

export interface CrawlProgress {
  total: number;
  done: number;
  failed: number;
  running: number;
  skipped: number;
  pending: number;
  percent: number;
  currentPhase: 1 | 2 | 3 | null;
  phaseLabel: string;
}

const DEFAULT_PROGRESS: CrawlProgress = {
  total: 0, done: 0, failed: 0, running: 0, skipped: 0, pending: 0,
  percent: 0, currentPhase: null, phaseLabel: '',
};

function derivePhase(runs: { integration_key: string; status: string }[]): 1 | 2 | 3 | null {
  const runningKeys = runs.filter(r => r.status === 'running').map(r => r.integration_key);
  const pendingKeys = runs.filter(r => r.status === 'pending').map(r => r.integration_key);
  const activeKeys = [...runningKeys, ...pendingKeys];

  if (activeKeys.some(k => PHASE3_KEYS.has(k))) return 3;
  if (activeKeys.some(k => PHASE2_KEYS.has(k))) return 2;
  if (activeKeys.some(k => PHASE1_KEYS.has(k))) return 1;
  return null;
}

function phaseLabel(phase: 1 | 2 | 3 | null): string {
  switch (phase) {
    case 1: return 'Scanning & enriching...';
    case 2: return 'Analyzing pages...';
    case 3: return 'Final enrichment...';
    default: return '';
  }
}

export function useCrawlProgress(sessionId: string | null): CrawlProgress {
  const [progress, setProgress] = useState<CrawlProgress>(DEFAULT_PROGRESS);

  const compute = useCallback((runs: { integration_key: string; status: string }[]) => {
    if (!runs.length) return DEFAULT_PROGRESS;

    const countable = runs.filter(r => r.status !== 'skipped');
    const done = countable.filter(r => r.status === 'done').length;
    const failed = countable.filter(r => r.status === 'failed').length;
    const running = countable.filter(r => r.status === 'running').length;
    const pending = countable.filter(r => r.status === 'pending').length;
    const total = countable.length;
    const percent = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
    const phase = derivePhase(runs);

    return {
      total,
      done,
      failed,
      running,
      skipped: runs.length - total,
      pending,
      percent,
      currentPhase: phase,
      phaseLabel: phaseLabel(phase),
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!sessionId) return;

    const fetchRuns = async () => {
      const { data } = await supabase
        .from('integration_runs')
        .select('integration_key, status')
        .eq('session_id', sessionId);
      if (data) setProgress(compute(data as any));
    };

    fetchRuns();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`crawl-progress-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'integration_runs',
          filter: `session_id=eq.${sessionId}`,
        },
        () => { fetchRuns(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, compute]);

  return progress;
}
