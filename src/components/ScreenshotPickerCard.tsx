import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Camera, Loader2, Pause } from 'lucide-react';
import { aiApi } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';
import { isIntegrationPaused } from '@/lib/integrationState';
import { UrlSelectionList, type UrlEntry } from '@/components/UrlSelectionList';

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
    } catch (e) { console.error('Screenshot analysis failed:', e); }
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
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Camera className="h-5 w-5 text-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Screenshots</h2>
        <p className="text-xs text-muted-foreground ml-auto">5–15 key template pages</p>
      </div>
      <div className="p-6">
        {paused ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Pause className="h-4 w-4 shrink-0" />
            <span className="text-sm">Screenshots integration is paused. Enable it in Integrations.</span>
          </div>
        ) : discoveredUrls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Waiting for URL discovery...</p>
        ) : (
          <>
            {analyzing && (
              <div className="px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 mb-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                  <div>
                    <p className="font-medium text-sm">AI is selecting key template pages...</p>
                    <p className="text-xs text-muted-foreground">Identifying unique page layouts and designs</p>
                  </div>
                </div>
              </div>
            )}
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
          </>
        )}
      </div>
    </Card>
  );
}
