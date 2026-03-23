import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Globe, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { isIntegrationPaused } from '@/lib/integrationState';
import { SectionCard } from '@/components/SectionCard';
import { CardTabs } from '@/components/CardTabs';

type LinkCheckResult = {
  url: string;
  statusCode: number;
};

type Props = {
  baseUrl: string;
  onUrlsDiscovered: (urls: string[]) => void;
  linkCheckResults?: LinkCheckResult[] | null;
  collapsed?: boolean;
  persistedUrls?: string[] | null;
  onUrlsPersist?: (urls: string[]) => void;
};

function statusBadgeClass(code: number): string {
  if (code >= 200 && code < 300) return 'bg-green-500/10 text-green-600 border-green-500/30';
  if (code >= 300 && code < 400) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
  if (code >= 400) return 'bg-destructive/10 text-destructive border-destructive/30';
  return 'bg-muted text-muted-foreground border-border';
}

function UrlList({ urls, statusMap }: { urls: string[]; statusMap: Map<string, number> }) {
  if (!urls.length) {
    return <p className="text-sm text-muted-foreground italic py-4 text-center">No URLs in this range</p>;
  }
  return (
    <div className="space-y-0 max-h-[300px] overflow-y-auto rounded-lg border border-border bg-card">
      {urls.map(url => {
        const status = statusMap.get(url);
        return (
          <div key={url} className="flex items-center gap-2 px-3 py-1.5 border-b border-border last:border-0">
            {status != null ? (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono shrink-0 ${statusBadgeClass(status)}`}>
                {status}
              </Badge>
            ) : (
              <span className="w-8 shrink-0" />
            )}
            <span className="text-sm font-mono truncate text-muted-foreground">{url}</span>
          </div>
        );
      })}
    </div>
  );
}

export function UrlDiscoveryCard({ baseUrl, onUrlsDiscovered, linkCheckResults, collapsed, persistedUrls, onUrlsPersist }: Props) {
  const [isMapping, setIsMapping] = useState(false);
  const [allUrls, setAllUrls] = useState<string[]>([]);
  const [discoveryDone, setDiscoveryDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = isIntegrationPaused('url-discovery');

  const statusMap = new Map<string, number>();
  if (linkCheckResults) {
    for (const r of linkCheckResults) {
      statusMap.set(r.url, r.statusCode);
    }
  }

  // Bucket URLs by status code range
  const hasStatuses = statusMap.size > 0;
  const sorted = [...allUrls].sort((a, b) => a.localeCompare(b));
  const buckets = {
    all: sorted,
    '2xx': sorted.filter(u => { const s = statusMap.get(u); return s != null && s >= 200 && s < 300; }),
    '3xx': sorted.filter(u => { const s = statusMap.get(u); return s != null && s >= 300 && s < 400; }),
    '4xx': sorted.filter(u => { const s = statusMap.get(u); return s != null && s >= 400 && s < 500 && s !== 429; }),
    '429': sorted.filter(u => statusMap.get(u) === 429),
    '5xx': sorted.filter(u => { const s = statusMap.get(u); return s != null && s >= 500; }),
    'unchecked': sorted.filter(u => !statusMap.has(u)),
  };

  useEffect(() => {
    if (persistedUrls && persistedUrls.length > 0 && !discoveryDone) {
      setAllUrls(persistedUrls);
      setDiscoveryDone(true);
      onUrlsDiscovered(persistedUrls);
    }
  }, [persistedUrls]);

  useEffect(() => {
    if (discoveryDone || isMapping || paused) return;
    if (persistedUrls && persistedUrls.length > 0) return;
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

      const dominated = /(\#\:\~\:text=|sitemap.*\.xml|\/feed$|\/wp-json\/|\/wp-admin\/-thank-you)/i;
      const cleaned = rawLinks
        .filter(u => !dominated.test(u))
        .map(u => {
          try {
            const parsed = new URL(u);
            parsed.hash = '';
            return parsed.toString();
          } catch { return u; }
        });
      const seen = new Map<string, string>();
      for (const u of cleaned) {
        const key = u.toLowerCase();
        if (!seen.has(key)) seen.set(key, u);
      }
      const links = Array.from(seen.values());

      toast.success(`Found ${links.length} pages`);
      setAllUrls(links);
      setIsMapping(false);
      setDiscoveryDone(true);
      onUrlsDiscovered(links);
      onUrlsPersist?.(links);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to discover pages');
      toast.error('Failed to discover pages');
      setIsMapping(false);
      setDiscoveryDone(true);
    }
  };

  return (
    <SectionCard
      collapsed={collapsed}
      title="Discovered URLs"
      icon={<Globe className="h-5 w-5 text-foreground" />}
      paused={paused}
      loading={isMapping}
      loadingText="Mapping site URLs..."
      error={!!error}
      errorText={error || undefined}
      headerExtra={
        <div className="flex items-center gap-2">
          {discoveryDone && !error && <Badge variant="secondary">{allUrls.length} pages</Badge>}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isMapping}
            onClick={() => {
              setAllUrls([]);
              setDiscoveryDone(false);
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
        hasStatuses ? (
          <CardTabs
            defaultValue="all"
            tabs={[
              { value: 'all', label: `All (${buckets.all.length})`, content: <UrlList urls={buckets.all} statusMap={statusMap} /> },
              { value: '2xx', label: `2xx (${buckets['2xx'].length})`, content: <UrlList urls={buckets['2xx']} statusMap={statusMap} />, visible: buckets['2xx'].length > 0 },
              { value: '3xx', label: `3xx (${buckets['3xx'].length})`, content: <UrlList urls={buckets['3xx']} statusMap={statusMap} />, visible: buckets['3xx'].length > 0 },
              { value: '4xx', label: `4xx (${buckets['4xx'].length})`, content: <UrlList urls={buckets['4xx']} statusMap={statusMap} />, visible: buckets['4xx'].length > 0 },
              { value: '429', label: `429 Rate Limited (${buckets['429'].length})`, content: <UrlList urls={buckets['429']} statusMap={statusMap} />, visible: buckets['429'].length > 0 },
              { value: '5xx', label: `5xx (${buckets['5xx'].length})`, content: <UrlList urls={buckets['5xx']} statusMap={statusMap} />, visible: buckets['5xx'].length > 0 },
              { value: 'unchecked', label: `Unchecked (${buckets.unchecked.length})`, content: <UrlList urls={buckets.unchecked} statusMap={statusMap} />, visible: buckets.unchecked.length > 0 },
            ]}
          />
        ) : (
          <UrlList urls={allUrls} statusMap={statusMap} />
        )
      ) : !isMapping && !error && !paused ? (
        <p className="text-sm text-muted-foreground">Will start mapping automatically...</p>
      ) : null}
    </SectionCard>
  );
}
