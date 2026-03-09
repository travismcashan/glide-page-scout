import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Camera, ExternalLink, Maximize2, X, Rows3, Grid2x2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';
import { isIntegrationPaused } from '@/lib/integrationState';
import { UrlSelectionList, type UrlEntry } from '@/components/UrlSelectionList';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type GalleryPage = {
  id: string;
  url: string;
  title: string | null;
  screenshot_url: string | null;
};

type Props = {
  pages: GalleryPage[];
  sessionId: string;
  baseUrl: string;
  discoveredUrls: string[];
  existingScreenshotUrls: Set<string>;
  onPagesAdded: () => void;
  collapsed?: boolean;
};

const STORAGE_KEY = 'screenshot-gallery-mode';

export function ScreenshotGallery({ pages, sessionId, baseUrl, discoveredUrls, existingScreenshotUrls, onPagesAdded, collapsed: controlledCollapsed }: Props) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [hasOverride, setHasOverride] = useState(false);

  useEffect(() => {
    if (controlledCollapsed !== undefined) setHasOverride(false);
  }, [controlledCollapsed]);

  const isCollapsed = hasOverride ? internalCollapsed : (controlledCollapsed ?? internalCollapsed);
  const [selectedPage, setSelectedPage] = useState<GalleryPage | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [condensed, setCondensed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== 'full'; } catch { return true; }
  });
  const paused = isIntegrationPaused('screenshots');

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [entries, setEntries] = useState<UrlEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, condensed ? 'condensed' : 'full'); } catch {}
  }, [condensed]);

  // Auto-run analysis when picker opens for first time
  useEffect(() => {
    if (!pickerOpen || analysisDone || analyzing || paused || discoveredUrls.length === 0) return;
    setEntries(discoveredUrls.map(u => ({ url: u, isRecommended: false })));
    runAnalysis();
  }, [pickerOpen, discoveredUrls]);

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
    }
    setAnalyzing(false);
    setAnalysisDone(true);
  };

  const handleSubmit = async () => {
    const newUrls = Array.from(selected).filter(u => !existingScreenshotUrls.has(u));
    if (newUrls.length === 0) { toast.info('All selected pages already captured'); return; }
    setSubmitting(true);
    try {
      const rows = newUrls.map(url => ({ session_id: sessionId, url, status: 'pending' }));
      const { error } = await supabase.from('crawl_pages').insert(rows);
      if (error) throw error;
      await supabase.from('crawl_sessions').update({ status: 'crawling' }).eq('id', sessionId);
      toast.success(`Taking ${newUrls.length} screenshots`);
      onPagesAdded();
    } catch (e) { console.error(e); toast.error('Failed to queue screenshots'); }
    setSubmitting(false);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div
          className="px-6 py-4 border-b border-border flex items-center gap-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
          onClick={() => { setHasOverride(true); setInternalCollapsed(!isCollapsed); }}
        >
          <div className="p-2 rounded-lg bg-muted">
            <Camera className="h-5 w-5 text-foreground" />
          </div>
          <h2 className="text-lg font-semibold">Screenshots</h2>
          <div className="flex items-center gap-2 ml-auto" onClick={e => e.stopPropagation()}>
            <span className="text-sm text-muted-foreground">{pages.length} pages</span>
            {!paused && discoveredUrls.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setPickerOpen(!pickerOpen)}>
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                Add Pages
              </Button>
            )}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setCondensed(true)}
                className={`p-1.5 transition-colors ${condensed ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                title="Condensed view"
              >
                <Grid2x2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setCondensed(false)}
                className={`p-1.5 transition-colors ${!condensed ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                title="Full view"
              >
                <Rows3 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="shrink-0">
            {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Inline picker */}
        {!isCollapsed && pickerOpen && (
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-3">Select pages to capture screenshots (5–15 key template pages)</p>
            {analyzing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI is selecting key template pages...
              </div>
            ) : discoveredUrls.length > 0 ? (
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
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for URL discovery...</p>
            )}
          </div>
        )}

        {!isCollapsed && pages.length > 0 ? (
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pages.map(page => (
                <div
                  key={page.id}
                  className="cursor-pointer group rounded-lg border border-border overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
                  onClick={() => setSelectedPage(page)}
                >
                  <div className={`relative overflow-hidden ${condensed ? 'h-[280px]' : ''}`}>
                    <img
                      src={page.screenshot_url!}
                      alt={`Screenshot of ${page.title || page.url}`}
                      className="w-full block"
                      loading="lazy"
                    />
                    {condensed && (
                      <>
                        <div className="absolute bottom-0 left-0 right-0">
                          <svg viewBox="0 0 400 32" preserveAspectRatio="none" className="w-full h-6 block">
                            <path
                              d="M0,16 L10,8 L20,20 L30,6 L40,18 L50,10 L60,22 L70,8 L80,16 L90,6 L100,20 L110,10 L120,18 L130,4 L140,16 L150,8 L160,22 L170,10 L180,18 L190,6 L200,16 L210,8 L220,20 L230,6 L240,18 L250,10 L260,22 L270,8 L280,16 L290,6 L300,20 L310,10 L320,18 L330,4 L340,16 L350,8 L360,22 L370,10 L380,18 L390,6 L400,16 L400,32 L0,32 Z"
                              className="fill-background"
                            />
                          </svg>
                        </div>
                        <div className="absolute bottom-5 left-0 right-0 h-12 bg-gradient-to-t from-background/60 to-transparent" />
                      </>
                    )}
                    <div className="absolute inset-0 bg-background/0 group-hover:bg-background/10 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-full p-2">
                        <Maximize2 className="h-4 w-4 text-foreground" />
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-muted/30">
                    <p className="text-xs font-medium truncate">{page.title || page.url}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{page.url}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !isCollapsed && !paused ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No screenshots yet. {discoveredUrls.length > 0 && !pickerOpen && (
              <button onClick={() => setPickerOpen(true)} className="text-primary underline underline-offset-2">Select pages to capture.</button>
            )}
          </div>
        ) : null}
      </Card>

      {/* Medium view dialog */}
      <Dialog open={!!selectedPage && !fullscreen} onOpenChange={(open) => { if (!open) setSelectedPage(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0 gap-0">
          {selectedPage && (
            <>
              <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-4">
                  <p className="font-medium text-sm truncate">{selectedPage.title || selectedPage.url}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{selectedPage.url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={selectedPage.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3 w-3 mr-1" /> Visit
                    </Button>
                  </a>
                  <Button variant="outline" size="sm" onClick={() => setFullscreen(true)}>
                    <Maximize2 className="h-3 w-3 mr-1" /> Full
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <img
                  src={selectedPage.screenshot_url!}
                  alt={`Screenshot of ${selectedPage.title || selectedPage.url}`}
                  className="w-full rounded-lg border border-border"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen overlay */}
      {fullscreen && selectedPage && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="min-w-0 flex-1 mr-4">
              <p className="font-medium">{selectedPage.title || selectedPage.url}</p>
              <p className="text-xs text-muted-foreground font-mono">{selectedPage.url}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href={selectedPage.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" /> Visit
                </Button>
              </a>
              <Button variant="outline" size="icon" onClick={() => { setFullscreen(false); setSelectedPage(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6 flex justify-center">
            <img
              src={selectedPage.screenshot_url!}
              alt={`Screenshot of ${selectedPage.title || selectedPage.url}`}
              className="max-w-full h-auto object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
