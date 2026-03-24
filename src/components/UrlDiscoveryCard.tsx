import { useState, useEffect, forwardRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Globe, RefreshCw, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { isIntegrationPaused } from '@/lib/integrationState';
import { SectionCard } from '@/components/SectionCard';
import { CardTabs } from '@/components/CardTabs';
import { PageTemplateBadge } from '@/components/PageTemplateBadge';
import { getPageTag, type PageTagsMap } from '@/lib/pageTags';

type LinkCheckResult = {
  url: string;
  statusCode: number;
};

type NavItem = {
  label: string;
  url?: string | null;
  children?: NavItem[];
};

type NavStructureData = {
  primary?: NavItem[];
  secondary?: NavItem[];
  footer?: NavItem[];
  items?: NavItem[];
} | null;

type NavTag = { type: 'primary' | 'secondary' | 'footer'; label: string };

const navWeight: Record<string, number> = { primary: 4, secondary: 2, footer: 1 };

function navSortScore(url: string, navMap: Map<string, NavTag[]>): number {
  const tags = navMap.get(url.toLowerCase().replace(/\/$/, '')) || [];
  if (!tags.length) return 0;
  return tags.reduce((sum, t) => sum + (navWeight[t.type] || 0), 0);
}

function buildNavMap(nav: NavStructureData): Map<string, NavTag[]> {
  const map = new Map<string, NavTag[]>();
  if (!nav) return map;

  const walk = (items: NavItem[] | undefined, type: 'primary' | 'secondary' | 'footer') => {
    if (!items) return;
    for (const item of items) {
      if (item.url) {
        const key = item.url.toLowerCase().replace(/\/$/, '');
        const existing = map.get(key) || [];
        existing.push({ type, label: item.label });
        map.set(key, existing);
      }
      if (item.children) walk(item.children, type);
    }
  };

  walk(nav.primary, 'primary');
  walk(nav.secondary, 'secondary');
  walk(nav.footer, 'footer');
  return map;
}

type Props = {
  baseUrl: string;
  onUrlsDiscovered: (urls: string[]) => void;
  onSitemapHints?: (hints: { label: string; urls: string[] }[]) => void;
  sitemapUrls?: string[] | null;
  linkCheckResults?: LinkCheckResult[] | null;
  linkCheckStreaming?: LinkCheckResult[] | null;
  linkCheckLoading?: boolean;
  linkCheckProgress?: { checked: number; total: number } | null;
  onStopLinkCheck?: () => void;
  navStructure?: NavStructureData;
  collapsed?: boolean;
  persistedUrls?: string[] | null;
  onUrlsPersist?: (urls: string[]) => void;
  pageTags?: PageTagsMap | null;
  onPageTagChange?: (url: string, template: string) => void;
};

function statusBadgeClass(code: number): string {
  if (code >= 200 && code < 300) return 'bg-green-500/10 text-green-600 border-green-500/30';
  if (code >= 300 && code < 400) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
  if (code === 429) return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30';
  if (code >= 400) return 'bg-destructive/10 text-destructive border-destructive/30';
  return 'bg-muted text-muted-foreground border-border';
}

function normalizeDiscoveredUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';

    const isFileLikePath = /\.[a-z0-9]+$/i.test(parsed.pathname);
    const shouldKeepAsIs =
      parsed.pathname === '/' ||
      isFileLikePath ||
      parsed.pathname.endsWith('/');

    if (!shouldKeepAsIs) {
      parsed.pathname = `${parsed.pathname}/`;
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const navBadgeClass: Record<string, string> = {
  primary: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  secondary: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  footer: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
};

const navBadgeLabel: Record<string, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  footer: 'Footer',
};

const baseTypeStyles: Record<string, string> = {
  Page: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Post: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CPT: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Archive: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

const UrlList = forwardRef<HTMLDivElement, { urls: string[]; statusMap: Map<string, number>; navMap: Map<string, NavTag[]>; emptyText?: string; pageTags?: PageTagsMap | null; onPageTagChange?: (url: string, template: string) => void }>(
  ({ urls, statusMap, navMap, emptyText = 'No URLs in this range', pageTags, onPageTagChange }, ref) => {
    if (!urls.length) {
      return <p className="text-sm text-muted-foreground italic py-4 text-center">{emptyText}</p>;
    }

    return (
      <div ref={ref} className="max-h-[300px] overflow-y-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm table-fixed">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <tr className="text-left">
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground">URL</th>
              <th className="px-2 py-1.5 font-medium text-xs text-muted-foreground text-center w-[70px]">Type</th>
              <th className="px-2 py-1.5 font-medium text-xs text-muted-foreground text-center w-[120px]">Template</th>
            </tr>
          </thead>
          <tbody>
            {urls.map((url) => {
              const pageTag = getPageTag(pageTags, url);

              return (
                <tr key={url} className="border-t border-border hover:bg-muted/20 transition-colors group">
                  <td className="px-3 py-1.5">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono leading-5 truncate block text-muted-foreground hover:text-primary hover:underline">{url}</a>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {pageTag?.baseType && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${baseTypeStyles[pageTag.baseType] || ''}`}>
                        {pageTag.baseType}
                      </Badge>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <PageTemplateBadge
                      tag={pageTag}
                      onChange={onPageTagChange ? (t) => onPageTagChange(url, t) : undefined}
                      readOnly={!onPageTagChange}
                      hideBaseType
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },
);

UrlList.displayName = 'UrlList';

export function UrlDiscoveryCard({ baseUrl, onUrlsDiscovered, onSitemapHints, sitemapUrls, linkCheckResults, linkCheckStreaming, linkCheckLoading, linkCheckProgress, onStopLinkCheck, navStructure, collapsed, persistedUrls, onUrlsPersist, pageTags, onPageTagChange }: Props) {
  const [isMapping, setIsMapping] = useState(false);
  const [allUrls, setAllUrls] = useState<string[]>([]);
  const [discoveryDone, setDiscoveryDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedResults, setCachedResults] = useState<LinkCheckResult[] | null>(null);
  const paused = isIntegrationPaused('url-discovery');

  useEffect(() => {
    if (linkCheckResults && linkCheckResults.length > 0) {
      setCachedResults(linkCheckResults);
    }
  }, [linkCheckResults]);

  useEffect(() => {
    if (persistedUrls && persistedUrls.length > 0 && !discoveryDone) {
      setAllUrls(persistedUrls);
      setDiscoveryDone(true);
      onUrlsDiscovered(persistedUrls);
    }
  }, [persistedUrls, discoveryDone, onUrlsDiscovered]);

  useEffect(() => {
    if (discoveryDone || isMapping || paused) return;
    if (persistedUrls && persistedUrls.length > 0) return;
    startDiscovery();
  }, [discoveryDone, isMapping, paused, persistedUrls]);

  const effectiveResults = linkCheckResults ?? linkCheckStreaming ?? cachedResults ?? [];
  const statusMap = new Map<string, number>();
  for (const result of effectiveResults) {
    statusMap.set(result.url, result.statusCode);
  }
  const navMap = buildNavMap(navStructure ?? null);

  const sorted = [...allUrls].sort((a, b) => a.localeCompare(b));
  const buckets = {
    all: sorted,
    pending: sorted.filter((u) => !statusMap.has(u)),
    '2xx': sorted.filter((u) => {
      const s = statusMap.get(u);
      return s != null && s >= 200 && s < 300;
    }).sort((a, b) => navSortScore(b, navMap) - navSortScore(a, navMap)),
    '3xx': sorted.filter((u) => {
      const s = statusMap.get(u);
      return s != null && s >= 300 && s < 400;
    }),
    '429': sorted.filter((u) => statusMap.get(u) === 429),
    '4xx': sorted.filter((u) => {
      const s = statusMap.get(u);
      return s != null && s >= 400 && s < 500 && s !== 429;
    }),
    '5xx': sorted.filter((u) => {
      const s = statusMap.get(u);
      return s != null && s >= 500;
    }),
  };

  const startDiscovery = async () => {
    setIsMapping(true);

    try {
      // Run Firecrawl map (sitemap is now a separate integration)
      const mapResult = await firecrawlApi.map(baseUrl);

      const rawLinks: string[] = mapResult.links || mapResult.data?.links || [];
      // Merge sitemap URLs from the standalone sitemap integration
      const extraSitemapUrls: string[] = sitemapUrls || [];

      const combined = [...rawLinks, ...extraSitemapUrls];

      if (!combined.length) {
        toast.error('No pages found on this site');
        setDiscoveryDone(true);
        return;
      }

      const dominated = /(\#\:\~\:text=|sitemap.*\.xml|\/feed$|\/wp-json\/|\/wp-admin\/-thank-you)/i;
      const cleaned = combined
        .filter((u) => !dominated.test(u))
        .map((u) => normalizeDiscoveredUrl(u));

      const seen = new Map<string, string>();
      for (const url of cleaned) {
        const key = url.toLowerCase();
        if (!seen.has(key)) seen.set(key, url);
      }

      const links = Array.from(seen.values());
      const sitemapExtra = extraSitemapUrls.length > 0 ? ` (${extraSitemapUrls.length} from sitemap)` : '';
      toast.success(`Found ${links.length} pages${sitemapExtra}`);
      setAllUrls(links);
      setDiscoveryDone(true);
      onUrlsDiscovered(links);
      onUrlsPersist?.(links);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to discover pages');
      toast.error('Failed to discover pages');
      setDiscoveryDone(true);
    } finally {
      setIsMapping(false);
    }
  };

  return (
    <SectionCard
      collapsed={collapsed}
      title="Discovered URLs"
      icon={<Globe className="h-5 w-5 text-foreground" />}
      paused={paused}
      loading={isMapping && !discoveryDone}
      loadingText="Mapping site URLs..."
      error={!!error}
      errorText={error || undefined}
      headerExtra={
        <div className="flex items-center gap-2">
          {discoveryDone && !error && <Badge variant="secondary">{allUrls.length} pages</Badge>}
          {isMapping && discoveryDone && <Badge variant="outline">Refreshing…</Badge>}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isMapping}
            onClick={() => {
              setError(null);
              startDiscovery();
            }}
            title="Re-discover URLs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isMapping ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      {discoveryDone && !error ? (
        allUrls.length > 0 ? (
          <div className="space-y-3">
            {linkCheckLoading && (
              <div className="flex items-center gap-3 px-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Checking links{linkCheckProgress ? ` — ${linkCheckProgress.checked} of ${linkCheckProgress.total}` : '…'}</span>
                    {linkCheckProgress && (
                      <span>{Math.round((linkCheckProgress.checked / linkCheckProgress.total) * 100)}%</span>
                    )}
                  </div>
                  {linkCheckProgress && (
                    <Progress value={(linkCheckProgress.checked / linkCheckProgress.total) * 100} className="h-1.5" />
                  )}
                </div>
                {onStopLinkCheck && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={onStopLinkCheck}
                    title="Stop link checking"
                  >
                    <Square className="h-3 w-3 fill-current" />
                  </Button>
                )}
              </div>
            )}
            <CardTabs
              defaultValue="all"
              tabs={[
                { value: 'all', label: `All (${buckets.all.length})`, content: <UrlList urls={buckets.all} statusMap={statusMap} navMap={navMap} pageTags={pageTags} onPageTagChange={onPageTagChange} /> },
                {
                  value: 'pending',
                  label: `Pending (${buckets.pending.length})`,
                  content: <UrlList urls={buckets.pending} statusMap={statusMap} navMap={navMap} pageTags={pageTags} onPageTagChange={onPageTagChange} emptyText="All URLs have been checked." />,
                  visible: buckets.pending.length > 0,
                },
                { value: '2xx', label: `2xx (${buckets['2xx'].length})`, content: <UrlList urls={buckets['2xx']} statusMap={statusMap} navMap={navMap} pageTags={pageTags} onPageTagChange={onPageTagChange} />, visible: buckets['2xx'].length > 0 },
                { value: '3xx', label: `3xx (${buckets['3xx'].length})`, content: <UrlList urls={buckets['3xx']} statusMap={statusMap} navMap={navMap} pageTags={pageTags} onPageTagChange={onPageTagChange} />, visible: buckets['3xx'].length > 0 },
                { value: '429', label: `429 Rate Limited (${buckets['429'].length})`, content: <UrlList urls={buckets['429']} statusMap={statusMap} navMap={navMap} pageTags={pageTags} onPageTagChange={onPageTagChange} />, visible: buckets['429'].length > 0 },
                { value: '4xx', label: `4xx (${buckets['4xx'].length})`, content: <UrlList urls={buckets['4xx']} statusMap={statusMap} navMap={navMap} pageTags={pageTags} onPageTagChange={onPageTagChange} />, visible: buckets['4xx'].length > 0 },
                { value: '5xx', label: `5xx (${buckets['5xx'].length})`, content: <UrlList urls={buckets['5xx']} statusMap={statusMap} navMap={navMap} pageTags={pageTags} onPageTagChange={onPageTagChange} />, visible: buckets['5xx'].length > 0 },
              ]}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No URLs found for this site.</p>
        )
      ) : !isMapping && !error && !paused ? (
        <p className="text-sm text-muted-foreground">Will start mapping automatically...</p>
      ) : null}
    </SectionCard>
  );
}
