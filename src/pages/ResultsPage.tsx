import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Image, FileText, Loader2, Zap, Globe, Camera, Code, Gauge, Search, Layers, Leaf, X, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { firecrawlApi, screenshotApi, aiApi, gtmetrixApi, builtwithApi, semrushApi, pagespeedApi, wappalyzerApi, websiteCarbonApi } from '@/lib/api/firecrawl';
import { GtmetrixCard } from '@/components/GtmetrixCard';
import { BuiltWithCard } from '@/components/BuiltWithCard';
import { SemrushCard } from '@/components/SemrushCard';
import { PageSpeedCard } from '@/components/PageSpeedCard';
import { WappalyzerCard } from '@/components/WappalyzerCard';
import { WebsiteCarbonCard } from '@/components/WebsiteCarbonCard';
import { ScreenshotGallery } from '@/components/ScreenshotGallery';
import { UrlDiscoveryCard } from '@/components/UrlDiscoveryCard';
import { isIntegrationPaused } from '@/lib/integrationState';

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
  builtwith_data: any | null;
  semrush_data: any | null;
  psi_data: any | null;
  wappalyzer_data: any | null;
  carbon_data: any | null;
  gtmetrix_grade: string | null;
  gtmetrix_scores: any | null;
  gtmetrix_test_id: string | null;
};

function SectionCard({ title, icon, children, loading, loadingText }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span className="text-sm">{loadingText || 'Loading...'}</span>
          </div>
        ) : children}
      </div>
    </Card>
  );
}

export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<CrawlSession | null>(null);
  const [pages, setPages] = useState<CrawlPage[]>([]);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [processingPages, setProcessingPages] = useState<Set<string>>(new Set());
  const [generatingOutline, setGeneratingOutline] = useState<Set<string>>(new Set());
  const [runningGtmetrix, setRunningGtmetrix] = useState(false);
  const [builtwithLoading, setBuiltwithLoading] = useState(false);
  const [semrushLoading, setSemrushLoading] = useState(false);
  const [psiLoading, setPsiLoading] = useState(false);
  const [wappalyzerLoading, setWappalyzerLoading] = useState(false);
  const [carbonLoading, setCarbonLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!sessionId) return;

    const [sessionRes, pagesRes] = await Promise.all([
      supabase.from('crawl_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('crawl_pages').select('*').eq('session_id', sessionId),
    ]);

    if (sessionRes.data) setSession(sessionRes.data as unknown as CrawlSession);
    if (pagesRes.data) {
      setPages(pagesRes.data as unknown as CrawlPage[]);
      if (pagesRes.data.length > 0 && expandedPages.size === 0) {
        setExpandedPages(new Set([pagesRes.data[0].id]));
      }
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // BuiltWith
  useEffect(() => {
    if (!session || session.builtwith_data || builtwithLoading || isIntegrationPaused('builtwith')) return;
    setBuiltwithLoading(true);
    builtwithApi.lookup(session.domain).then(async (result) => {
      if (result.success && result.grouped) {
        await supabase.from('crawl_sessions').update({ builtwith_data: { grouped: result.grouped, totalCount: result.totalCount } } as any).eq('id', session.id);
        fetchData();
      }
      setBuiltwithLoading(false);
    }).catch(() => setBuiltwithLoading(false));
  }, [session, builtwithLoading, fetchData]);

  // SEMrush
  useEffect(() => {
    if (!session || session.semrush_data || semrushLoading || isIntegrationPaused('semrush')) return;
    setSemrushLoading(true);
    semrushApi.domainOverview(session.domain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ semrush_data: { overview: result.overview, organicKeywords: result.organicKeywords, backlinks: result.backlinks } } as any).eq('id', session.id);
        fetchData();
      }
      setSemrushLoading(false);
    }).catch(() => setSemrushLoading(false));
  }, [session, semrushLoading, fetchData]);

  // PageSpeed Insights
  const [psiFailed, setPsiFailed] = useState(false);
  useEffect(() => {
    if (!session || session.psi_data || psiLoading || psiFailed || isIntegrationPaused('psi')) return;
    setPsiLoading(true);
    pagespeedApi.analyze(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ psi_data: { mobile: result.mobile, desktop: result.desktop } } as any).eq('id', session.id);
        fetchData();
      } else { setPsiFailed(true); }
      setPsiLoading(false);
    }).catch(() => { setPsiFailed(true); setPsiLoading(false); });
  }, [session, psiLoading, psiFailed, fetchData]);

  // Wappalyzer
  const [wappalyzerFailed, setWappalyzerFailed] = useState(false);
  useEffect(() => {
    if (!session || session.wappalyzer_data || wappalyzerLoading || wappalyzerFailed || isIntegrationPaused('wappalyzer')) return;
    setWappalyzerLoading(true);
    wappalyzerApi.lookup(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ wappalyzer_data: { grouped: result.grouped, totalCount: result.totalCount, social: result.social } } as any).eq('id', session.id);
        fetchData();
      } else { setWappalyzerFailed(true); }
      setWappalyzerLoading(false);
    }).catch(() => { setWappalyzerFailed(true); setWappalyzerLoading(false); });
  }, [session, wappalyzerLoading, wappalyzerFailed, fetchData]);

  // GTmetrix
  const [gtmetrixFailed, setGtmetrixFailed] = useState(false);
  useEffect(() => {
    if (!session || session.gtmetrix_grade || session.gtmetrix_test_id || runningGtmetrix || gtmetrixFailed || isIntegrationPaused('gtmetrix')) return;
    setRunningGtmetrix(true);
    gtmetrixApi.runTest(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ gtmetrix_grade: result.grade, gtmetrix_scores: result.scores, gtmetrix_test_id: result.testId } as any).eq('id', session.id);
        fetchData();
      } else { setGtmetrixFailed(true); }
      setRunningGtmetrix(false);
    }).catch(() => { setGtmetrixFailed(true); setRunningGtmetrix(false); });
  }, [session, runningGtmetrix, gtmetrixFailed, fetchData]);

  // Website Carbon
  const [carbonFailed, setCarbonFailed] = useState(false);
  useEffect(() => {
    if (!session || session.carbon_data || carbonLoading || carbonFailed || isIntegrationPaused('carbon')) return;
    setCarbonLoading(true);
    websiteCarbonApi.check(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ carbon_data: { green: result.green, bytes: result.bytes, cleanerThan: result.cleanerThan, statistics: result.statistics, rating: result.rating } } as any).eq('id', session.id);
        fetchData();
      } else { setCarbonFailed(true); }
      setCarbonLoading(false);
    }).catch(() => { setCarbonFailed(true); setCarbonLoading(false); });
  }, [session, carbonLoading, carbonFailed, fetchData]);

  // Process pending pages
  useEffect(() => {
    const pending = pages.filter(p => p.status === 'pending' && !processingPages.has(p.id));
    if (pending.length === 0) return;

    const processPage = async (page: CrawlPage) => {
      setProcessingPages(prev => new Set([...prev, page.id]));
      try {
        const scrapeResult = await firecrawlApi.scrape(page.url, { formats: ['markdown'] });
        const markdown = scrapeResult.data?.markdown || (scrapeResult as any).markdown || '';
        const title = scrapeResult.data?.metadata?.title || (scrapeResult as any).metadata?.title || page.url;
        const screenshotResult = await screenshotApi.getUrl(page.url);
        await supabase.from('crawl_pages').update({ raw_content: markdown, title, screenshot_url: screenshotResult.success ? screenshotResult.screenshotUrl : null, status: 'scraped' }).eq('id', page.id);
        if (markdown) {
          const outlineResult = await aiApi.generateOutline(markdown, title, page.url);
          if (outlineResult.success && outlineResult.outline) {
            await supabase.from('crawl_pages').update({ ai_outline: outlineResult.outline }).eq('id', page.id);
          }
        }
        fetchData();
      } catch (error) {
        console.error('Error processing page:', page.url, error);
        await supabase.from('crawl_pages').update({ status: 'error' }).eq('id', page.id);
        fetchData();
      }
    };
    pending.slice(0, 3).forEach(processPage);
  }, [pages, processingPages, fetchData]);

  // Mark session complete
  useEffect(() => {
    if (!session || session.status !== 'crawling') return;
    const allDone = pages.length > 0 && pages.every(p => p.status !== 'pending');
    if (allDone) {
      supabase.from('crawl_sessions').update({ status: 'completed' }).eq('id', session.id).then(() => fetchData());
    }
  }, [pages, session, fetchData]);

  const generateOutline = async (page: CrawlPage) => {
    if (!page.raw_content) return;
    setGeneratingOutline(prev => new Set([...prev, page.id]));
    try {
      const result = await aiApi.generateOutline(page.raw_content, page.title || undefined, page.url);
      if (result.success && result.outline) {
        await supabase.from('crawl_pages').update({ ai_outline: result.outline }).eq('id', page.id);
        fetchData();
        toast.success('Outline generated!');
      } else { toast.error(result.error || 'Failed to generate outline'); }
    } catch { toast.error('Failed to generate outline'); } finally {
      setGeneratingOutline(prev => { const next = new Set(prev); next.delete(page.id); return next; });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
  const scrapedPages = pages.filter(p => p.status === 'scraped');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-semibold text-lg">{session?.domain}</h1>
              <p className="text-xs text-muted-foreground">{session?.base_url}</p>
            </div>
          </div>
          {session?.status === 'analyzing' ? (
            <Badge variant="secondary">Analyzing</Badge>
          ) : session?.status === 'completed' ? (
            <Badge variant="default">Complete</Badge>
          ) : pages.length > 0 ? (
            <Badge variant="secondary">{progress}% — {completedCount}/{pages.length} scraped</Badge>
          ) : null}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── URL Discovery ── */}
        {session && (
          <UrlDiscoveryCard
            sessionId={session.id}
            baseUrl={session.base_url}
            domain={session.domain}
            onPagesAdded={fetchData}
            existingPageUrls={new Set(pages.map(p => p.url))}
            existingScreenshotUrls={new Set(pages.filter(p => p.screenshot_url).map(p => p.url))}
          />
        )}

        {/* ── Technology Detection ── */}
        <SectionCard title="BuiltWith — Technology Stack" icon={<Code className="h-5 w-5 text-foreground" />} loading={builtwithLoading && !session?.builtwith_data} loadingText="Detecting technology stack...">
          {session?.builtwith_data ? (
            <BuiltWithCard grouped={session.builtwith_data.grouped} totalCount={session.builtwith_data.totalCount} isLoading={false} />
          ) : !builtwithLoading ? (
            <p className="text-sm text-muted-foreground">Technology detection will run automatically.</p>
          ) : null}
        </SectionCard>

        <SectionCard title="Wappalyzer — Technology Profiling" icon={<Layers className="h-5 w-5 text-foreground" />} loading={wappalyzerLoading && !session?.wappalyzer_data} loadingText="Running Wappalyzer detection...">
          {session?.wappalyzer_data ? (
            <WappalyzerCard data={session.wappalyzer_data} isLoading={false} />
          ) : !wappalyzerLoading ? null : null}
        </SectionCard>

        {/* ── Performance ── */}
        <SectionCard title="GTmetrix — Performance Audit" icon={<Zap className="h-5 w-5 text-foreground" />} loading={runningGtmetrix} loadingText="Running GTmetrix performance test...">
          <GtmetrixCard grade={session?.gtmetrix_grade || null} scores={session?.gtmetrix_scores || null} testId={session?.gtmetrix_test_id || null} isRunning={false} />
        </SectionCard>

        <SectionCard title="PageSpeed Insights — Lighthouse" icon={<Gauge className="h-5 w-5 text-foreground" />} loading={psiLoading && !session?.psi_data} loadingText="Running PageSpeed Insights (mobile + desktop)...">
          {session?.psi_data ? (
            <PageSpeedCard data={session.psi_data} isLoading={false} />
          ) : null}
        </SectionCard>

        <SectionCard title="Website Carbon — Sustainability" icon={<Leaf className="h-5 w-5 text-foreground" />} loading={carbonLoading && !session?.carbon_data} loadingText="Measuring carbon footprint...">
          {session?.carbon_data ? (
            <WebsiteCarbonCard data={session.carbon_data} isLoading={false} />
          ) : null}
        </SectionCard>

        {/* ── SEO ── */}
        <SectionCard title="SEMrush — Domain Analysis" icon={<Search className="h-5 w-5 text-foreground" />} loading={semrushLoading && !session?.semrush_data} loadingText="Pulling SEMrush data...">
          {session?.semrush_data ? (
            <SemrushCard data={session.semrush_data} isLoading={false} />
          ) : null}
        </SectionCard>

        {/* ── Page Screenshots ── */}
        {scrapedPages.some(p => p.screenshot_url) && (
          <ScreenshotGallery pages={scrapedPages.filter(p => p.screenshot_url)} />
        )}

        {/* ── Page Content ── */}
        {scrapedPages.length > 0 && (
          <SectionCard title="Page Content" icon={<FileText className="h-5 w-5 text-foreground" />}>
            <div className="space-y-3">
              {scrapedPages.map(page => {
                const isExpanded = expandedPages.has(page.id);
                return (
                  <Collapsible key={page.id} open={isExpanded} onOpenChange={() => toggleExpand(page.id)}>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{page.title || page.url}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{page.url}</p>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3">
                          <div className="flex gap-2">
                            <a href={page.url} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" /> Visit</Button>
                            </a>
                            {!page.ai_outline && (
                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); generateOutline(page); }} disabled={generatingOutline.has(page.id)}>
                                {generatingOutline.has(page.id) ? (<><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</>) : (<><Zap className="h-3 w-3 mr-1" /> Generate AI Outline</>)}
                              </Button>
                            )}
                          </div>
                          <Tabs defaultValue={page.ai_outline ? 'outline' : 'raw'} key={page.ai_outline ? 'has-outline' : 'no-outline'}>
                            <TabsList>
                              <TabsTrigger value="raw">Raw Content</TabsTrigger>
                              {page.ai_outline && <TabsTrigger value="outline">Cleaned Content</TabsTrigger>}
                            </TabsList>
                            <TabsContent value="raw" className="mt-3">
                              <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-a:text-primary prose-strong:text-foreground">
                                <Suspense fallback={<pre className="text-sm whitespace-pre-wrap">{page.raw_content}</pre>}>
                                  <ReactMarkdown>{page.raw_content || ''}</ReactMarkdown>
                                </Suspense>
                              </div>
                            </TabsContent>
                            {page.ai_outline && (
                              <TabsContent value="outline" className="mt-3">
                                <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-a:text-primary prose-strong:text-foreground">
                                  <Suspense fallback={<pre className="text-sm whitespace-pre-wrap">{page.ai_outline}</pre>}>
                                    <ReactMarkdown>{page.ai_outline}</ReactMarkdown>
                                  </Suspense>
                                </div>
                              </TabsContent>
                            )}
                          </Tabs>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* ── Scraped Page Status ── */}
        {pages.length > 0 && (
          <SectionCard title="Scrape Progress" icon={<Globe className="h-5 w-5 text-foreground" />}>
            <div className="space-y-1">
              {pages.map(page => (
                <div key={page.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {page.status === 'pending' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    ) : page.status === 'error' ? (
                      <Badge variant="destructive" className="shrink-0 text-[10px]">Error</Badge>
                    ) : (
                      <Badge variant="default" className="shrink-0 text-[10px]">Done</Badge>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{page.title || page.url}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{page.url}</p>
                    </div>
                  </div>
                  <a href={page.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="shrink-0"><ExternalLink className="h-3 w-3" /></Button>
                  </a>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

      </main>
    </div>
  );
}
