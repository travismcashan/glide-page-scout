import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Globe, Loader2, Search, ArrowRight, Sparkles,
  CheckSquare, Square, ArrowUpDown, X, ExternalLink,
  Camera, FileText,
} from 'lucide-react';
import { firecrawlApi, aiApi } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';

type UrlEntry = {
  url: string;
  reason?: string;
  isRecommended: boolean;
};

type SortMode = 'selected-first' | 'alpha' | 'recommended-first';

type Props = {
  sessionId: string;
  baseUrl: string;
  domain: string;
  onPagesAdded: () => void;
  existingPageUrls: Set<string>;
  existingScreenshotUrls: Set<string>;
};

// Shared selection list component
function UrlSelectionList({
  entries,
  selectedUrls,
  setSelectedUrls,
  existingUrls,
  existingLabel,
  onSubmit,
  submitLabel,
  isSubmitting,
  isAnalyzing,
  analysisDone,
}: {
  entries: UrlEntry[];
  selectedUrls: Set<string>;
  setSelectedUrls: React.Dispatch<React.SetStateAction<Set<string>>>;
  existingUrls: Set<string>;
  existingLabel: string;
  onSubmit: () => void;
  submitLabel: string;
  isSubmitting: boolean;
  isAnalyzing: boolean;
  analysisDone: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('selected-first');

  const filteredAndSorted = useMemo(() => {
    let result = entries;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.url.toLowerCase().includes(q) ||
        (e.reason && e.reason.toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => {
      if (sortMode === 'selected-first') {
        const aS = selectedUrls.has(a.url) ? 0 : 1;
        const bS = selectedUrls.has(b.url) ? 0 : 1;
        if (aS !== bS) return aS - bS;
        const aR = a.isRecommended ? 0 : 1;
        const bR = b.isRecommended ? 0 : 1;
        if (aR !== bR) return aR - bR;
        return a.url.localeCompare(b.url);
      }
      if (sortMode === 'recommended-first') {
        const aR = a.isRecommended ? 0 : 1;
        const bR = b.isRecommended ? 0 : 1;
        if (aR !== bR) return aR - bR;
        return a.url.localeCompare(b.url);
      }
      return a.url.localeCompare(b.url);
    });
  }, [entries, searchQuery, sortMode, selectedUrls]);

  const toggleUrl = (pageUrl: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(pageUrl)) next.delete(pageUrl); else next.add(pageUrl);
      return next;
    });
  };

  const selectAll = () => {
    const visible = filteredAndSorted.map(e => e.url);
    setSelectedUrls(prev => { const next = new Set(prev); visible.forEach(u => next.add(u)); return next; });
  };

  const deselectAll = () => {
    const visible = new Set(filteredAndSorted.map(e => e.url));
    setSelectedUrls(prev => { const next = new Set(prev); visible.forEach(u => next.delete(u)); return next; });
  };

  const selectRecommended = () => {
    setSelectedUrls(new Set(entries.filter(e => e.isRecommended).map(e => e.url)));
  };

  const visibleSelected = filteredAndSorted.filter(e => selectedUrls.has(e.url)).length;
  const allVisibleSelected = visibleSelected === filteredAndSorted.length && filteredAndSorted.length > 0;

  const cycleSortMode = () => {
    const modes: SortMode[] = ['selected-first', 'recommended-first', 'alpha'];
    const idx = modes.indexOf(sortMode);
    setSortMode(modes[(idx + 1) % modes.length]);
  };

  const sortLabel: Record<SortMode, string> = {
    'selected-first': 'Selected first',
    'recommended-first': 'Recommended first',
    'alpha': 'A → Z',
  };

  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search URLs..."
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={allVisibleSelected ? deselectAll : selectAll} className="text-xs h-7">
            {allVisibleSelected ? <><Square className="h-3 w-3 mr-1" />Deselect All</> : <><CheckSquare className="h-3 w-3 mr-1" />Select All</>}
          </Button>
          {analysisDone && entries.some(e => e.isRecommended) && (
            <Button variant="outline" size="sm" onClick={selectRecommended} className="text-xs h-7">
              <Sparkles className="h-3 w-3 mr-1" />AI Picks
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={deselectAll} className="text-xs h-7">
            <X className="h-3 w-3 mr-1" />Clear
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cycleSortMode} className="text-xs h-7">
            <ArrowUpDown className="h-3 w-3 mr-1" />{sortLabel[sortMode]}
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={isSubmitting || selectedUrls.size === 0}>
            {isSubmitting ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing...</>
            ) : (
              <><ArrowRight className="h-3 w-3 mr-1" />{submitLabel} ({selectedUrls.size})</>
            )}
          </Button>
        </div>
      </div>

      {searchQuery && (
        <p className="text-xs text-muted-foreground">
          Showing {filteredAndSorted.length} of {entries.length} URLs
        </p>
      )}

      {/* URL List */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card p-2">
        {filteredAndSorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No URLs match "{searchQuery}"</p>
        ) : (
          filteredAndSorted.map((entry) => {
            const isSelected = selectedUrls.has(entry.url);
            const alreadyAdded = existingUrls.has(entry.url);
            return (
              <label
                key={entry.url}
                className={`flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                  alreadyAdded
                    ? 'bg-muted/50 opacity-60'
                    : isSelected
                    ? 'bg-primary/5 border border-primary/10'
                    : 'hover:bg-muted border border-transparent'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleUrl(entry.url)}
                  className="mt-0.5"
                  disabled={alreadyAdded}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-mono truncate block">{entry.url}</span>
                  {entry.isRecommended && entry.reason && (
                    <span className="text-xs text-primary flex items-center gap-1 mt-0.5">
                      <Sparkles className="h-3 w-3" />{entry.reason}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {alreadyAdded && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{existingLabel}</Badge>
                  )}
                  {entry.isRecommended && !alreadyAdded && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">AI pick</Badge>
                  )}
                  <a href={entry.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </a>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export function UrlDiscoveryCard({ sessionId, baseUrl, domain, onPagesAdded, existingPageUrls, existingScreenshotUrls }: Props) {
  const [isMapping, setIsMapping] = useState(false);
  const [allUrls, setAllUrls] = useState<string[]>([]);
  const [discoveryDone, setDiscoveryDone] = useState(false);

  // Screenshot recommendations
  const [screenshotEntries, setScreenshotEntries] = useState<UrlEntry[]>([]);
  const [screenshotSelected, setScreenshotSelected] = useState<Set<string>>(new Set());
  const [screenshotAnalyzing, setScreenshotAnalyzing] = useState(false);
  const [screenshotAnalysisDone, setScreenshotAnalysisDone] = useState(false);
  const [screenshotSubmitting, setScreenshotSubmitting] = useState(false);

  // Content recommendations
  const [contentEntries, setContentEntries] = useState<UrlEntry[]>([]);
  const [contentSelected, setContentSelected] = useState<Set<string>>(new Set());
  const [contentAnalyzing, setContentAnalyzing] = useState(false);
  const [contentAnalysisDone, setContentAnalysisDone] = useState(false);
  const [contentSubmitting, setContentSubmitting] = useState(false);

  // Auto-start
  useEffect(() => {
    if (discoveryDone || isMapping) return;
    startDiscovery();
  }, []);

  const startDiscovery = async () => {
    setIsMapping(true);
    try {
      const result = await firecrawlApi.map(baseUrl);
      const rawLinks: string[] = result.links || result.data?.links || [];

      if (!rawLinks.length) {
        toast.error('No pages found on this site');
        setIsMapping(false);
        setDiscoveryDone(true);
        return;
      }

      // Clean URLs
      const dominated = /(\#\:\~\:text=|sitemap.*\.xml|\/feed$|\/wp-json\/|\/wp-admin\/-thank-you)/i;
      const cleaned = rawLinks
        .filter(u => !dominated.test(u))
        .map(u => {
          try {
            const parsed = new URL(u);
            parsed.hash = '';
            return parsed.toString().replace(/\/+$/, '');
          } catch { return u.replace(/\/+$/, ''); }
        });
      const seen = new Map<string, string>();
      for (const u of cleaned) {
        const key = u.toLowerCase();
        if (!seen.has(key)) seen.set(key, u);
      }
      const links = Array.from(seen.values());

      toast.success(`Found ${links.length} pages. Running AI analysis...`);
      setAllUrls(links);

      // Set both lists to all URLs initially (no recommendations yet)
      const baseEntries = links.map(u => ({ url: u, isRecommended: false }));
      setScreenshotEntries(baseEntries);
      setContentEntries(baseEntries);
      setIsMapping(false);
      setDiscoveryDone(true);

      // Run both AI analyses in parallel
      runScreenshotAnalysis(links);
      runContentAnalysis(links);
    } catch (error) {
      console.error(error);
      toast.error('Failed to discover pages');
      setIsMapping(false);
      setDiscoveryDone(true);
    }
  };

  const runScreenshotAnalysis = async (links: string[]) => {
    setScreenshotAnalyzing(true);
    try {
      const result = await aiApi.recommendPages(baseUrl, links, 'screenshots');
      if (result.success && result.recommendations?.length) {
        const recMap = new Map(result.recommendations.map(r => [r.url, r.reason]));
        setScreenshotEntries(links.map(u => ({
          url: u,
          reason: recMap.get(u),
          isRecommended: recMap.has(u),
        })));
        setScreenshotSelected(new Set(result.recommendations.map(r => r.url)));
        toast.success(`AI selected ${result.recommendations.length} pages for screenshots`);
      }
    } catch (e) { console.error('Screenshot analysis failed:', e); }
    setScreenshotAnalyzing(false);
    setScreenshotAnalysisDone(true);
  };

  const runContentAnalysis = async (links: string[]) => {
    setContentAnalyzing(true);
    try {
      const result = await aiApi.recommendPages(baseUrl, links, 'content');
      if (result.success && result.recommendations?.length) {
        const recMap = new Map(result.recommendations.map(r => [r.url, r.reason]));
        setContentEntries(links.map(u => ({
          url: u,
          reason: recMap.get(u),
          isRecommended: recMap.has(u),
        })));
        setContentSelected(new Set(result.recommendations.map(r => r.url)));
        toast.success(`AI selected ${result.recommendations.length} pages for content`);
      }
    } catch (e) { console.error('Content analysis failed:', e); }
    setContentAnalyzing(false);
    setContentAnalysisDone(true);
  };

  const handleScreenshotSubmit = async () => {
    const newUrls = Array.from(screenshotSelected).filter(u => !existingScreenshotUrls.has(u));
    if (newUrls.length === 0) {
      toast.info('All selected pages already have screenshots queued');
      return;
    }
    setScreenshotSubmitting(true);
    try {
      // Insert as crawl_pages with status 'pending' — they'll get screenshots during processing
      const pages = newUrls.map(url => ({ session_id: sessionId, url, status: 'pending' }));
      const { error } = await supabase.from('crawl_pages').insert(pages);
      if (error) throw error;
      await supabase.from('crawl_sessions').update({ status: 'crawling' }).eq('id', sessionId);
      toast.success(`Queued ${newUrls.length} pages for screenshots`);
      onPagesAdded();
    } catch (e) {
      console.error(e);
      toast.error('Failed to queue screenshots');
    }
    setScreenshotSubmitting(false);
  };

  const handleContentSubmit = async () => {
    const newUrls = Array.from(contentSelected).filter(u => !existingPageUrls.has(u));
    if (newUrls.length === 0) {
      toast.info('All selected pages are already being processed');
      return;
    }
    setContentSubmitting(true);
    try {
      const pages = newUrls.map(url => ({ session_id: sessionId, url, status: 'pending' }));
      const { error } = await supabase.from('crawl_pages').insert(pages);
      if (error) throw error;
      await supabase.from('crawl_sessions').update({ status: 'crawling' }).eq('id', sessionId);
      toast.success(`Queued ${newUrls.length} pages for content scraping`);
      onPagesAdded();
    } catch (e) {
      console.error(e);
      toast.error('Failed to queue content pages');
    }
    setContentSubmitting(false);
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Globe className="h-5 w-5 text-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Discovered URLs</h2>
        {discoveryDone && (
          <span className="text-sm text-muted-foreground ml-auto">{allUrls.length} pages found</span>
        )}
      </div>
      <div className="p-6">
        {/* Loading state */}
        {isMapping && (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span className="text-sm">Mapping site URLs...</span>
          </div>
        )}

        {discoveryDone && allUrls.length > 0 && (
          <Tabs defaultValue="screenshots">
            <TabsList className="mb-4">
              <TabsTrigger value="screenshots" className="gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                Screenshots
                {screenshotAnalysisDone && screenshotEntries.some(e => e.isRecommended) && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                    {screenshotEntries.filter(e => e.isRecommended).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Content
                {contentAnalysisDone && contentEntries.some(e => e.isRecommended) && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                    {contentEntries.filter(e => e.isRecommended).length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="screenshots">
              <p className="text-sm text-muted-foreground mb-3">
                Key template pages to capture — homepage, service pages, blog layouts, about, contact, etc. Aim for 5–15 unique page designs.
              </p>
              {screenshotAnalyzing && (
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
                entries={screenshotEntries}
                selectedUrls={screenshotSelected}
                setSelectedUrls={setScreenshotSelected}
                existingUrls={existingScreenshotUrls}
                existingLabel="Queued"
                onSubmit={handleScreenshotSubmit}
                submitLabel="Capture Screenshots"
                isSubmitting={screenshotSubmitting}
                isAnalyzing={screenshotAnalyzing}
                analysisDone={screenshotAnalysisDone}
              />
            </TabsContent>

            <TabsContent value="content">
              <p className="text-sm text-muted-foreground mb-3">
                All substantive pages to understand the company — every service, solution, about section, case study, and more.
              </p>
              {contentAnalyzing && (
                <div className="px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 mb-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                    <div>
                      <p className="font-medium text-sm">AI is identifying content pages...</p>
                      <p className="text-xs text-muted-foreground">Finding all service, product, and company pages</p>
                    </div>
                  </div>
                </div>
              )}
              <UrlSelectionList
                entries={contentEntries}
                selectedUrls={contentSelected}
                setSelectedUrls={setContentSelected}
                existingUrls={existingPageUrls}
                existingLabel="Added"
                onSubmit={handleContentSubmit}
                submitLabel="Scrape Content"
                isSubmitting={contentSubmitting}
                isAnalyzing={contentAnalyzing}
                analysisDone={contentAnalysisDone}
              />
            </TabsContent>
          </Tabs>
        )}

        {discoveryDone && allUrls.length === 0 && !isMapping && (
          <p className="text-sm text-muted-foreground">No pages discovered on this domain.</p>
        )}
      </div>
    </Card>
  );
}
