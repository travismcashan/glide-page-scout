import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Camera, FileText, Layers } from 'lucide-react';
import { aiApi } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';
import { isIntegrationPaused } from '@/lib/integrationState';
import { UrlSelectionList, type UrlEntry } from '@/components/UrlSelectionList';
import { SectionCard } from '@/components/SectionCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Props = {
  sessionId: string;
  baseUrl: string;
  discoveredUrls: string[];
  existingScreenshotUrls: Set<string>;
  existingPageUrls: Set<string>;
  onPagesAdded: () => void;
};

export function PagePickerCard({ sessionId, baseUrl, discoveredUrls, existingScreenshotUrls, existingPageUrls, onPagesAdded }: Props) {
  const screenshotsPaused = isIntegrationPaused('screenshots');
  const contentPaused = isIntegrationPaused('content');
  const bothPaused = screenshotsPaused && contentPaused;

  // Screenshot state
  const [ssEntries, setSsEntries] = useState<UrlEntry[]>([]);
  const [ssSelected, setSsSelected] = useState<Set<string>>(new Set());
  const [ssAnalyzing, setSsAnalyzing] = useState(false);
  const [ssAnalysisDone, setSsAnalysisDone] = useState(false);
  const [ssSubmitting, setSsSubmitting] = useState(false);
  const [ssError, setSsError] = useState<string | null>(null);

  // Content state
  const [ctEntries, setCtEntries] = useState<UrlEntry[]>([]);
  const [ctSelected, setCtSelected] = useState<Set<string>>(new Set());
  const [ctAnalyzing, setCtAnalyzing] = useState(false);
  const [ctAnalysisDone, setCtAnalysisDone] = useState(false);
  const [ctSubmitting, setCtSubmitting] = useState(false);
  const [ctError, setCtError] = useState<string | null>(null);

  // Run both AI analyses in parallel
  useEffect(() => {
    if (discoveredUrls.length === 0) return;

    if (!screenshotsPaused && !ssAnalysisDone && !ssAnalyzing) {
      setSsEntries(discoveredUrls.map(u => ({ url: u, isRecommended: false })));
      runScreenshotAnalysis();
    }
    if (!contentPaused && !ctAnalysisDone && !ctAnalyzing) {
      setCtEntries(discoveredUrls.map(u => ({ url: u, isRecommended: false })));
      runContentAnalysis();
    }
  }, [discoveredUrls]);

  const runScreenshotAnalysis = async () => {
    setSsAnalyzing(true);
    try {
      const result = await aiApi.recommendPages(baseUrl, discoveredUrls, 'screenshots');
      if (result.success && result.recommendations?.length) {
        const recMap = new Map(result.recommendations.map(r => [r.url, r.reason]));
        setSsEntries(discoveredUrls.map(u => ({ url: u, reason: recMap.get(u), isRecommended: recMap.has(u) })));
        setSsSelected(new Set(result.recommendations.map(r => r.url)));
        toast.success(`AI selected ${result.recommendations.length} pages for screenshots`);
      }
    } catch (e) {
      console.error('Screenshot analysis failed:', e);
      setSsError(e instanceof Error ? e.message : 'AI analysis failed');
    }
    setSsAnalyzing(false);
    setSsAnalysisDone(true);
  };

  const runContentAnalysis = async () => {
    setCtAnalyzing(true);
    try {
      const result = await aiApi.recommendPages(baseUrl, discoveredUrls, 'content');
      if (result.success && result.recommendations?.length) {
        const recMap = new Map(result.recommendations.map(r => [r.url, r.reason]));
        setCtEntries(discoveredUrls.map(u => ({ url: u, reason: recMap.get(u), isRecommended: recMap.has(u) })));
        setCtSelected(new Set(result.recommendations.map(r => r.url)));
        toast.success(`AI selected ${result.recommendations.length} pages for content`);
      }
    } catch (e) {
      console.error('Content analysis failed:', e);
      setCtError(e instanceof Error ? e.message : 'AI analysis failed');
    }
    setCtAnalyzing(false);
    setCtAnalysisDone(true);
  };

  const handleScreenshotSubmit = async () => {
    const newUrls = Array.from(ssSelected).filter(u => !existingScreenshotUrls.has(u));
    if (newUrls.length === 0) { toast.info('All selected pages already queued'); return; }
    setSsSubmitting(true);
    try {
      const pages = newUrls.map(url => ({ session_id: sessionId, url, status: 'pending' }));
      const { error } = await supabase.from('crawl_pages').insert(pages);
      if (error) throw error;
      await supabase.from('crawl_sessions').update({ status: 'crawling' }).eq('id', sessionId);
      toast.success(`Queued ${newUrls.length} pages for screenshots`);
      onPagesAdded();
    } catch (e) { console.error(e); toast.error('Failed to queue screenshots'); }
    setSsSubmitting(false);
  };

  const handleContentSubmit = async () => {
    const newUrls = Array.from(ctSelected).filter(u => !existingPageUrls.has(u));
    if (newUrls.length === 0) { toast.info('All selected pages already being processed'); return; }
    setCtSubmitting(true);
    try {
      const pages = newUrls.map(url => ({ session_id: sessionId, url, status: 'pending' }));
      const { error } = await supabase.from('crawl_pages').insert(pages);
      if (error) throw error;
      await supabase.from('crawl_sessions').update({ status: 'crawling' }).eq('id', sessionId);
      toast.success(`Queued ${newUrls.length} pages for content scraping`);
      onPagesAdded();
    } catch (e) { console.error(e); toast.error('Failed to queue content pages'); }
    setCtSubmitting(false);
  };

  if (bothPaused) return null;

  const isLoading = (ssAnalyzing || ctAnalyzing) && discoveredUrls.length > 0;
  const loadingText = ssAnalyzing && ctAnalyzing
    ? 'AI is selecting pages for screenshots & content...'
    : ssAnalyzing
      ? 'AI is selecting key template pages...'
      : 'AI is selecting content-rich pages...';

  const hasError = !!(ssError || ctError);
  const errorText = ssError || ctError || undefined;

  const defaultTab = screenshotsPaused ? 'content' : 'screenshots';

  return (
    <SectionCard
      title="Page Selection"
      icon={<Layers className="h-5 w-5 text-foreground" />}
      loading={isLoading}
      loadingText={loadingText}
      error={hasError && !isLoading}
      errorText={errorText}
      headerExtra={<span className="text-xs text-muted-foreground">Select pages for screenshots & content</span>}
    >
      {discoveredUrls.length === 0 ? (
        <p className="text-sm text-muted-foreground">Waiting for URL discovery...</p>
      ) : !isLoading ? (
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {!screenshotsPaused && (
              <TabsTrigger value="screenshots" className="gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                Screenshots
              </TabsTrigger>
            )}
            {!contentPaused && (
              <TabsTrigger value="content" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Content
              </TabsTrigger>
            )}
          </TabsList>

          {!screenshotsPaused && (
            <TabsContent value="screenshots" className="mt-3">
              <p className="text-xs text-muted-foreground mb-3">5–15 key template pages for visual reference</p>
              <UrlSelectionList
                entries={ssEntries}
                selectedUrls={ssSelected}
                setSelectedUrls={setSsSelected}
                existingUrls={existingScreenshotUrls}
                existingLabel="Queued"
                onSubmit={handleScreenshotSubmit}
                submitLabel="Queue Screenshots"
                isSubmitting={ssSubmitting}
                isAnalyzing={ssAnalyzing}
                analysisDone={ssAnalysisDone}
              />
            </TabsContent>
          )}

          {!contentPaused && (
            <TabsContent value="content" className="mt-3">
              <p className="text-xs text-muted-foreground mb-3">All business-relevant pages for content scraping</p>
              <UrlSelectionList
                entries={ctEntries}
                selectedUrls={ctSelected}
                setSelectedUrls={setCtSelected}
                existingUrls={existingPageUrls}
                existingLabel="Queued"
                onSubmit={handleContentSubmit}
                submitLabel="Queue Content"
                isSubmitting={ctSubmitting}
                isAnalyzing={ctAnalyzing}
                analysisDone={ctAnalysisDone}
              />
            </TabsContent>
          )}
        </Tabs>
      ) : null}
    </SectionCard>
  );
}
