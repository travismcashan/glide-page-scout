import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Globe } from 'lucide-react';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { isIntegrationPaused } from '@/lib/integrationState';
import { SectionCard } from '@/components/SectionCard';

type Props = {
  baseUrl: string;
  onUrlsDiscovered: (urls: string[]) => void;
};

export function UrlDiscoveryCard({ baseUrl, onUrlsDiscovered }: Props) {
  const [isMapping, setIsMapping] = useState(false);
  const [allUrls, setAllUrls] = useState<string[]>([]);
  const [discoveryDone, setDiscoveryDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = isIntegrationPaused('url-discovery');

  useEffect(() => {
    if (discoveryDone || isMapping || paused) return;
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
            return parsed.toString().replace(/\/+$/, '');
          } catch { return u.replace(/\/+$/, ''); }
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
      title="Discovered URLs"
      icon={<Globe className="h-5 w-5 text-foreground" />}
      paused={paused}
      loading={isMapping}
      loadingText="Mapping site URLs..."
      error={!!error}
      errorText={error || undefined}
      headerExtra={discoveryDone && !error ? <Badge variant="secondary">{allUrls.length} pages</Badge> : undefined}
    >
      {discoveryDone && !error ? (
        <div className="space-y-1 max-h-[300px] overflow-y-auto rounded-lg border border-border bg-card p-2">
          {allUrls.map(url => (
            <div key={url} className="px-3 py-1.5 text-sm font-mono truncate text-muted-foreground">
              {url}
            </div>
          ))}
        </div>
      ) : !isMapping && !error && !paused ? (
        <p className="text-sm text-muted-foreground">Will start mapping automatically...</p>
      ) : null}
    </SectionCard>
  );
}
