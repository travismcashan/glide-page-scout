import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Globe, Loader2, Search, ArrowRight, Zap, Sparkles,
  CheckSquare, Square, Filter, ArrowUpDown, X,
} from 'lucide-react';
import { firecrawlApi, aiApi } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';

type UrlEntry = {
  url: string;
  reason?: string; // AI recommendation reason
  isRecommended: boolean;
};

type SortMode = 'selected-first' | 'alpha' | 'recommended-first';

export default function CrawlPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [isMapping, setIsMapping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [urlEntries, setUrlEntries] = useState<UrlEntry[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('selected-first');
  const [analysisDone, setAnalysisDone] = useState(false);

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsMapping(true);
    setShowDiscovery(false);
    setAnalysisDone(false);
    setSearchQuery('');

    try {
      // Step 1: Map the site
      const result = await firecrawlApi.map(url);
      const rawLinks: string[] = result.links || result.data?.links || [];

      if (!rawLinks.length) {
        toast.error('No pages found on this site');
        return;
      }

      // Clean URLs: remove fragments, sitemaps, thank-you pages, then deduplicate
      const cleanAndDedup = (urls: string[]): string[] => {
        const dominated = /(\#\:\~\:text=|sitemap.*\.xml|\/feed$|\/wp-json\/|\/wp-admin\/-thank-you)/i;
        const cleaned = urls
          .filter(u => !dominated.test(u))
          .map(u => {
            try {
              const parsed = new URL(u);
              // Strip fragments entirely
              parsed.hash = '';
              return parsed.toString().replace(/\/+$/, '');
            } catch {
              return u.replace(/\/+$/, '');
            }
          });
        // Deduplicate case-insensitive
        const seen = new Map<string, string>();
        for (const u of cleaned) {
          const key = u.toLowerCase();
          if (!seen.has(key)) seen.set(key, u);
        }
        return Array.from(seen.values());
      };

      const links = cleanAndDedup(rawLinks);

      toast.success(`Found ${links.length} pages (${rawLinks.length - links.length} junk removed). Analyzing navigation...`);

      // Show discovered URLs immediately with no selections
      const entries: UrlEntry[] = links.map(u => ({ url: u, isRecommended: false }));
      setUrlEntries(entries);
      setSelectedUrls(new Set());
      setShowDiscovery(true);
      setIsMapping(false);

      // Step 2: AI analysis of navigation
      setIsAnalyzing(true);
      const formattedUrl = url.startsWith('http') ? url : `https://${url}`;

      const aiResult = await aiApi.recommendPages(formattedUrl, links);

      if (aiResult.success && aiResult.recommendations?.length) {
        const recommendedMap = new Map(
          aiResult.recommendations.map(r => [r.url, r.reason])
        );

        const updatedEntries: UrlEntry[] = links.map(u => ({
          url: u,
          reason: recommendedMap.get(u),
          isRecommended: recommendedMap.has(u),
        }));

        setUrlEntries(updatedEntries);
        setSelectedUrls(new Set(aiResult.recommendations.map(r => r.url)));
        setSortMode('recommended-first');
        toast.success(`AI recommended ${aiResult.recommendations.length} key pages`);
      } else if (aiResult.success) {
        toast.info('AI couldn\'t identify specific nav pages — select manually');
      } else {
        toast.warning(`AI analysis issue: ${aiResult.error || 'Unknown error'} — select manually`);
      }

      setAnalysisDone(true);
      setIsAnalyzing(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to discover pages');
      setIsMapping(false);
      setIsAnalyzing(false);
    }
  };

  const toggleUrl = (pageUrl: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(pageUrl)) next.delete(pageUrl);
      else next.add(pageUrl);
      return next;
    });
  };

  const selectAll = () => {
    const visible = filteredAndSorted.map(e => e.url);
    setSelectedUrls(prev => {
      const next = new Set(prev);
      visible.forEach(u => next.add(u));
      return next;
    });
  };

  const deselectAll = () => {
    const visible = new Set(filteredAndSorted.map(e => e.url));
    setSelectedUrls(prev => {
      const next = new Set(prev);
      visible.forEach(u => next.delete(u));
      return next;
    });
  };

  const selectRecommended = () => {
    const recommended = urlEntries.filter(e => e.isRecommended).map(e => e.url);
    setSelectedUrls(new Set(recommended));
  };

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let result = urlEntries;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.url.toLowerCase().includes(q) ||
        (e.reason && e.reason.toLowerCase().includes(q))
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      if (sortMode === 'selected-first') {
        const aSelected = selectedUrls.has(a.url) ? 0 : 1;
        const bSelected = selectedUrls.has(b.url) ? 0 : 1;
        if (aSelected !== bSelected) return aSelected - bSelected;
        // Within same group, recommended first
        const aRec = a.isRecommended ? 0 : 1;
        const bRec = b.isRecommended ? 0 : 1;
        if (aRec !== bRec) return aRec - bRec;
        return a.url.localeCompare(b.url);
      }
      if (sortMode === 'recommended-first') {
        const aRec = a.isRecommended ? 0 : 1;
        const bRec = b.isRecommended ? 0 : 1;
        if (aRec !== bRec) return aRec - bRec;
        return a.url.localeCompare(b.url);
      }
      // alpha
      return a.url.localeCompare(b.url);
    });
  }, [urlEntries, searchQuery, sortMode, selectedUrls]);

  const visibleSelected = filteredAndSorted.filter(e => selectedUrls.has(e.url)).length;
  const allVisibleSelected = visibleSelected === filteredAndSorted.length && filteredAndSorted.length > 0;

  const handleCrawl = async () => {
    if (selectedUrls.size === 0) {
      toast.error('Select at least one page');
      return;
    }

    setIsCrawling(true);

    try {
      const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
      const domain = new URL(formattedUrl).hostname;

      const { data: session, error: sessionError } = await supabase
        .from('crawl_sessions')
        .insert({ domain, base_url: formattedUrl, status: 'crawling' })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const pages = Array.from(selectedUrls).map(pageUrl => ({
        session_id: session.id,
        url: pageUrl,
        status: 'pending',
      }));

      const { error: pagesError } = await supabase
        .from('crawl_pages')
        .insert(pages);

      if (pagesError) throw pagesError;

      toast.success('Crawl started! Redirecting to results...');
      navigate(`/results/${session.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to start crawl');
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold tracking-tight">Glide Sales Prep</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/integrations')}>
              Integrations
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              History
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Prep for your next sales call
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Paste a prospect's URL — we'll analyze their navigation to find the pages that matter.
          </p>
        </div>

        {/* URL Input */}
        <form onSubmit={handleDiscover} className="max-w-2xl mx-auto mb-12">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="example.com"
                className="pl-10 h-12 text-base"
                disabled={isMapping || isCrawling}
              />
            </div>
            <Button type="submit" size="lg" disabled={isMapping || isAnalyzing || !url.trim()}>
              {isMapping ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mapping...</>
              ) : isAnalyzing ? (
                <><Sparkles className="h-4 w-4 mr-2 animate-pulse" />Analyzing...</>
              ) : (
                <><Search className="h-4 w-4 mr-2" />Discover Pages</>
              )}
            </Button>
          </div>
        </form>

        {/* AI Analysis Status - shown above the discovery section */}

        {/* Page Discovery */}
        {showDiscovery && (
          <div className="max-w-2xl mx-auto">
            {/* AI analyzing banner */}
            {isAnalyzing && (
              <Card className="px-5 py-4 border-primary/20 bg-primary/5 mb-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                  <div>
                    <p className="font-medium text-sm">AI is analyzing the site navigation...</p>
                    <p className="text-xs text-muted-foreground">
                      Scraping the homepage, reading the nav menu, and picking key pages
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Header with counts */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {urlEntries.length} pages found
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isAnalyzing ? (
                    'AI is selecting recommended pages...'
                  ) : (
                    <>
                      {selectedUrls.size} selected
                      {analysisDone && urlEntries.some(e => e.isRecommended) && (
                        <> · {urlEntries.filter(e => e.isRecommended).length} AI-recommended</>
                      )}
                    </>
                  )}
                </p>
              </div>
              <Button onClick={handleCrawl} disabled={isCrawling || selectedUrls.size === 0}>
                {isCrawling ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Crawling...</>
                ) : (
                  <><ArrowRight className="h-4 w-4 mr-2" />Crawl {selectedUrls.size} Pages</>
                )}
              </Button>
            </div>

            {/* Toolbar: Search + Sort + Bulk Actions */}
            <div className="flex flex-col gap-2 mb-3">
              {/* Search bar */}
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
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={allVisibleSelected ? deselectAll : selectAll}
                    className="text-xs h-7"
                  >
                    {allVisibleSelected ? (
                      <><Square className="h-3 w-3 mr-1" />Deselect All</>
                    ) : (
                      <><CheckSquare className="h-3 w-3 mr-1" />Select All</>
                    )}
                  </Button>
                  {analysisDone && urlEntries.some(e => e.isRecommended) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectRecommended}
                      className="text-xs h-7"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />Select AI Picks
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
                    className="text-xs h-7"
                  >
                    <X className="h-3 w-3 mr-1" />Clear
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cycleSortMode}
                  className="text-xs h-7"
                >
                  <ArrowUpDown className="h-3 w-3 mr-1" />{sortLabel[sortMode]}
                </Button>
              </div>
            </div>

            {/* Filtered count */}
            {searchQuery && (
              <p className="text-xs text-muted-foreground mb-2">
                Showing {filteredAndSorted.length} of {urlEntries.length} URLs
                {visibleSelected > 0 && <> · {visibleSelected} selected in view</>}
              </p>
            )}

            {/* URL List */}
            <div className="space-y-1 max-h-[500px] overflow-y-auto rounded-lg border border-border bg-card p-2">
              {filteredAndSorted.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No URLs match "{searchQuery}"
                </p>
              ) : (
                filteredAndSorted.map((entry) => {
                  const isSelected = selectedUrls.has(entry.url);
                  return (
                    <label
                      key={entry.url}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary/5 border border-primary/10'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleUrl(entry.url)}
                        className="mt-0.5"
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
                        {entry.isRecommended && (
                          <Badge variant="default" className="text-xs px-1.5 py-0">
                            AI pick
                          </Badge>
                        )}
                        {isSelected && !entry.isRecommended && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            selected
                          </Badge>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
