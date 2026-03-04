import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ArrowLeft, Building2, ChevronDown, ChevronUp, ExternalLink, FileText, Loader2, Zap, Globe, Code, Gauge, Search, Layers, Leaf, Users, Accessibility, Eye, Shield, Lock, Link, LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { firecrawlApi, screenshotApi, aiApi, gtmetrixApi, builtwithApi, semrushApi, pagespeedApi, wappalyzerApi, websiteCarbonApi, cruxApi, waveApi, observatoryApi, oceanApi, ssllabsApi, httpstatusApi, linkCheckerApi, w3cApi, schemaApi } from '@/lib/api/firecrawl';
import { GtmetrixCard } from '@/components/GtmetrixCard';
import { BuiltWithCard } from '@/components/BuiltWithCard';
import { SemrushCard } from '@/components/SemrushCard';
import { PageSpeedCard } from '@/components/PageSpeedCard';
import { WappalyzerCard } from '@/components/WappalyzerCard';
import { WebsiteCarbonCard } from '@/components/WebsiteCarbonCard';
import { CruxCard } from '@/components/CruxCard';
import { LighthouseAccessibilityCard, extractPsiAccessibility } from '@/components/LighthouseAccessibilityCard';
import { WaveCard } from '@/components/WaveCard';
import { ObservatoryCard } from '@/components/ObservatoryCard';
import OceanCard from '@/components/OceanCard';
import SslLabsCard from '@/components/SslLabsCard';
import { HttpStatusCard } from '@/components/HttpStatusCard';
import { BrokenLinksCard } from '@/components/BrokenLinksCard';
import { W3CCard } from '@/components/W3CCard';
import { SchemaCard } from '@/components/SchemaCard';
import { ScreenshotGallery } from '@/components/ScreenshotGallery';
import { UrlDiscoveryCard } from '@/components/UrlDiscoveryCard';
import { ScreenshotPickerCard } from '@/components/ScreenshotPickerCard';
import { ContentPickerCard } from '@/components/ContentPickerCard';
import { isIntegrationPaused } from '@/lib/integrationState';
import { SectionCard } from '@/components/SectionCard';

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
  crux_data: any | null;
  wave_data: any | null;
  observatory_data: any | null;
  ocean_data: any | null;
  ssllabs_data: any | null;
  httpstatus_data: any | null;
  linkcheck_data: any | null;
  w3c_data: any | null;
  schema_data: any | null;
  gtmetrix_grade: string | null;
  gtmetrix_scores: any | null;
  gtmetrix_test_id: string | null;
};


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
  const [cruxLoading, setCruxLoading] = useState(false);
  const [waveLoading, setWaveLoading] = useState(false);
  const [observatoryLoading, setObservatoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  // Error tracking per integration
  const [integrationErrors, setIntegrationErrors] = useState<Record<string, string>>({});
  const setError = (key: string, msg: string) => setIntegrationErrors(prev => ({ ...prev, [key]: msg }));
  const clearError = (key: string) => setIntegrationErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
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

  useEffect(() => { fetchData(); }, [fetchData]);

  // BuiltWith
  const [builtwithFailed, setBuiltwithFailed] = useState(false);
  const [builtwithCredits, setBuiltwithCredits] = useState<{ available?: string | null; used?: string | null; remaining?: string | null } | null>(null);
  useEffect(() => {
    if (!session || session.builtwith_data || builtwithLoading || builtwithFailed || isIntegrationPaused('builtwith')) return;
    setBuiltwithLoading(true);
    builtwithApi.lookup(session.domain).then(async (result) => {
      if (result.credits) setBuiltwithCredits(result.credits);
      if (result.success && result.grouped) {
        await supabase.from('crawl_sessions').update({ builtwith_data: { grouped: result.grouped, totalCount: result.totalCount } } as any).eq('id', session.id);
        clearError('builtwith');
        fetchData();
      } else {
        setBuiltwithFailed(true);
        setError('builtwith', result.error || 'BuiltWith API returned an error');
      }
      setBuiltwithLoading(false);
    }).catch((e) => { setBuiltwithFailed(true); setError('builtwith', e?.message || 'BuiltWith request failed'); setBuiltwithLoading(false); });
  }, [session, builtwithLoading, builtwithFailed, fetchData]);

  // SEMrush
  const [semrushFailed, setSemrushFailed] = useState(false);
  useEffect(() => {
    if (!session || session.semrush_data || semrushLoading || semrushFailed || isIntegrationPaused('semrush')) return;
    setSemrushLoading(true);
    semrushApi.domainOverview(session.domain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ semrush_data: { overview: result.overview, organicKeywords: result.organicKeywords, backlinks: result.backlinks } } as any).eq('id', session.id);
        clearError('semrush');
        fetchData();
      } else {
        setSemrushFailed(true);
        setError('semrush', result.error || 'SEMrush API returned an error');
      }
      setSemrushLoading(false);
    }).catch((e) => { setSemrushFailed(true); setError('semrush', e?.message || 'SEMrush request failed'); setSemrushLoading(false); });
  }, [session, semrushLoading, semrushFailed, fetchData]);

  // PSI
  const [psiFailed, setPsiFailed] = useState(false);
  useEffect(() => {
    if (!session || session.psi_data || psiLoading || psiFailed || isIntegrationPaused('psi')) return;
    setPsiLoading(true);
    pagespeedApi.analyze(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ psi_data: { mobile: result.mobile, desktop: result.desktop } } as any).eq('id', session.id);
        clearError('psi');
        fetchData();
      } else { setPsiFailed(true); setError('psi', result.error || 'PageSpeed Insights returned an error'); }
      setPsiLoading(false);
    }).catch((e) => { setPsiFailed(true); setError('psi', e?.message || 'PageSpeed request failed'); setPsiLoading(false); });
  }, [session, psiLoading, psiFailed, fetchData]);

  // Wappalyzer
  const [wappalyzerFailed, setWappalyzerFailed] = useState(false);
  useEffect(() => {
    if (!session || session.wappalyzer_data || wappalyzerLoading || wappalyzerFailed || isIntegrationPaused('wappalyzer')) return;
    setWappalyzerLoading(true);
    wappalyzerApi.lookup(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ wappalyzer_data: { grouped: result.grouped, totalCount: result.totalCount, social: result.social } } as any).eq('id', session.id);
        clearError('wappalyzer');
        fetchData();
      } else { setWappalyzerFailed(true); setError('wappalyzer', result.error || 'Wappalyzer returned an error'); }
      setWappalyzerLoading(false);
    }).catch((e) => { setWappalyzerFailed(true); setError('wappalyzer', e?.message || 'Wappalyzer request failed'); setWappalyzerLoading(false); });
  }, [session, wappalyzerLoading, wappalyzerFailed, fetchData]);

  // GTmetrix
  const [gtmetrixFailed, setGtmetrixFailed] = useState(false);
  useEffect(() => {
    if (!session || session.gtmetrix_grade || session.gtmetrix_test_id || runningGtmetrix || gtmetrixFailed || isIntegrationPaused('gtmetrix')) return;
    setRunningGtmetrix(true);
    gtmetrixApi.runTest(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ gtmetrix_grade: result.grade, gtmetrix_scores: result.scores, gtmetrix_test_id: result.testId } as any).eq('id', session.id);
        clearError('gtmetrix');
        fetchData();
      } else { setGtmetrixFailed(true); setError('gtmetrix', result.error || 'GTmetrix returned an error'); }
      setRunningGtmetrix(false);
    }).catch((e) => { setGtmetrixFailed(true); setError('gtmetrix', e?.message || 'GTmetrix request failed'); setRunningGtmetrix(false); });
  }, [session, runningGtmetrix, gtmetrixFailed, fetchData]);

  // Carbon
  const [carbonFailed, setCarbonFailed] = useState(false);
  useEffect(() => {
    if (!session || session.carbon_data || carbonLoading || carbonFailed || isIntegrationPaused('carbon')) return;
    setCarbonLoading(true);
    websiteCarbonApi.check(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ carbon_data: { green: result.green, bytes: result.bytes, cleanerThan: result.cleanerThan, statistics: result.statistics, rating: result.rating } } as any).eq('id', session.id);
        clearError('carbon');
        fetchData();
      } else { setCarbonFailed(true); setError('carbon', result.error || 'Website Carbon returned an error'); }
      setCarbonLoading(false);
    }).catch((e) => { setCarbonFailed(true); setError('carbon', e?.message || 'Website Carbon request failed'); setCarbonLoading(false); });
  }, [session, carbonLoading, carbonFailed, fetchData]);

  // CrUX
  const [cruxFailed, setCruxFailed] = useState(false);
  const [cruxNoData, setCruxNoData] = useState(false);
  useEffect(() => {
    if (!session || session.crux_data || cruxLoading || cruxFailed || isIntegrationPaused('crux')) return;
    setCruxLoading(true);
    cruxApi.lookup(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ crux_data: { overall: result.overall, phone: result.phone, desktop: result.desktop, collectionPeriod: result.collectionPeriod } } as any).eq('id', session.id);
        clearError('crux');
        fetchData();
      } else if (result.noData) {
        setCruxNoData(true);
      } else { setCruxFailed(true); setError('crux', result.error || 'CrUX returned an error'); }
      setCruxLoading(false);
    }).catch((e) => { setCruxFailed(true); setError('crux', e?.message || 'CrUX request failed'); setCruxLoading(false); });
  }, [session, cruxLoading, cruxFailed, fetchData]);

  // WAVE
  const [waveFailed, setWaveFailed] = useState(false);
  useEffect(() => {
    if (!session || session.wave_data || waveLoading || waveFailed || isIntegrationPaused('wave')) return;
    setWaveLoading(true);
    waveApi.scan(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ wave_data: { summary: result.summary, items: result.items, waveUrl: result.waveUrl, creditsRemaining: result.creditsRemaining, pageTitle: result.pageTitle } } as any).eq('id', session.id);
        clearError('wave');
        fetchData();
      } else { setWaveFailed(true); setError('wave', result.error || 'WAVE returned an error'); }
      setWaveLoading(false);
    }).catch((e) => { setWaveFailed(true); setError('wave', e?.message || 'WAVE request failed'); setWaveLoading(false); });
  }, [session, waveLoading, waveFailed, fetchData]);

  // Mozilla Observatory
  const [observatoryFailed, setObservatoryFailed] = useState(false);
  useEffect(() => {
    if (!session || session.observatory_data || observatoryLoading || observatoryFailed || isIntegrationPaused('observatory')) return;
    setObservatoryLoading(true);
    observatoryApi.scan(session.domain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ observatory_data: { grade: result.grade, score: result.score, scannedAt: result.scannedAt, detailsUrl: result.detailsUrl, tests: result.tests, rawHeaders: result.rawHeaders || null, cspRaw: result.cspRaw || null, cspDirectives: result.cspDirectives || null, cookies: result.cookies || null } } as any).eq('id', session.id);
        clearError('observatory');
        fetchData();
      } else { setObservatoryFailed(true); setError('observatory', result.error || 'Observatory returned an error'); }
      setObservatoryLoading(false);
    }).catch((e) => { setObservatoryFailed(true); setError('observatory', e?.message || 'Observatory request failed'); setObservatoryLoading(false); });
  }, [session, observatoryLoading, observatoryFailed, fetchData]);

  // Ocean.io
  const [oceanLoading, setOceanLoading] = useState(false);
  const [oceanFailed, setOceanFailed] = useState(false);
  useEffect(() => {
    if (!session || session.ocean_data || oceanLoading || oceanFailed || isIntegrationPaused('ocean')) return;
    setOceanLoading(true);
    oceanApi.enrich(session.domain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ ocean_data: result } as any).eq('id', session.id);
        clearError('ocean');
        fetchData();
      } else { setOceanFailed(true); setError('ocean', result.error || 'Ocean.io returned an error'); }
      setOceanLoading(false);
    }).catch((e) => { setOceanFailed(true); setError('ocean', e?.message || 'Ocean.io request failed'); setOceanLoading(false); });
  }, [session, oceanLoading, oceanFailed, fetchData]);

  // SSL Labs (client-side polling to avoid edge function timeout)
  const [ssllabsLoading, setSsllabsLoading] = useState(false);
  const [ssllabsFailed, setSsllabsFailed] = useState(false);
  const ssllabsPollingRef = useRef(false);
  useEffect(() => {
    if (!session || session.ssllabs_data || ssllabsLoading || ssllabsFailed || isIntegrationPaused('ssllabs') || ssllabsPollingRef.current) return;
    ssllabsPollingRef.current = true;
    setSsllabsLoading(true);

    (async () => {
      try {
        // 1. Start the scan
        const startResult = await ssllabsApi.start(session.domain);
        if (!startResult.success) {
          setSsllabsFailed(true);
          setError('ssllabs', startResult.error || 'SSL Labs start failed');
          setSsllabsLoading(false);
          return;
        }
        // If already READY on first call
        if (startResult.status === 'READY') {
          await supabase.from('crawl_sessions').update({ ssllabs_data: startResult } as any).eq('id', session.id);
          clearError('ssllabs');
          fetchData();
          setSsllabsLoading(false);
          return;
        }

        // 2. Poll every 10s, up to 5 minutes
        const maxPolls = 30;
        for (let i = 0; i < maxPolls; i++) {
          await new Promise(r => setTimeout(r, 10000));
          const pollResult = await ssllabsApi.poll(session.domain);
          if (!pollResult.success) {
            setSsllabsFailed(true);
            setError('ssllabs', pollResult.error || 'SSL Labs poll error');
            setSsllabsLoading(false);
            return;
          }
          if (pollResult.status === 'READY') {
            await supabase.from('crawl_sessions').update({ ssllabs_data: pollResult } as any).eq('id', session.id);
            clearError('ssllabs');
            fetchData();
            setSsllabsLoading(false);
            return;
          }
          if (pollResult.status === 'ERROR') {
            setSsllabsFailed(true);
            setError('ssllabs', 'SSL Labs assessment failed');
            setSsllabsLoading(false);
            return;
          }
          // Otherwise keep polling (DNS, IN_PROGRESS, OVERLOADED)
        }
        // Timed out after 5 min
        setSsllabsFailed(true);
        setError('ssllabs', 'SSL Labs scan timed out after 5 minutes — try again later');
        setSsllabsLoading(false);
      } catch (e: any) {
        setSsllabsFailed(true);
        setError('ssllabs', e?.message || 'SSL Labs request failed');
        setSsllabsLoading(false);
      }
    })();
  }, [session, ssllabsLoading, ssllabsFailed, fetchData]);

  // httpstatus.io
  const [httpstatusLoading, setHttpstatusLoading] = useState(false);
  const [httpstatusFailed, setHttpstatusFailed] = useState(false);
  useEffect(() => {
    if (!session || session.httpstatus_data || httpstatusLoading || httpstatusFailed || isIntegrationPaused('httpstatus')) return;
    setHttpstatusLoading(true);
    httpstatusApi.check(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ httpstatus_data: result } as any).eq('id', session.id);
        clearError('httpstatus');
        fetchData();
      } else { setHttpstatusFailed(true); setError('httpstatus', result.error || 'httpstatus.io returned an error'); }
      setHttpstatusLoading(false);
    }).catch((e) => { setHttpstatusFailed(true); setError('httpstatus', e?.message || 'httpstatus.io request failed'); setHttpstatusLoading(false); });
  }, [session, httpstatusLoading, httpstatusFailed, fetchData]);

  // W3C HTML/CSS Validation
  const [w3cLoading, setW3cLoading] = useState(false);
  const [w3cFailed, setW3cFailed] = useState(false);
  useEffect(() => {
    if (!session || session.w3c_data || w3cLoading || w3cFailed || isIntegrationPaused('w3c')) return;
    setW3cLoading(true);
    w3cApi.validate(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ w3c_data: result } as any).eq('id', session.id);
        clearError('w3c');
        fetchData();
      } else { setW3cFailed(true); setError('w3c', result.error || 'W3C validation failed'); }
      setW3cLoading(false);
    }).catch((e) => { setW3cFailed(true); setError('w3c', e?.message || 'W3C validation request failed'); setW3cLoading(false); });
  }, [session, w3cLoading, w3cFailed, fetchData]);

  // Schema.org / Rich Results
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaFailed, setSchemaFailed] = useState(false);
  useEffect(() => {
    if (!session || session.schema_data || schemaLoading || schemaFailed || isIntegrationPaused('schema')) return;
    setSchemaLoading(true);
    schemaApi.validate(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ schema_data: result } as any).eq('id', session.id);
        clearError('schema');
        fetchData();
      } else { setSchemaFailed(true); setError('schema', result.error || 'Schema validation failed'); }
      setSchemaLoading(false);
    }).catch((e) => { setSchemaFailed(true); setError('schema', e?.message || 'Schema validation request failed'); setSchemaLoading(false); });
  }, [session, schemaLoading, schemaFailed, fetchData]);

  // Broken Link Checker
  const [linkcheckLoading, setLinkcheckLoading] = useState(false);
  const [linkcheckFailed, setLinkcheckFailed] = useState(false);
  useEffect(() => {
    if (!session || session.linkcheck_data || linkcheckLoading || linkcheckFailed || isIntegrationPaused('link-checker') || discoveredUrls.length === 0) return;
    setLinkcheckLoading(true);
    linkCheckerApi.check(discoveredUrls).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ linkcheck_data: result } as any).eq('id', session.id);
        clearError('link-checker');
        fetchData();
      } else { setLinkcheckFailed(true); setError('link-checker', result.error || 'Link checker returned an error'); }
      setLinkcheckLoading(false);
    }).catch((e) => { setLinkcheckFailed(true); setError('link-checker', e?.message || 'Link checker request failed'); setLinkcheckLoading(false); });
  }, [session, linkcheckLoading, linkcheckFailed, discoveredUrls, fetchData]);

  useEffect(() => {
    const pending = pages.filter(p => p.status === 'pending' && !processingPages.has(p.id));
    if (pending.length === 0) return;
    const processPage = async (page: CrawlPage) => {
      setProcessingPages(prev => new Set([...prev, page.id]));
      try {
        // Run scrape and screenshot in parallel, each with its own error handling
        const [scrapeResult, screenshotResult] = await Promise.allSettled([
          firecrawlApi.scrape(page.url, { formats: ['markdown'] }),
          screenshotApi.getUrl(page.url),
        ]);

        const scrapeData = scrapeResult.status === 'fulfilled' ? scrapeResult.value : null;
        const screenshotData = screenshotResult.status === 'fulfilled' ? screenshotResult.value : null;

        const markdown = scrapeData?.data?.markdown || (scrapeData as any)?.markdown || '';
        const title = scrapeData?.data?.metadata?.title || (scrapeData as any)?.metadata?.title || page.url;
        const screenshotUrl = screenshotData?.success ? screenshotData.screenshotUrl : null;

        await supabase.from('crawl_pages').update({
          raw_content: markdown || null,
          title,
          screenshot_url: screenshotUrl || null,
          status: markdown || screenshotUrl ? 'scraped' : 'error',
        }).eq('id', page.id);

        // Generate outline independently — don't block on failure
        if (markdown) {
          try {
            const outlineResult = await aiApi.generateOutline(markdown, title, page.url);
            if (outlineResult.success && outlineResult.outline) {
              await supabase.from('crawl_pages').update({ ai_outline: outlineResult.outline }).eq('id', page.id);
            }
          } catch (e) { console.error('Outline generation failed for:', page.url, e); }
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
        {session && !isIntegrationPaused('url-discovery') && (
          <UrlDiscoveryCard
            baseUrl={session.base_url}
            onUrlsDiscovered={setDiscoveredUrls}
            linkCheckResults={session.linkcheck_data?.results || null}
          />
        )}

        {/* ── Screenshots Picker ── */}
        {session && !isIntegrationPaused('screenshots') && (
          <ScreenshotPickerCard
            sessionId={session.id}
            baseUrl={session.base_url}
            discoveredUrls={discoveredUrls}
            existingScreenshotUrls={new Set(pages.filter(p => p.screenshot_url).map(p => p.url))}
            onPagesAdded={fetchData}
          />
        )}

        {/* ── Content Picker ── */}
        {session && !isIntegrationPaused('content') && (
          <ContentPickerCard
            sessionId={session.id}
            baseUrl={session.base_url}
            discoveredUrls={discoveredUrls}
            existingPageUrls={new Set(pages.map(p => p.url))}
            onPagesAdded={fetchData}
          />
        )}

        {/* ── Technology Detection ── */}
        {!isIntegrationPaused('builtwith') && (
        <SectionCard title="BuiltWith — Technology Stack" icon={<Code className="h-5 w-5 text-foreground" />} loading={builtwithLoading && !session?.builtwith_data} loadingText="Detecting technology stack..." error={builtwithFailed} errorText={integrationErrors.builtwith}>
          {session?.builtwith_data ? (
            <BuiltWithCard grouped={session.builtwith_data.grouped} totalCount={session.builtwith_data.totalCount} isLoading={false} credits={builtwithCredits} />
          ) : !builtwithLoading && !builtwithFailed ? (
            <p className="text-sm text-muted-foreground">Technology detection will run automatically.</p>
          ) : null}
        </SectionCard>
        )}

        {!isIntegrationPaused('wappalyzer') && (
        <SectionCard title="Wappalyzer — Technology Profiling" icon={<Layers className="h-5 w-5 text-foreground" />} loading={wappalyzerLoading && !session?.wappalyzer_data} loadingText="Running Wappalyzer detection..." error={wappalyzerFailed} errorText={integrationErrors.wappalyzer}>
          {session?.wappalyzer_data ? (
            <WappalyzerCard data={session.wappalyzer_data} isLoading={false} />
          ) : null}
        </SectionCard>
        )}

        {/* ── Performance ── */}
        {!isIntegrationPaused('gtmetrix') && (
        <SectionCard title="GTmetrix — Performance Audit" icon={<Zap className="h-5 w-5 text-foreground" />} loading={runningGtmetrix} loadingText="Running GTmetrix performance test..." error={gtmetrixFailed} errorText={integrationErrors.gtmetrix}>
          <GtmetrixCard grade={session?.gtmetrix_grade || null} scores={session?.gtmetrix_scores || null} testId={session?.gtmetrix_test_id || null} isRunning={false} />
        </SectionCard>
        )}

        {!isIntegrationPaused('psi') && (
        <SectionCard title="PageSpeed Insights — Lighthouse" icon={<Gauge className="h-5 w-5 text-foreground" />} loading={psiLoading && !session?.psi_data} loadingText="Running PageSpeed Insights (mobile + desktop)..." error={psiFailed} errorText={integrationErrors.psi}>
          {session?.psi_data ? <PageSpeedCard data={session.psi_data} isLoading={false} /> : null}
        </SectionCard>
        )}

        {!isIntegrationPaused('crux') && (
        <SectionCard title="CrUX — Real-User Field Data" icon={<Users className="h-5 w-5 text-foreground" />} loading={cruxLoading && !session?.crux_data} loadingText="Fetching Chrome UX Report field data..." error={cruxFailed} errorText={integrationErrors.crux}>
          {session?.crux_data ? (
            <CruxCard data={session.crux_data} isLoading={false} />
          ) : cruxNoData ? (
            <CruxCard data={null} isLoading={false} noData />
          ) : null}
        </SectionCard>
        )}

        {/* ── Lighthouse Accessibility ── */}
        {!isIntegrationPaused('psi-accessibility') && !isIntegrationPaused('psi') && (
        <SectionCard title="Lighthouse — Accessibility Audit" icon={<Accessibility className="h-5 w-5 text-foreground" />} loading={psiLoading && !session?.psi_data} loadingText="Extracting accessibility audits from Lighthouse...">
          {session?.psi_data ? (
            <LighthouseAccessibilityCard data={extractPsiAccessibility(session.psi_data)} isLoading={false} />
          ) : !psiLoading && psiFailed ? (
            <p className="text-sm text-muted-foreground">PageSpeed Insights failed — accessibility data unavailable.</p>
          ) : !psiLoading ? (
            <p className="text-sm text-muted-foreground">Waiting for PageSpeed Insights data…</p>
          ) : null}
        </SectionCard>
        )}

        {/* ── WAVE ── */}
        {!isIntegrationPaused('wave') && (
        <SectionCard title="WAVE — WCAG Accessibility Scan" icon={<Eye className="h-5 w-5 text-foreground" />} loading={waveLoading && !session?.wave_data} loadingText="Running WAVE accessibility scan..." error={waveFailed} errorText={integrationErrors.wave}>
          {session?.wave_data ? <WaveCard data={session.wave_data} isLoading={false} /> : null}
        </SectionCard>
        )}

        {/* ── Mozilla Observatory ── */}
        {!isIntegrationPaused('observatory') && (
        <SectionCard title="Mozilla Observatory — Security Headers" icon={<Shield className="h-5 w-5 text-foreground" />} loading={observatoryLoading && !session?.observatory_data} loadingText="Running Mozilla Observatory security scan..." error={observatoryFailed} errorText={integrationErrors.observatory}>
          {session?.observatory_data ? <ObservatoryCard data={session.observatory_data} isLoading={false} /> : null}
        </SectionCard>
        )}

        {/* ── SSL Labs ── */}
        {!isIntegrationPaused('ssllabs') && (
        <SectionCard title="SSL Labs — TLS/SSL Assessment" icon={<Lock className="h-5 w-5 text-foreground" />} loading={ssllabsLoading && !session?.ssllabs_data} loadingText="Running SSL Labs assessment (this may take 1-3 minutes)..." error={ssllabsFailed} errorText={integrationErrors.ssllabs}>
          {session?.ssllabs_data ? <SslLabsCard data={session.ssllabs_data} /> : null}
        </SectionCard>
        )}

        {/* ── httpstatus.io ── */}
        {!isIntegrationPaused('httpstatus') && (
        <SectionCard title="httpstatus.io — Redirects & HTTP Status" icon={<Link className="h-5 w-5 text-foreground" />} loading={httpstatusLoading && !session?.httpstatus_data} loadingText="Checking HTTP redirect chain..." error={httpstatusFailed} errorText={integrationErrors.httpstatus}>
          {session?.httpstatus_data ? <HttpStatusCard data={session.httpstatus_data} /> : null}
        </SectionCard>
        )}

        {/* ── Broken Link Checker ── */}
        {!isIntegrationPaused('link-checker') && (
        <SectionCard title="Broken Link Checker" icon={<LinkIcon className="h-5 w-5 text-foreground" />} loading={linkcheckLoading && !session?.linkcheck_data} loadingText={`Checking ${discoveredUrls.length} URLs for broken links...`} error={linkcheckFailed} errorText={integrationErrors['link-checker']}>
          {session?.linkcheck_data ? <BrokenLinksCard data={session.linkcheck_data} /> : !linkcheckLoading && discoveredUrls.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for URL discovery to complete…</p>
          ) : null}
        </SectionCard>
        )}

        {/* ── W3C Validation ── */}
        {!isIntegrationPaused('w3c') && (
        <SectionCard title="W3C — HTML & CSS Validation" icon={<Code className="h-5 w-5 text-foreground" />} loading={w3cLoading && !session?.w3c_data} loadingText="Running W3C HTML & CSS validation..." error={w3cFailed} errorText={integrationErrors.w3c}>
          {session?.w3c_data ? <W3CCard data={session.w3c_data} /> : null}
        </SectionCard>
        )}

        {/* ── Schema.org / Rich Results ── */}
        {!isIntegrationPaused('schema') && (
        <SectionCard title="Schema.org — Structured Data & Rich Results" icon={<FileText className="h-5 w-5 text-foreground" />} loading={schemaLoading && !session?.schema_data} loadingText="Analyzing structured data markup..." error={schemaFailed} errorText={integrationErrors.schema}>
          {session?.schema_data ? <SchemaCard data={session.schema_data} /> : null}
        </SectionCard>
        )}

        {!isIntegrationPaused('carbon') && (
        <SectionCard title="Website Carbon — Sustainability" icon={<Leaf className="h-5 w-5 text-foreground" />} loading={carbonLoading && !session?.carbon_data} loadingText="Measuring carbon footprint..." error={carbonFailed} errorText={integrationErrors.carbon}>
          {session?.carbon_data ? <WebsiteCarbonCard data={session.carbon_data} isLoading={false} /> : null}
        </SectionCard>
        )}

        {/* ── Firmographics ── */}
        {!isIntegrationPaused('ocean') && (
        <SectionCard title="Ocean.io — Firmographics" icon={<Building2 className="h-5 w-5 text-foreground" />} loading={oceanLoading && !session?.ocean_data} loadingText="Enriching company firmographics via Ocean.io..." error={oceanFailed} errorText={integrationErrors.ocean}>
          {session?.ocean_data ? <OceanCard data={session.ocean_data} /> : null}
        </SectionCard>
        )}

        {/* ── SEO ── */}
        {!isIntegrationPaused('semrush') && (
        <SectionCard title="SEMrush — Domain Analysis" icon={<Search className="h-5 w-5 text-foreground" />} loading={semrushLoading && !session?.semrush_data} loadingText="Pulling SEMrush data..." error={semrushFailed} errorText={integrationErrors.semrush}>
          {session?.semrush_data ? <SemrushCard data={session.semrush_data} isLoading={false} /> : null}
        </SectionCard>
        )}

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

        {/* ── Scrape Progress ── */}
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
