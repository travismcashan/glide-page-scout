import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Globe, Loader2, Pause } from 'lucide-react';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { isIntegrationPaused } from '@/lib/integrationState';

type Props = {
  baseUrl: string;
  onUrlsDiscovered: (urls: string[]) => void;
};

export function UrlDiscoveryCard({ baseUrl, onUrlsDiscovered }: Props) {
  const [isMapping, setIsMapping] = useState(false);
  const [allUrls, setAllUrls] = useState<string[]>([]);
  const [discoveryDone, setDiscoveryDone] = useState(false);
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
    } catch (error) {
      console.error(error);
      toast.error('Failed to discover pages');
      setIsMapping(false);
      setDiscoveryDone(true);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Globe className="h-5 w-5 text-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Discovered URLs</h2>
        {discoveryDone && (
          <Badge variant="secondary" className="ml-auto">{allUrls.length} pages</Badge>
        )}
      </div>
      <div className="p-6">
        {paused ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Pause className="h-4 w-4 shrink-0" />
            <span className="text-sm">URL Discovery is paused. Enable it in Integrations.</span>
          </div>
        ) : isMapping ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span className="text-sm">Mapping site URLs...</span>
          </div>
        ) : discoveryDone ? (
          <div className="space-y-1 max-h-[300px] overflow-y-auto rounded-lg border border-border bg-card p-2">
            {allUrls.map(url => (
              <div key={url} className="px-3 py-1.5 text-sm font-mono truncate text-muted-foreground">
                {url}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Will start mapping automatically...</p>
        )}
      </div>
    </Card>
  );
}
