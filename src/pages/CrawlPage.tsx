import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Globe, Loader2, Search, ArrowRight, Zap } from 'lucide-react';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';

// Heuristic to detect primary nav pages
function isNavPage(url: string, baseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    if (parsed.origin !== base.origin) return false;
    const path = parsed.pathname.replace(/\/$/, '');
    if (!path || path === '') return true;
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 2) return false;
    // Filter out blog posts, utility pages
    const skipPatterns = /\b(blog|post|article|tag|category|author|page|wp-|feed|sitemap|cdn|assets|static|api|admin|login|signup|cart|checkout)\b/i;
    if (skipPatterns.test(path)) return false;
    return true;
  } catch {
    return false;
  }
}

export default function CrawlPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [isMapping, setIsMapping] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [showDiscovery, setShowDiscovery] = useState(false);

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsMapping(true);
    setShowDiscovery(false);

    try {
      const result = await firecrawlApi.map(url);
      const links = result.links || result.data?.links || [];

      if (!links.length) {
        toast.error('No pages found on this site');
        return;
      }

      const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
      const navPages = links.filter((u: string) => isNavPage(u, formattedUrl));
      
      setDiscoveredUrls(links);
      setSelectedUrls(new Set(navPages.length > 0 ? navPages : links.slice(0, 10)));
      setShowDiscovery(true);
      toast.success(`Found ${links.length} pages, ${navPages.length || Math.min(10, links.length)} auto-selected`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to discover pages');
    } finally {
      setIsMapping(false);
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

  const handleCrawl = async () => {
    if (selectedUrls.size === 0) {
      toast.error('Select at least one page');
      return;
    }

    setIsCrawling(true);

    try {
      const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
      const domain = new URL(formattedUrl).hostname;

      // Create crawl session
      const { data: session, error: sessionError } = await supabase
        .from('crawl_sessions')
        .insert({ domain, base_url: formattedUrl, status: 'crawling' })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Insert pages
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold tracking-tight">Glide Sales Prep</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
            History
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Prep for your next sales call
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Paste a prospect's URL to crawl their site, extract content outlines, and capture screenshots.
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
            <Button type="submit" size="lg" disabled={isMapping || !url.trim()}>
              {isMapping ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Discovering...</>
              ) : (
                <><Search className="h-4 w-4 mr-2" />Discover Pages</>
              )}
            </Button>
          </div>
        </form>

        {/* Page Discovery */}
        {showDiscovery && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {discoveredUrls.length} pages found
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedUrls.size} selected for crawling
                </p>
              </div>
              <Button onClick={handleCrawl} disabled={isCrawling || selectedUrls.size === 0}>
                {isCrawling ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Crawling...</>
                ) : (
                  <><ArrowRight className="h-4 w-4 mr-2" />Crawl Selected</>
                )}
              </Button>
            </div>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto rounded-lg border border-border bg-card p-2">
              {discoveredUrls.map((pageUrl) => {
                const isSelected = selectedUrls.has(pageUrl);
                return (
                  <label
                    key={pageUrl}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleUrl(pageUrl)}
                    />
                    <span className="text-sm font-mono truncate flex-1">{pageUrl}</span>
                    {isSelected && (
                      <Badge variant="secondary" className="text-xs shrink-0">selected</Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
