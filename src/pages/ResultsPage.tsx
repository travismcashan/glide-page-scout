import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Image, FileText, Loader2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { firecrawlApi, screenshotApi, aiApi } from '@/lib/api/firecrawl';

type CrawlPage = {
  id: string;
  url: string;
  title: string | null;
  raw_content: string | null;
  ai_outline: string | null;
  screenshot_url: string | null;
  status: string;
};

type CrawlSession = {
  id: string;
  domain: string;
  base_url: string;
  status: string;
  created_at: string;
};

export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<CrawlSession | null>(null);
  const [pages, setPages] = useState<CrawlPage[]>([]);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [processingPages, setProcessingPages] = useState<Set<string>>(new Set());
  const [generatingOutline, setGeneratingOutline] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!sessionId) return;

    const [sessionRes, pagesRes] = await Promise.all([
      supabase.from('crawl_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('crawl_pages').select('*').eq('session_id', sessionId),
    ]);

    if (sessionRes.data) setSession(sessionRes.data as CrawlSession);
    if (pagesRes.data) {
      setPages(pagesRes.data as CrawlPage[]);
      // Auto-expand first page
      if (pagesRes.data.length > 0 && expandedPages.size === 0) {
        setExpandedPages(new Set([pagesRes.data[0].id]));
      }
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Process pending pages
  useEffect(() => {
    const pending = pages.filter(p => p.status === 'pending' && !processingPages.has(p.id));
    if (pending.length === 0) return;

    const processPage = async (page: CrawlPage) => {
      setProcessingPages(prev => new Set([...prev, page.id]));

      try {
        // Scrape content
        const scrapeResult = await firecrawlApi.scrape(page.url, { formats: ['markdown'] });
        const markdown = scrapeResult.data?.markdown || (scrapeResult as any).markdown || '';
        const title = scrapeResult.data?.metadata?.title || (scrapeResult as any).metadata?.title || page.url;

        // Get screenshot URL
        const screenshotResult = await screenshotApi.getUrl(page.url);

        // Update DB
        await supabase
          .from('crawl_pages')
          .update({
            raw_content: markdown,
            title,
            screenshot_url: screenshotResult.success ? screenshotResult.screenshotUrl : null,
            status: 'scraped',
          })
          .eq('id', page.id);

        // Refresh
        fetchData();
      } catch (error) {
        console.error('Error processing page:', page.url, error);
        await supabase
          .from('crawl_pages')
          .update({ status: 'error' })
          .eq('id', page.id);
        fetchData();
      }
    };

    // Process 3 at a time
    pending.slice(0, 3).forEach(processPage);
  }, [pages, processingPages, fetchData]);

  // Mark session complete when all pages done
  useEffect(() => {
    if (!session || session.status !== 'crawling') return;
    const allDone = pages.length > 0 && pages.every(p => p.status !== 'pending');
    if (allDone) {
      supabase
        .from('crawl_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id)
        .then(() => fetchData());
    }
  }, [pages, session, fetchData]);

  const generateOutline = async (page: CrawlPage) => {
    if (!page.raw_content) return;
    setGeneratingOutline(prev => new Set([...prev, page.id]));

    try {
      const result = await aiApi.generateOutline(page.raw_content, page.title || undefined, page.url);
      if (result.success && result.outline) {
        await supabase
          .from('crawl_pages')
          .update({ ai_outline: result.outline })
          .eq('id', page.id);
        fetchData();
        toast.success('Outline generated!');
      } else {
        toast.error(result.error || 'Failed to generate outline');
      }
    } catch {
      toast.error('Failed to generate outline');
    } finally {
      setGeneratingOutline(prev => {
        const next = new Set(prev);
        next.delete(page.id);
        return next;
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const completedCount = pages.filter(p => p.status === 'scraped' || p.status === 'error').length;
  const progress = pages.length > 0 ? Math.round((completedCount / pages.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-semibold">{session?.domain}</h1>
              <p className="text-xs text-muted-foreground">{session?.base_url}</p>
            </div>
          </div>
          <Badge variant={session?.status === 'completed' ? 'default' : 'secondary'}>
            {session?.status === 'completed' ? 'Complete' : `${progress}% — ${completedCount}/${pages.length}`}
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {pages.map((page) => {
          const isExpanded = expandedPages.has(page.id);
          const isPending = page.status === 'pending';

          return (
            <Collapsible key={page.id} open={isExpanded} onOpenChange={() => toggleExpand(page.id)}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    ) : page.status === 'error' ? (
                      <Badge variant="destructive" className="shrink-0">Error</Badge>
                    ) : (
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{page.title || page.url}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{page.url}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {page.status === 'scraped' && (
                    <div className="px-5 pb-5 space-y-4">
                      <div className="flex gap-2">
                        <a href={page.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3 w-3 mr-1" /> Visit
                          </Button>
                        </a>
                        {!page.ai_outline && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); generateOutline(page); }}
                            disabled={generatingOutline.has(page.id)}
                          >
                            {generatingOutline.has(page.id) ? (
                              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</>
                            ) : (
                              <><Zap className="h-3 w-3 mr-1" /> Generate AI Outline</>
                            )}
                          </Button>
                        )}
                      </div>

                      <Tabs defaultValue={page.ai_outline ? 'outline' : 'raw'} key={page.ai_outline ? 'has-outline' : 'no-outline'}>
                        <TabsList>
                          <TabsTrigger value="raw">Raw Content</TabsTrigger>
                          {page.ai_outline && <TabsTrigger value="outline">AI Outline</TabsTrigger>}
                        </TabsList>
                        <TabsContent value="raw" className="mt-3">
                          <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
                            <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                              {page.raw_content}
                            </pre>
                          </div>
                        </TabsContent>
                        {page.ai_outline && (
                          <TabsContent value="outline" className="mt-3">
                            <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
                              <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                                {page.ai_outline}
                              </pre>
                            </div>
                          </TabsContent>
                        )}
                      </Tabs>

                      {page.screenshot_url && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Image className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Full-Page Screenshot</span>
                          </div>
                          <div className="border border-border rounded-lg overflow-hidden">
                            <img
                              src={page.screenshot_url}
                              alt={`Screenshot of ${page.title || page.url}`}
                              className="w-full"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isPending && (
                    <div className="px-5 pb-5 flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Scraping content and capturing screenshot...</span>
                    </div>
                  )}
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </main>
    </div>
  );
}
