import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Camera, ExternalLink, Maximize2, X, Rows3, Grid2x2, Loader2, ChevronDown, ChevronUp, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi, screenshotApi } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';
import { isIntegrationPaused } from '@/lib/integrationState';
import { UrlSelectionList, type UrlEntry } from '@/components/UrlSelectionList';

type Screenshot = {
  id: string;
  url: string;
  screenshot_url: string | null;
  status: string;
};

type Props = {
  sessionId: string;
  baseUrl: string;
  discoveredUrls: string[];
  collapsed?: boolean;
};

const STORAGE_KEY = 'screenshot-gallery-mode-v2';

export function ScreenshotGallery({ sessionId, baseUrl, discoveredUrls, collapsed: controlledCollapsed }: Props) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [hasOverride, setHasOverride] = useState(false);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (controlledCollapsed !== undefined) setHasOverride(false);
  }, [controlledCollapsed]);

  const isCollapsed = hasOverride ? internalCollapsed : (controlledCollapsed ?? internalCollapsed);
  const [selectedShot, setSelectedShot] = useState<Screenshot | null>(null);
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

  // Fetch screenshots from their own table
  const fetchScreenshots = useCallback(async () => {
    const { data } = await supabase
      .from('crawl_screenshots')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (data) setScreenshots(data as unknown as Screenshot[]);
  }, [sessionId]);

  useEffect(() => { fetchScreenshots(); }, [fetchScreenshots]);

  // Re-fetch when new screenshots are auto-queued (e.g. nav auto-crawl)
  useEffect(() => {
    const handler = () => fetchScreenshots();
    window.addEventListener('refetch-screenshots', handler);
    return () => window.removeEventListener('refetch-screenshots', handler);
  }, [fetchScreenshots]);

  // Process pending screenshots independently
  useEffect(() => {
    const pending = screenshots.filter(s => s.status === 'pending' && !processingIds.has(s.id));
    if (pending.length === 0) return;

    const processScreenshot = async (shot: Screenshot) => {
      setProcessingIds(prev => new Set([...prev, shot.id]));
      try {
        const result = await screenshotApi.getUrl(shot.url);
        if (result.success && result.screenshotUrl) {
          await supabase.from('crawl_screenshots').update({
            screenshot_url: result.screenshotUrl,
            status: 'done',
          }).eq('id', shot.id);
        } else {
          await supabase.from('crawl_screenshots').update({ status: 'error' }).eq('id', shot.id);
        }
      } catch (e) {
        console.error('Screenshot failed for:', shot.url, e);
        await supabase.from('crawl_screenshots').update({ status: 'error' }).eq('id', shot.id);
      }
      fetchScreenshots();
    };

    // Process up to 3 at a time to reduce 502 errors from Thum.io
    pending.slice(0, 3).forEach(processScreenshot);
  }, [screenshots, processingIds, fetchScreenshots]);

  const existingUrls = new Set(screenshots.map(s => s.url));
  const completedShots = screenshots.filter(s => s.screenshot_url && s.status === 'done');
  const errorShots = screenshots.filter(s => s.status === 'error');
  const pendingCount = screenshots.filter(s => s.status === 'pending').length;
  const [recapturing, setRecapturing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadAll = async () => {
    if (completedShots.length === 0) return;
    setDownloading(true);
    try {
      let count = 0;
      for (const shot of completedShots) {
        if (!shot.screenshot_url) continue;
        try {
          // Extract the storage file path from the public URL
          const storagePrefix = '/storage/v1/object/public/screenshots/';
          const idx = shot.screenshot_url.indexOf(storagePrefix);
          if (idx === -1) continue;
          const filePath = shot.screenshot_url.substring(idx + storagePrefix.length);

          // Use Supabase storage download which returns the blob directly
          const { data: blob, error } = await supabase.storage
            .from('screenshots')
            .download(filePath);
          if (error || !blob) { console.error('Download error:', error); continue; }

          const urlObj = new URL(shot.url);
          const safeName = urlObj.pathname.replace(/\//g, '_').replace(/^_/, '') || 'homepage';
          const ext = blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'jpg' : 'png';
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${urlObj.hostname}${safeName === 'homepage' ? '' : '_' + safeName}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(a.href);
          count++;
          if (count < completedShots.length) await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.error('Failed to download:', shot.url, e);
        }
      }
      toast.success(`Downloaded ${count} screenshots`);
    } catch (e) {
      console.error(e);
      toast.error('Download failed');
    }
    setDownloading(false);
  };

  // Check if any completed shots still have old Thum.io URLs (not stored in our bucket)
  const hasExpiredUrls = completedShots.some(s => s.screenshot_url?.includes('image.thum.io'));
  const recaptureCount = screenshots.filter(s => s.status === 'error' || (s.screenshot_url?.includes('image.thum.io'))).length;

  const handleRecapture = async () => {
    setRecapturing(true);
    try {
      // Reset all error shots and shots with old Thum.io URLs back to pending
      const idsToReset = screenshots
        .filter(s => s.status === 'error' || (s.screenshot_url?.includes('image.thum.io')))
        .map(s => s.id);
      if (idsToReset.length === 0) { toast.info('Nothing to re-capture'); setRecapturing(false); return; }
      for (const id of idsToReset) {
        await supabase.from('crawl_screenshots').update({ status: 'pending', screenshot_url: null }).eq('id', id);
      }
      setProcessingIds(new Set()); // clear so they get picked up again
      toast.success(`Re-capturing ${idsToReset.length} screenshots`);
      fetchScreenshots();
    } catch (e) {
      console.error(e);
      toast.error('Failed to re-capture');
    }
    setRecapturing(false);
  };

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
    const selectedArr = Array.from(selected);
    // URLs not in DB at all → insert new
    const newUrls = selectedArr.filter(u => !existingUrls.has(u));
    // URLs already in DB but errored → reset to pending
    const errorUrls = selectedArr
      .map(u => screenshots.find(s => s.url === u && s.status === 'error'))
      .filter(Boolean) as Screenshot[];
    // URLs already pending → skip
    const pendingUrls = selectedArr.filter(u => screenshots.find(s => s.url === u && s.status === 'pending'));

    if (newUrls.length === 0 && errorUrls.length === 0) {
      toast.info(pendingUrls.length > 0 ? 'Screenshots already queued — processing now' : 'All selected pages already captured');
      return;
    }

    setSubmitting(true);
    try {
      let count = 0;
      if (newUrls.length > 0) {
        const rows = newUrls.map(url => ({ session_id: sessionId, url, status: 'pending' }));
        const { error } = await supabase.from('crawl_screenshots').insert(rows);
        if (error) throw error;
        count += newUrls.length;
      }
      if (errorUrls.length > 0) {
        for (const shot of errorUrls) {
          await supabase.from('crawl_screenshots').update({ status: 'pending', screenshot_url: null }).eq('id', shot.id);
        }
        setProcessingIds(prev => {
          const next = new Set(prev);
          errorUrls.forEach(s => next.delete(s.id));
          return next;
        });
        count += errorUrls.length;
      }
      toast.success(`Taking ${count} screenshot${count !== 1 ? 's' : ''}`);
      fetchScreenshots();
    } catch (e) { console.error(e); toast.error('Failed to take screenshots'); }
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
            <span className="text-sm text-muted-foreground">
              {completedShots.length} captured
              {pendingCount > 0 && (
                <span className="ml-1 text-primary">
                  <Loader2 className="h-3 w-3 animate-spin inline mr-0.5" />
                  {pendingCount} processing
                </span>
              )}
            </span>
            {completedShots.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleDownloadAll} disabled={downloading}>
                <Download className={`h-3.5 w-3.5 mr-1.5 ${downloading ? 'animate-pulse' : ''}`} />
                {downloading ? 'Downloading...' : `Download All (${completedShots.length})`}
              </Button>
            )}
            {!paused && recaptureCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleRecapture} disabled={recapturing || pendingCount > 0}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recapturing ? 'animate-spin' : ''}`} />
                Re-capture {recaptureCount}
              </Button>
            )}
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
                existingUrls={existingUrls}
                existingLabel="Captured"
                onSubmit={handleSubmit}
                submitLabel="Take Screenshots"
                isSubmitting={submitting}
                isAnalyzing={analyzing}
                analysisDone={analysisDone}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for URL discovery...</p>
            )}
          </div>
        )}

        {!isCollapsed && completedShots.length > 0 ? (
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {completedShots.map(shot => (
                <div
                  key={shot.id}
                  className="cursor-pointer group rounded-lg border border-border overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
                  onClick={() => setSelectedShot(shot)}
                >
                  <div className={`relative overflow-hidden ${condensed ? 'max-h-[400px]' : ''}`}>
                    <img
                      src={shot.screenshot_url!}
                      alt={`Screenshot of ${shot.url}`}
                      className="w-full block"
                      loading="lazy"
                      onError={async () => {
                        await supabase.from('crawl_screenshots').update({ status: 'pending', screenshot_url: null }).eq('id', shot.id);
                        fetchScreenshots();
                      }}
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
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{shot.url}</p>
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
      <Dialog open={!!selectedShot && !fullscreen} onOpenChange={(open) => { if (!open) setSelectedShot(null); }}>
        <DialogContent className="max-w-[90vw] w-full max-h-[90vh] overflow-y-auto p-0 gap-0">
          {selectedShot && (
            <>
              <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-4">
                  <p className="text-xs text-muted-foreground font-mono truncate">{selectedShot.url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={selectedShot.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3 w-3 mr-1" /> Visit
                    </Button>
                  </a>
                  <a href={selectedShot.screenshot_url!} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <Maximize2 className="h-3 w-3 mr-1" /> Full
                    </Button>
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedShot(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <img
                  src={selectedShot.screenshot_url!}
                  alt={`Screenshot of ${selectedShot.url}`}
                  className="w-full rounded-lg border border-border"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen overlay */}
      {fullscreen && selectedShot && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="min-w-0 flex-1 mr-4">
              <p className="text-xs text-muted-foreground font-mono">{selectedShot.url}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href={selectedShot.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" /> Visit
                </Button>
              </a>
              <Button variant="outline" size="icon" onClick={() => { setFullscreen(false); setSelectedShot(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex justify-center">
            <img
              src={selectedShot.screenshot_url!}
              alt={`Screenshot of ${selectedShot.url}`}
              className="w-full"
              style={{ maxWidth: '1440px' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
