import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Globe, Loader2, Search, ArrowRight, Sparkles,
  CheckSquare, Square, ArrowUpDown, X, ExternalLink,
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
};

export function UrlDiscoveryCard({ sessionId, baseUrl, domain, onPagesAdded, existingPageUrls }: Props) {
  const [isMapping, setIsMapping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [urlEntries, setUrlEntries] = useState<UrlEntry[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('selected-first');
  const [discoveryDone, setDiscoveryDone] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);

  // Auto-start discovery on mount
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
      const cleanAndDedup = (urls: string[]): string[] => {
        const dominated = /(\#\:\~\:text=|sitemap.*\.xml|\/feed$|\/wp-json\/|\/wp-admin\/-thank-you)/i;
        const cleaned = urls
          .filter(u => !dominated.test(u))
          .map(u => {
            try {
              const parsed = new URL(u);
              parsed.hash = '';
              return parsed.toString().replace(/\/+$/, '');
            } catch {
              return u.replace(/\/+$/, '');
            }
          });
        const seen = new Map<string, string>();
        for (const u of cleaned) {
          const key = u.toLowerCase();
          if (!seen.has(key)) seen.set(key, u);
        }
        return Array.from(seen.values());
      };

      const links = cleanAndDedup(rawLinks);
      toast.success(`Found ${links.length} pages. Analyzing navigation...`);

      const entries: UrlEntry[] = links.map(u => ({ url: u, isRecommended: false }));
      setUrlEntries(entries);
      setSelectedUrls(new Set());
      setIsMapping(false);
      setDiscoveryDone(true);

      // AI analysis
      setIsAnalyzing(true);
      const aiResult = await aiApi.recommendPages(baseUrl, links);

      if (aiResult.success && aiResult.recommendations?.length) {
        const recommendedMap = new Map(
          aiResult.recommendations.map((r: any) => [r.url, r.reason])
        );
        const updatedEntries: UrlEntry[] = links.map(u => ({
          url: u,
          reason: recommendedMap.get(u),
          isRecommended: recommendedMap.has(u),
        }));
        setUrlEntries(updatedEntries);
        setSelectedUrls(new Set(aiResult.recommendations.map((r: any) => r.url)));
        setSortMode('recommended-first');
        toast.success(`AI recommended ${aiResult.recommendations.length} key pages`);
      }

      setAnalysisDone(true);
      setIsAnalyzing(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to discover pages');
      setIsMapping(false);
      setIsAnalyzing(false);
      setDiscoveryDone(true);
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = urlEntries;
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
  }, [urlEntries, searchQuery, sortMode, selectedUrls]);

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
    setSelectedUrls(new Set(urlEntries.filter(e => e.isRecommended).map(e => e.url)));
  };

  const visibleSelected = filteredAndSorted.filter(e => selectedUrls.has(e.url)).length;
  const allVisibleSelected = visibleSelected === filteredAndSorted.length && filteredAndSorted.length > 0;

  const handleScrapeSelected = async () => {
    // Filter out already-added pages
    const newUrls = Array.from(selectedUrls).filter(u => !existingPageUrls.has(u));
    if (newUrls.length === 0) {
      toast.info('All selected pages are already being processed');
      return;
    }

    setIsCrawling(true);
    try {
      const pages = newUrls.map(pageUrl => ({
        session_id: sessionId,
        url: pageUrl,
        status: 'pending',
      }));

      const { error } = await supabase.from('crawl_pages').insert(pages);
      if (error) throw error;

      // Update session status to crawling
      await supabase.from('crawl_sessions').update({ status: 'crawling' }).eq('id', sessionId);

      toast.success(`Started scraping ${newUrls.length} pages`);
      onPagesAdded();
    } catch (error) {
      console.error(error);
      toast.error('Failed to start scraping');
    } finally {
      setIsCrawling(false);
    }
  };

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

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Globe className="h-5 w-5 text-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Discovered URLs</h2>
        {discoveryDone && (
          <span className="text-sm text-muted-foreground ml-auto">{urlEntries.length} pages found</span>
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

        {/* AI analyzing banner */}
        {isAnalyzing && discoveryDone && (
          <div className="px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 mb-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              <div>
                <p className="font-medium text-sm">AI is analyzing the site navigation...</p>
                <p className="text-xs text-muted-foreground">Scraping the homepage and picking key pages</p>
              </div>
            </div>
          </div>
        )}

        {/* URL list */}
        {discoveryDone && urlEntries.length > 0 && (
          <>
            {/* Toolbar */}
            <div className="flex flex-col gap-2 mb-3">
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
                  {analysisDone && urlEntries.some(e => e.isRecommended) && (
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
                  <Button size="sm" onClick={handleScrapeSelected} disabled={isCrawling || selectedUrls.size === 0}>
                    {isCrawling ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Scraping...</>
                    ) : (
                      <><ArrowRight className="h-3 w-3 mr-1" />Scrape {selectedUrls.size} Pages</>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {searchQuery && (
              <p className="text-xs text-muted-foreground mb-2">
                Showing {filteredAndSorted.length} of {urlEntries.length} URLs
              </p>
            )}

            {/* URL List */}
            <div className="space-y-1 max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card p-2">
              {filteredAndSorted.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No URLs match "{searchQuery}"</p>
              ) : (
                filteredAndSorted.map((entry) => {
                  const isSelected = selectedUrls.has(entry.url);
                  const alreadyAdded = existingPageUrls.has(entry.url);
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
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Added</Badge>
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
          </>
        )}

        {discoveryDone && urlEntries.length === 0 && !isMapping && (
          <p className="text-sm text-muted-foreground">No pages discovered on this domain.</p>
        )}
      </div>
    </Card>
  );
}
