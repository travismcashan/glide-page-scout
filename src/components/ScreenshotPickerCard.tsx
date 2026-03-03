import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';
import { aiApi } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';
import { isIntegrationPaused } from '@/lib/integrationState';
import { UrlSelectionList, type UrlEntry } from '@/components/UrlSelectionList';
import { SectionCard } from '@/components/SectionCard';

type Props = {
  sessionId: string;
  baseUrl: string;
  discoveredUrls: string[];
  existingScreenshotUrls: Set<string>;
  onPagesAdded: () => void;
};

export function ScreenshotPickerCard({ sessionId, baseUrl, discoveredUrls, existingScreenshotUrls, onPagesAdded }: Props) {
  const [entries, setEntries] = useState<UrlEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = isIntegrationPaused('screenshots');

  useEffect(() => {
    if (discoveredUrls.length === 0 || analysisDone || analyzing || paused) return;
    setEntries(discoveredUrls.map(u => ({ url: u, isRecommended: false })));
    runAnalysis();
  }, [discoveredUrls]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = await aiApi.recommendPages(baseUrl, discoveredUrls, 'screenshots');
      if (result.success && result.recommendations?.length) {
        const recMap = new Map(result.recommendations.map(r => [r.url, r.reason]));
        setEntries(discoveredUrls.map(u => ({ url: u, reason: recMap.get(u), isRecommended: recMap.has(u) })));
        setSelected(new Set(result.recommendations.map(r => r.url)));
        toast.success(`AI selected ${result.recommendations.length} pages for screenshots`);
      }
    } catch (e) {
      console.error('Screenshot analysis failed:', e);
      setError(e instanceof Error ? e.message : 'AI analysis failed');
    }
    setAnalyzing(false);
    setAnalysisDone(true);
  };

  const handleSubmit = async () => {
    const newUrls = Array.from(selected).filter(u => !existingScreenshotUrls.has(u));
    if (newUrls.length === 0) { toast.info('All selected pages already queued'); return; }
    setSubmitting(true);
    try {
      const pages = newUrls.map(url => ({ session_id: sessionId, url, status: 'pending' }));
      const { error } = await supabase.from('crawl_pages').insert(pages);
      if (error) throw error;
      await supabase.from('crawl_sessions').update({ status: 'crawling' }).eq('id', sessionId);
      toast.success(`Queued ${newUrls.length} pages for screenshots`);
      onPagesAdded();
    } catch (e) { console.error(e); toast.error('Failed to queue screenshots'); }
    setSubmitting(false);
  };

  return (
    <SectionCard
      title="Screenshots"
      icon={<Camera className="h-5 w-5 text-foreground" />}
      paused={paused}
      loading={analyzing && discoveredUrls.length > 0}
      loadingText="AI is selecting key template pages..."
      error={!!error}
      errorText={error || undefined}
      headerExtra={<span className="text-xs text-muted-foreground">5–15 key template pages</span>}
    >
      {discoveredUrls.length === 0 && !paused ? (
        <p className="text-sm text-muted-foreground">Waiting for URL discovery...</p>
      ) : !analyzing && discoveredUrls.length > 0 ? (
        <UrlSelectionList
          entries={entries}
          selectedUrls={selected}
          setSelectedUrls={setSelected}
          existingUrls={existingScreenshotUrls}
          existingLabel="Queued"
          onSubmit={handleSubmit}
          submitLabel="Queue Screenshots"
          isSubmitting={submitting}
          isAnalyzing={analyzing}
          analysisDone={analysisDone}
        />
      ) : null}
    </SectionCard>
  );
}
