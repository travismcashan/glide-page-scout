import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { useSectionCollapse } from '@/hooks/use-section-collapse';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ArrowLeft, Brain, Building2, ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, Clock, Copy, Download, ExternalLink, FileText, Lightbulb, Loader2, Zap, Globe, Code, Gauge, Search, Layers, Leaf, Users, Accessibility, Eye, Shield, Lock, Link, LinkIcon, RefreshCw, Phone, UserPlus, Navigation, MapIcon } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { firecrawlApi, aiApi, gtmetrixApi, builtwithApi, semrushApi, pagespeedApi, wappalyzerApi, websiteCarbonApi, cruxApi, waveApi, observatoryApi, oceanApi, ssllabsApi, httpstatusApi, linkCheckerApi, w3cApi, schemaApi, readableApi, yellowlabApi, avomaApi, apolloApi, navExtractApi, contentTypesApi, autoTagPagesApi, sitemapApi } from '@/lib/api/firecrawl';
import { DeepResearchCard } from '@/components/DeepResearchCard';
import { ObservationsInsightsCard } from '@/components/ObservationsInsightsCard';
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
import { ReadableCard } from '@/components/ReadableCard';
import { YellowLabCard } from '@/components/YellowLabCard';
import { NavStructureCard, type NavStructureCardHandle } from '@/components/NavStructureCard';
import { ScreenshotGallery } from '@/components/ScreenshotGallery';
import { UrlDiscoveryCard } from '@/components/UrlDiscoveryCard';
// ScreenshotPickerCard removed — screenshots are fully self-contained in ScreenshotGallery
import { ContentSectionCard } from '@/components/ContentSectionCard';
import { isIntegrationPaused, loadPausedIntegrations } from '@/lib/integrationState';

/** Show a card if data already exists (historical) OR integration is active */
function shouldShowIntegration(key: string, hasData: boolean): boolean {
  return hasData || !isIntegrationPaused(key);
}
import { AvomaCard } from '@/components/AvomaCard';
import { ApolloCard } from '@/components/ApolloCard';
import { SectionCard } from '@/components/SectionCard';
import { ContentTypesCard } from '@/components/ContentTypesCard';
import { SitemapCard } from '@/components/SitemapCard';
import { RedesignEstimateCard } from '@/components/RedesignEstimateCard';
import { TemplatesCard } from '@/components/TemplatesCard';
import { exportAsJson, exportAsMarkdown, exportAsPdf } from '@/lib/exportResults';
import { downloadReportPdf } from '@/lib/downloadReportPdf';
import { autoSeedPageTags, setPageTemplate, setPageTag, getPageTag, type PageTagsMap, type PageTag, getPageTagsSummary } from '@/lib/pageTags';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  readable_data: any | null;
  yellowlab_data: any | null;
  avoma_data: any | null;
  apollo_data: any | null;
  nav_structure: any | null;
  discovered_urls: string[] | null;
  gtmetrix_grade: string | null;
  gtmetrix_scores: any | null;
  gtmetrix_test_id: string | null;
  deep_research_data: any | null;
  observations_data: any | null;
  content_types_data: any | null;
  page_tags: PageTagsMap | null;
  sitemap_data: any | null;
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
  const [sitemapHints, setSitemapHints] = useState<{ label: string; urls: string[] }[]>([]);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const { isSectionCollapsed, toggleSection } = useSectionCollapse(sessionId);
  const navRef = useRef<NavStructureCardHandle>(null);
  const [navInnerExpand, setNavInnerExpand] = useState<boolean | null>(null);
  const [sitemapInnerExpand, setSitemapInnerExpand] = useState<boolean | null>(null);
  const [contentTypesInnerExpand, setContentTypesInnerExpand] = useState<boolean | null>(null);
  const [redesignInnerExpand, setRedesignInnerExpand] = useState<boolean | null>(null);
  // Timing tracking per integration
  const integrationStartTimes = useRef<Record<string, number>>({});
  const [integrationDurations, setIntegrationDurations] = useState<Record<string, number>>({});
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

  useEffect(() => {
    loadPausedIntegrations().catch(() => undefined).finally(() => {
      fetchData();
    });
  }, [fetchData]);

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
    if (!session || session.crux_data || cruxLoading || cruxFailed || cruxNoData || isIntegrationPaused('crux')) return;
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
  }, [session, cruxLoading, cruxFailed, cruxNoData, fetchData]);

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

  // Avoma
  const [avomaLoading, setAvomaLoading] = useState(false);
  const [avomaFailed, setAvomaFailed] = useState(false);
  useEffect(() => {
    if (!session || (session as any).avoma_data || avomaLoading || avomaFailed || isIntegrationPaused('avoma')) return;
    setAvomaLoading(true);
    // Prefer Apollo contact email for Avoma search, fallback to domain
    const apolloEmail = session.apollo_data?.email;
    const searchDomain = apolloEmail
      ? apolloEmail.split('@').pop()?.toLowerCase() || session.domain
      : session.domain;
    avomaApi.lookup(searchDomain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ avoma_data: result } as any).eq('id', session.id);
        clearError('avoma');
        fetchData();
      } else { setAvomaFailed(true); setError('avoma', result.error || 'Avoma returned an error'); }
      setAvomaLoading(false);
    }).catch((e) => { setAvomaFailed(true); setError('avoma', e?.message || 'Avoma request failed'); setAvomaLoading(false); });
  }, [session, avomaLoading, avomaFailed, fetchData]);

  // Apollo.io contact enrichment (manual search, persisted)
  const [apolloData, setApolloData] = useState<any>(session?.apollo_data || null);
  const [apolloLoading, setApolloLoading] = useState(false);

  // Sync apolloData from session when session loads/changes
  useEffect(() => {
    if (session?.apollo_data && !apolloData) {
      setApolloData(session.apollo_data);
    }
  }, [session?.apollo_data]);

  const handleApolloSearch = async (email: string, firstName?: string, lastName?: string) => {
    setApolloLoading(true);
    try {
      const result = await apolloApi.enrich(email, firstName, lastName, session?.domain);
      setApolloData(result);
      if (result.success && session) {
        await supabase.from('crawl_sessions').update({ apollo_data: result } as any).eq('id', session.id);
      }
      if (!result.success) toast.error(result.error || 'Apollo enrichment failed');
    } catch (e: any) {
      toast.error(e?.message || 'Apollo request failed');
    }
    setApolloLoading(false);
  };


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

  // Readable.com
  const [readableLoading, setReadableLoading] = useState(false);
  const [readableFailed, setReadableFailed] = useState(false);
  useEffect(() => {
    if (!session || (session as any).readable_data || readableLoading || readableFailed || isIntegrationPaused('readable')) return;
    setReadableLoading(true);
    readableApi.score(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ readable_data: result } as any).eq('id', session.id);
        clearError('readable');
        fetchData();
      } else { setReadableFailed(true); setError('readable', result.error || 'Readable.com returned an error'); }
      setReadableLoading(false);
    }).catch((e) => { setReadableFailed(true); setError('readable', e?.message || 'Readable.com request failed'); setReadableLoading(false); });
  }, [session, readableLoading, readableFailed, fetchData]);

  // Yellow Lab Tools (client-side polling like SSL Labs)
  const [yellowlabLoading, setYellowlabLoading] = useState(false);
  const [yellowlabFailed, setYellowlabFailed] = useState(false);
  const yellowlabPollingRef = useRef(false);
  useEffect(() => {
    if (!session || (session as any).yellowlab_data || yellowlabLoading || yellowlabFailed || isIntegrationPaused('yellowlab') || yellowlabPollingRef.current) return;
    yellowlabPollingRef.current = true;
    setYellowlabLoading(true);

    (async () => {
      try {
        const startResult = await yellowlabApi.start(session.base_url);
        if (!startResult.success || !startResult.runId) {
          setYellowlabFailed(true);
          setError('yellowlab', startResult.error || 'Yellow Lab Tools start failed');
          setYellowlabLoading(false);
          return;
        }

        const runId = startResult.runId;
        // Poll every 8s, up to 3 minutes
        const maxPolls = 23;
        for (let i = 0; i < maxPolls; i++) {
          await new Promise(r => setTimeout(r, 8000));
          const pollResult = await yellowlabApi.poll(runId);
          if (!pollResult.success) {
            setYellowlabFailed(true);
            setError('yellowlab', pollResult.error || 'Yellow Lab Tools poll error');
            setYellowlabLoading(false);
            return;
          }
          if (pollResult.status === 'complete') {
            await supabase.from('crawl_sessions').update({ yellowlab_data: { globalScore: pollResult.globalScore, runId, categories: pollResult.categories } } as any).eq('id', session.id);
            clearError('yellowlab');
            fetchData();
            setYellowlabLoading(false);
            return;
          }
          if (pollResult.status === 'failed') {
            setYellowlabFailed(true);
            setError('yellowlab', (pollResult as any).error || 'Yellow Lab Tools could not analyze this page — the site may block automated testing');
            setYellowlabLoading(false);
            return;
          }
        }
        setYellowlabFailed(true);
        setError('yellowlab', 'Yellow Lab Tools timed out after 3 minutes');
        setYellowlabLoading(false);
      } catch (e: any) {
        setYellowlabFailed(true);
        setError('yellowlab', e?.message || 'Yellow Lab Tools request failed');
        setYellowlabLoading(false);
      }
    })();
  }, [session, yellowlabLoading, yellowlabFailed, fetchData]);

  // Broken Link Checker
  const [linkcheckLoading, setLinkcheckLoading] = useState(false);
  const [linkcheckFailed, setLinkcheckFailed] = useState(false);
  const [linkcheckProgress, setLinkcheckProgress] = useState<{ checked: number; total: number } | null>(null);
  const [linkcheckStreamingResults, setLinkcheckStreamingResults] = useState<{ url: string; statusCode: number }[] | null>(null);
  const linkcheckRunningRef = useRef(false);
  const lastLinkcheckKeyRef = useRef<string | null>(null);
  const linkcheckAbortRef = useRef<AbortController | null>(null);
  const effectiveDiscoveredUrls = discoveredUrls.length > 0 ? discoveredUrls : (session?.discovered_urls || []);
  const effectiveLinkcheckKey = session ? `${session.id}:${effectiveDiscoveredUrls.join('|')}` : null;

  const stopLinkcheck = useCallback(async () => {
    linkcheckAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!session || session.linkcheck_data || linkcheckLoading || linkcheckFailed || isIntegrationPaused('link-checker') || effectiveDiscoveredUrls.length === 0) return;
    if (!effectiveLinkcheckKey) return;
    if (linkcheckRunningRef.current || lastLinkcheckKeyRef.current === effectiveLinkcheckKey) return;
    linkcheckRunningRef.current = true;
    lastLinkcheckKeyRef.current = effectiveLinkcheckKey;
    const abortController = new AbortController();
    linkcheckAbortRef.current = abortController;
    setLinkcheckLoading(true);
    setLinkcheckStreamingResults(null);
    setLinkcheckProgress({ checked: 0, total: effectiveDiscoveredUrls.length });
    linkCheckerApi.check(
      effectiveDiscoveredUrls,
      (checked, total) => { setLinkcheckProgress({ checked, total }); },
      (partialResults) => { setLinkcheckStreamingResults(partialResults); },
      abortController.signal,
    ).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ linkcheck_data: result } as any).eq('id', session.id);
        clearError('link-checker');
        setLinkcheckStreamingResults(null);
        await fetchData();
      } else { setLinkcheckFailed(true); setError('link-checker', result.error || 'Link checker returned an error'); lastLinkcheckKeyRef.current = null; }
      setLinkcheckLoading(false);
      setLinkcheckProgress(null);
      linkcheckRunningRef.current = false;
      linkcheckAbortRef.current = null;
    }).catch((e) => { setLinkcheckFailed(true); setError('link-checker', e?.message || 'Link checker request failed'); setLinkcheckLoading(false); setLinkcheckProgress(null); linkcheckRunningRef.current = false; lastLinkcheckKeyRef.current = null; linkcheckAbortRef.current = null; });
  }, [session, linkcheckLoading, linkcheckFailed, effectiveDiscoveredUrls, effectiveLinkcheckKey, fetchData]);

  // Nav Structure extraction
  const [navLoading, setNavLoading] = useState(false);
  const [navFailed, setNavFailed] = useState(false);
  useEffect(() => {
    if (!session || (session as any).nav_structure || navLoading || navFailed || isIntegrationPaused('nav-structure')) return;
    setNavLoading(true);
    navExtractApi.extract(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ nav_structure: result } as any).eq('id', session.id);
        clearError('nav-structure');
        fetchData();
      } else { setNavFailed(true); setError('nav-structure', result.error || 'Nav structure extraction failed'); }
      setNavLoading(false);
    }).catch((e) => { setNavFailed(true); setError('nav-structure', e?.message || 'Nav structure request failed'); setNavLoading(false); });
  }, [session, navLoading, navFailed, fetchData]);

  // XML Sitemap parsing (runs early — feeds URLs into URL discovery)
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [sitemapFailed, setSitemapFailed] = useState(false);
  useEffect(() => {
    if (!session || session.sitemap_data || sitemapLoading || sitemapFailed || isIntegrationPaused('sitemap')) return;
    setSitemapLoading(true);
    sitemapApi.parse(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ sitemap_data: result } as any).eq('id', session.id);
        clearError('sitemap');
        // Feed sitemap hints upstream
        if (result.contentTypeHints?.length) {
          setSitemapHints(result.contentTypeHints);
        }
        fetchData();
      } else { setSitemapFailed(true); setError('sitemap', result.error || 'Sitemap parsing failed'); }
      setSitemapLoading(false);
    }).catch((e) => { setSitemapFailed(true); setError('sitemap', e?.message || 'Sitemap parsing request failed'); setSitemapLoading(false); });
  }, [session, sitemapLoading, sitemapFailed, fetchData]);

  // Hydrate sitemapHints from persisted sitemap_data on load
  useEffect(() => {
    if (session?.sitemap_data?.contentTypeHints?.length && sitemapHints.length === 0) {
      setSitemapHints(session.sitemap_data.contentTypeHints);
    }
  }, [session?.sitemap_data]);

  // Content Types classification (auto-run after URL discovery) — phased with progress
  const [contentTypesLoading, setContentTypesLoading] = useState(false);
  const [contentTypesFailed, setContentTypesFailed] = useState(false);
  const [contentTypesProgress, setContentTypesProgress] = useState('');
  useEffect(() => {
    if (!session || (session as any).content_types_data || contentTypesLoading || contentTypesFailed || isIntegrationPaused('content-types')) return;
    if (!effectiveDiscoveredUrls.length) return;
    setContentTypesLoading(true);
    setContentTypesProgress('Starting classification…');
    contentTypesApi.classifyPhased(
      effectiveDiscoveredUrls,
      session.base_url,
      sitemapHints.length > 0 ? sitemapHints : undefined,
      (_phase, detail) => setContentTypesProgress(detail),
    ).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ content_types_data: result } as any).eq('id', session.id);
        clearError('content-types');
        fetchData();
      } else { setContentTypesFailed(true); setError('content-types', result.error || 'Content type classification failed'); }
      setContentTypesLoading(false);
      setContentTypesProgress('');
    }).catch((e) => { setContentTypesFailed(true); setError('content-types', e?.message || 'Content type classification request failed'); setContentTypesLoading(false); setContentTypesProgress(''); });
  }, [session, contentTypesLoading, contentTypesFailed, effectiveDiscoveredUrls, fetchData]);

  // Auto-seed page tags using AI industry detection, with URL-pattern fallback
  const [autoTagging, setAutoTagging] = useState(false);
  useEffect(() => {
    if (!session || !effectiveDiscoveredUrls.length || autoTagging) return;
    // Only auto-seed if page_tags is empty/null
    if ((session as any).page_tags && Object.keys((session as any).page_tags).length > 0) return;

    const runAutoTag = async () => {
      setAutoTagging(true);
      try {
        // Gather homepage content from scraped pages if available
        const homePage = pages.find(p => {
          try { return new URL(p.url).pathname === '/'; } catch { return false; }
        });
        const homepageContent = homePage?.raw_content?.substring(0, 4000) || '';
        const navData = (session as any).nav_structure;

        const result = await autoTagPagesApi.classify(
          effectiveDiscoveredUrls,
          session.domain,
          homepageContent,
          navData,
        );

        if (result.success && result.pages?.length) {
          // Build PageTagsMap from AI results (now with baseType)
          const tagMap: PageTagsMap = {};
          for (const page of result.pages) {
            const key = page.url.toLowerCase().replace(/\/$/, '');
            tagMap[key] = {
              template: page.template,
              baseType: (page.baseType as any) || undefined,
              cptName: page.cptName || undefined,
            };
          }
          // Fill any remaining URLs with pattern-based fallback
          const ctData = (session as any).content_types_data;
          const classified = ctData?.classified || [];
          const merged = autoSeedPageTags(tagMap, effectiveDiscoveredUrls, classified, session.base_url);

          await supabase.from('crawl_sessions').update({ page_tags: merged } as any).eq('id', session.id);
          if (result.industry) {
            console.log(`[auto-tag] Industry: ${result.industry} (${result.industryConfidence})`);
          }
          fetchData();
        } else {
          // Fallback to pure pattern matching
          const ctData = (session as any).content_types_data;
          const classified = ctData?.classified || [];
          const seeded = autoSeedPageTags(null, effectiveDiscoveredUrls, classified, session.base_url);
          if (Object.keys(seeded).length > 0) {
            await supabase.from('crawl_sessions').update({ page_tags: seeded } as any).eq('id', session.id);
            fetchData();
          }
        }
      } catch (e) {
        console.error('[auto-tag] AI tagging failed, using pattern fallback:', e);
        const ctData = (session as any).content_types_data;
        const classified = ctData?.classified || [];
        const seeded = autoSeedPageTags(null, effectiveDiscoveredUrls, classified, session.base_url);
        if (Object.keys(seeded).length > 0) {
          await supabase.from('crawl_sessions').update({ page_tags: seeded } as any).eq('id', session.id);
          fetchData();
        }
      } finally {
        setAutoTagging(false);
      }
    };

    runAutoTag();
  }, [session?.id, effectiveDiscoveredUrls.length]);

  const handlePageTagChange = useCallback(async (url: string, template: string) => {
    if (!session) return;
    const updated = setPageTemplate((session as any).page_tags, url, template);
    await supabase.from('crawl_sessions').update({ page_tags: updated } as any).eq('id', session.id);
    fetchData();
  }, [session, fetchData]);

  useEffect(() => {
    const pending = pages.filter(p => p.status === 'pending' && !processingPages.has(p.id));
    if (pending.length === 0) return;
    const processPage = async (page: CrawlPage) => {
      setProcessingPages(prev => new Set([...prev, page.id]));
      try {
        // Content scraping only — screenshots are a completely separate integration
        const scrapeResult = await firecrawlApi.scrape(page.url, { formats: ['markdown'] });

        const markdown = scrapeResult?.data?.markdown || (scrapeResult as any)?.markdown || '';
        const title = scrapeResult?.data?.metadata?.title || (scrapeResult as any)?.metadata?.title || page.url;

        await supabase.from('crawl_pages').update({
          raw_content: markdown || null,
          title,
          status: markdown ? 'scraped' : 'error',
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

  // ── Re-run helpers ──
  const rerunIntegration = useCallback(async (key: string, dbColumn: string) => {
    if (!session) return;
    // Clear stored data
    await supabase.from('crawl_sessions').update({ [dbColumn]: null } as any).eq('id', session.id);
    // Clear local error & failed state
    clearError(key);
    // Reset failed flags & polling refs so useEffect re-triggers
    const resetMap: Record<string, () => void> = {
      builtwith: () => { setBuiltwithFailed(false); setBuiltwithLoading(false); },
      semrush: () => { setSemrushFailed(false); setSemrushLoading(false); },
      psi: () => { setPsiFailed(false); setPsiLoading(false); },
      wappalyzer: () => { setWappalyzerFailed(false); setWappalyzerLoading(false); },
      gtmetrix: () => { setGtmetrixFailed(false); setRunningGtmetrix(false); },
      carbon: () => { setCarbonFailed(false); setCarbonLoading(false); },
      crux: () => { setCruxFailed(false); setCruxNoData(false); setCruxLoading(false); },
      wave: () => { setWaveFailed(false); setWaveLoading(false); },
      observatory: () => { setObservatoryFailed(false); setObservatoryLoading(false); },
      ocean: () => { setOceanFailed(false); setOceanLoading(false); },
      ssllabs: () => { setSsllabsFailed(false); setSsllabsLoading(false); ssllabsPollingRef.current = false; },
      httpstatus: () => { setHttpstatusFailed(false); setHttpstatusLoading(false); },
      w3c: () => { setW3cFailed(false); setW3cLoading(false); },
      schema: () => { setSchemaFailed(false); setSchemaLoading(false); },
      readable: () => { setReadableFailed(false); setReadableLoading(false); },
      yellowlab: () => { setYellowlabFailed(false); setYellowlabLoading(false); yellowlabPollingRef.current = false; },
      'link-checker': () => { setLinkcheckFailed(false); setLinkcheckLoading(false); lastLinkcheckKeyRef.current = null; },
      'nav-structure': () => { setNavFailed(false); setNavLoading(false); },
      'content-types': () => { setContentTypesFailed(false); setContentTypesLoading(false); },
      'sitemap': () => { setSitemapFailed(false); setSitemapLoading(false); },
    };
    resetMap[key]?.();
    // Refresh session so useEffect picks up null data
    fetchData();
  }, [session, fetchData]);

  const integrationList: { key: string; dbColumn: string }[] = [
    { key: 'sitemap', dbColumn: 'sitemap_data' },
    { key: 'builtwith', dbColumn: 'builtwith_data' },
    { key: 'wappalyzer', dbColumn: 'wappalyzer_data' },
    { key: 'gtmetrix', dbColumn: 'gtmetrix_grade' },
    { key: 'psi', dbColumn: 'psi_data' },
    { key: 'crux', dbColumn: 'crux_data' },
    { key: 'wave', dbColumn: 'wave_data' },
    { key: 'observatory', dbColumn: 'observatory_data' },
    { key: 'ssllabs', dbColumn: 'ssllabs_data' },
    { key: 'httpstatus', dbColumn: 'httpstatus_data' },
    { key: 'link-checker', dbColumn: 'linkcheck_data' },
    { key: 'readable', dbColumn: 'readable_data' },
    { key: 'yellowlab', dbColumn: 'yellowlab_data' },
    { key: 'w3c', dbColumn: 'w3c_data' },
    { key: 'schema', dbColumn: 'schema_data' },
    { key: 'carbon', dbColumn: 'carbon_data' },
    { key: 'ocean', dbColumn: 'ocean_data' },
    { key: 'semrush', dbColumn: 'semrush_data' },
    { key: 'nav-structure', dbColumn: 'nav_structure' },
    { key: 'content-types', dbColumn: 'content_types_data' },
  ];

  const [rerunningAll, setRerunningAll] = useState(false);
  const rerunAll = useCallback(async () => {
    if (!session) return;
    setRerunningAll(true);
    // Clear all integration data in one update
    const clearPayload: Record<string, null> = {};
    for (const { dbColumn } of integrationList) {
      clearPayload[dbColumn] = null;
    }
    // Also clear gtmetrix related fields
    clearPayload['gtmetrix_scores'] = null;
    clearPayload['gtmetrix_test_id'] = null;
    await supabase.from('crawl_sessions').update(clearPayload as any).eq('id', session.id);
    // Reset all states
    for (const { key } of integrationList) {
      clearError(key);
    }
    setBuiltwithFailed(false); setBuiltwithLoading(false);
    setSemrushFailed(false); setSemrushLoading(false);
    setPsiFailed(false); setPsiLoading(false);
    setWappalyzerFailed(false); setWappalyzerLoading(false);
    setGtmetrixFailed(false); setRunningGtmetrix(false);
    setCarbonFailed(false); setCarbonLoading(false);
    setCruxFailed(false); setCruxNoData(false); setCruxLoading(false);
    setWaveFailed(false); setWaveLoading(false);
    setObservatoryFailed(false); setObservatoryLoading(false);
    setOceanFailed(false); setOceanLoading(false);
    setSsllabsFailed(false); setSsllabsLoading(false); ssllabsPollingRef.current = false;
    setHttpstatusFailed(false); setHttpstatusLoading(false);
    setW3cFailed(false); setW3cLoading(false);
    setSchemaFailed(false); setSchemaLoading(false);
    setReadableFailed(false); setReadableLoading(false);
    setYellowlabFailed(false); setYellowlabLoading(false); yellowlabPollingRef.current = false;
    setLinkcheckFailed(false); setLinkcheckLoading(false); lastLinkcheckKeyRef.current = null;
    setAvomaFailed(false); setAvomaLoading(false);
    setNavFailed(false); setNavLoading(false);
    setSitemapFailed(false); setSitemapLoading(false);
    await fetchData();
    setRerunningAll(false);
    toast.success('Re-running all integrations');
  }, [session, fetchData]);

  // GTmetrix rerun needs to also clear scores/testId
  const rerunGtmetrix = useCallback(async () => {
    if (!session) return;
    await supabase.from('crawl_sessions').update({ gtmetrix_grade: null, gtmetrix_scores: null, gtmetrix_test_id: null } as any).eq('id', session.id);
    clearError('gtmetrix');
    setGtmetrixFailed(false);
    setRunningGtmetrix(false);
    fetchData();
  }, [session, fetchData]);

  // Track loading → done transitions for timing
  const prevLoadingRef = useRef<Record<string, boolean>>({});
  const loadingMap: Record<string, boolean> = {
    builtwith: builtwithLoading, semrush: semrushLoading, psi: psiLoading,
    wappalyzer: wappalyzerLoading, carbon: carbonLoading, crux: cruxLoading,
    wave: waveLoading, observatory: observatoryLoading, ocean: oceanLoading,
    ssllabs: ssllabsLoading, httpstatus: httpstatusLoading, w3c: w3cLoading,
    schema: schemaLoading, readable: readableLoading, yellowlab: yellowlabLoading,
    'link-checker': linkcheckLoading, 'nav-structure': navLoading,
    sitemap: sitemapLoading, 'content-types': contentTypesLoading,
    gtmetrix: runningGtmetrix, avoma: avomaLoading,
  };

  useEffect(() => {
    const prev = prevLoadingRef.current;
    for (const [key, isLoading] of Object.entries(loadingMap)) {
      if (prev[key] === undefined && isLoading) {
        // First load — started
        integrationStartTimes.current[key] = Date.now();
      } else if (prev[key] && !isLoading) {
        // Was loading, now done
        const start = integrationStartTimes.current[key];
        if (start) {
          setIntegrationDurations(d => ({ ...d, [key]: Math.round((Date.now() - start) / 1000) }));
          delete integrationStartTimes.current[key];
        }
      } else if (!prev[key] && isLoading) {
        // Just started loading
        integrationStartTimes.current[key] = Date.now();
      }
    }
    prevLoadingRef.current = { ...loadingMap };
  });

  const rerunButton = (key: string, dbColumn: string, isLoading: boolean) => (
    <>
      {integrationDurations[key] != null && !isLoading && (
        <span className="text-[10px] text-muted-foreground tabular-nums">{integrationDurations[key]}s</span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={isLoading}
        onClick={() => {
          setIntegrationDurations(d => { const next = { ...d }; delete next[key]; return next; });
          key === 'gtmetrix' ? rerunGtmetrix() : rerunIntegration(key, dbColumn);
        }}
        title="Run again"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>
    </>
  );

  const innerExpandToggle = (expanded: boolean | null, setExpanded: React.Dispatch<React.SetStateAction<boolean | null>>) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={() => setExpanded(v => v === true ? false : true)}
      title={expanded === true ? 'Collapse inner sections' : 'Expand inner sections'}
    >
      {expanded === true ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
    </Button>
  );

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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{session?.base_url}</span>
                {session?.created_at && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(session.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAllCollapsed(!allCollapsed)}
              className="no-print"
              title={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
            >
              {allCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5 mr-1.5" /> : <ChevronsDownUp className="h-3.5 w-3.5 mr-1.5" />}
              {allCollapsed ? 'Expand All' : 'Collapse All'}
            </Button>
            <Button variant="outline" size="sm" onClick={rerunAll} disabled={rerunningAll} className="no-print">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${rerunningAll ? 'animate-spin' : ''}`} />
              Re-run All
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="no-print">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {session?.deep_research_data?.report && (
                  <DropdownMenuItem onClick={() => downloadReportPdf(session.deep_research_data.report, 'Deep Research Report', session.domain)}>
                    <Brain className="h-3.5 w-3.5 mr-1.5" />
                    Deep Research PDF
                  </DropdownMenuItem>
                )}
                {session?.observations_data && (
                  <DropdownMenuItem onClick={() => downloadReportPdf(session.observations_data, 'Observations & Insights', session.domain)}>
                    <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
                    Observations & Insights PDF
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => exportAsPdf()}>
                  Export as PDF (Print)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => session && exportAsJson(session, pages)}>
                  Export as JSON (for AI)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => session && exportAsMarkdown(session, pages)}>
                  Export as Markdown (for AI)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {session?.status === 'analyzing' ? (
              <Badge variant="secondary">Analyzing</Badge>
            ) : session?.status === 'completed' ? (
              <Badge variant="default">Complete</Badge>
            ) : pages.length > 0 ? (
              <Badge variant="secondary">{progress}% — {completedCount}/{pages.length} scraped</Badge>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Tabs defaultValue="raw-data" className="w-full">
          <TabsList className="w-full justify-start h-auto bg-transparent p-0 border-b border-border rounded-none pb-3 mb-6 gap-2">
            <TabsTrigger
              value="raw-data"
              className="text-sm font-medium px-5 py-2.5 rounded-md border border-transparent data-[state=active]:bg-muted data-[state=active]:border-border data-[state=active]:shadow-sm transition-all"
            >
             <Globe className="h-4 w-4 mr-2" />
              Results
            </TabsTrigger>
            <TabsTrigger
              value="ai-research"
              className="text-sm font-medium px-5 py-2.5 rounded-md border border-transparent data-[state=active]:bg-muted data-[state=active]:border-border data-[state=active]:shadow-sm transition-all"
            >
              <Brain className="h-4 w-4 mr-2" />
              AI Research
            </TabsTrigger>
            {shouldShowIntegration('avoma', !!(session as any)?.avoma_data) && (
              <TabsTrigger
                value="avoma"
                className="text-sm font-medium px-5 py-2.5 rounded-md border border-transparent data-[state=active]:bg-muted data-[state=active]:border-border data-[state=active]:shadow-sm transition-all"
              >
                <Phone className="h-4 w-4 mr-2" />
                Avoma Calls
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="raw-data" className="mt-0 space-y-8">

        {/* ══════ 🔗 URL Analysis ══════ */}
        {(
          (session && shouldShowIntegration('sitemap', !!session.sitemap_data)) ||
          (session && shouldShowIntegration('url-discovery', !!session.discovered_urls)) ||
          shouldShowIntegration('httpstatus', !!session?.httpstatus_data) ||
          shouldShowIntegration('link-checker', !!session?.linkcheck_data || effectiveDiscoveredUrls.length > 0)
        ) && (
          <div>
            <h2 className="text-4xl font-light tracking-tight text-foreground/80 mt-12 mb-6 first:mt-0">URL Analysis</h2>
            <div className="space-y-6">
              {session && shouldShowIntegration('sitemap', !!session.sitemap_data) && (
                <SectionCard collapsed={allCollapsed} sectionId="sitemap" persistedCollapsed={isSectionCollapsed("sitemap")} onCollapseChange={toggleSection} title="XML Sitemaps" icon={<MapIcon className="h-5 w-5 text-foreground" />} loading={sitemapLoading && !session.sitemap_data} loadingText="Parsing XML sitemaps..." error={sitemapFailed} errorText={integrationErrors.sitemap} headerExtra={<div className="flex items-center gap-1.5">{rerunButton('sitemap', 'sitemap_data', sitemapLoading)}{session.sitemap_data && innerExpandToggle(sitemapInnerExpand, setSitemapInnerExpand)}</div>}>
                  {session.sitemap_data ? <SitemapCard data={session.sitemap_data} globalInnerExpand={sitemapInnerExpand} pageTags={(session as any).page_tags} onPageTagChange={handlePageTagChange} /> : null}
                </SectionCard>
              )}

              {session && shouldShowIntegration('url-discovery', !!session.discovered_urls) && (
                <UrlDiscoveryCard
                  baseUrl={session.base_url}
                  onUrlsDiscovered={setDiscoveredUrls}
                  onSitemapHints={setSitemapHints}
                  sitemapUrls={session.sitemap_data?.urls || null}
                  linkCheckResults={session.linkcheck_data?.results || null}
                  linkCheckStreaming={linkcheckStreamingResults}
                  linkCheckLoading={linkcheckLoading}
                  linkCheckProgress={linkcheckProgress}
                  onStopLinkCheck={linkcheckLoading ? stopLinkcheck : undefined}
                  navStructure={(session as any).nav_structure || null}
                  collapsed={allCollapsed}
                  persistedUrls={session.discovered_urls}
                  pageTags={(session as any).page_tags}
                  onPageTagChange={handlePageTagChange}
                  onUrlsPersist={async (urls) => {
                    await supabase.from('crawl_sessions').update({ discovered_urls: urls, linkcheck_data: null } as any).eq('id', session.id);
                    setDiscoveredUrls(urls);
                    setLinkcheckFailed(false);
                    setLinkcheckLoading(false);
                    linkcheckRunningRef.current = false;
                    lastLinkcheckKeyRef.current = null;
                    setLinkcheckProgress(null);
                    console.log('Discovered URLs persisted, link check data cleared for re-run');
                    fetchData();
                  }}
                />
              )}

              {shouldShowIntegration('httpstatus', !!session?.httpstatus_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="httpstatus" persistedCollapsed={isSectionCollapsed("httpstatus")} onCollapseChange={toggleSection} title="httpstatus.io — Redirects & HTTP Status" icon={<Link className="h-5 w-5 text-foreground" />} loading={httpstatusLoading && !session?.httpstatus_data} loadingText="Checking HTTP redirect chain..." error={httpstatusFailed} errorText={integrationErrors.httpstatus} headerExtra={rerunButton('httpstatus', 'httpstatus_data', httpstatusLoading)}>
                {session?.httpstatus_data ? <HttpStatusCard data={session.httpstatus_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('link-checker', !!session?.linkcheck_data || effectiveDiscoveredUrls.length > 0) && (
              <SectionCard collapsed={allCollapsed} sectionId="link-checker" persistedCollapsed={isSectionCollapsed("link-checker")} onCollapseChange={toggleSection} title="Broken Link Checker" icon={<LinkIcon className="h-5 w-5 text-foreground" />} loading={linkcheckLoading && !session?.linkcheck_data} loadingText={linkcheckProgress ? `Checking URLs for broken links... ${linkcheckProgress.checked} of ${linkcheckProgress.total} checked` : `Checking ${effectiveDiscoveredUrls.length} URLs for broken links...`} error={linkcheckFailed} errorText={integrationErrors['link-checker']} headerExtra={rerunButton('link-checker', 'linkcheck_data', linkcheckLoading)}>
                {session?.linkcheck_data ? <BrokenLinksCard data={session.linkcheck_data} /> : !linkcheckLoading && effectiveDiscoveredUrls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Waiting for URL discovery to complete…</p>
                ) : null}
              </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* ══════ 📊 Content Analysis ══════ */}
        {(
          shouldShowIntegration('nav-structure', !!(session as any)?.nav_structure) ||
          (session && (session as any)?.page_tags) ||
          shouldShowIntegration('content-types', !!(session as any)?.content_types_data) ||
          shouldShowIntegration('content', pages.length > 0) ||
          shouldShowIntegration('readable', !!(session as any)?.readable_data)
        ) && (
          <div>
            <h2 className="text-4xl font-light tracking-tight text-foreground/80 mt-12 mb-6 first:mt-0">Content Analysis</h2>
            <div className="space-y-6">
              {shouldShowIntegration('nav-structure', !!(session as any)?.nav_structure) && (
              <SectionCard collapsed={allCollapsed} sectionId="nav-structure" persistedCollapsed={isSectionCollapsed("nav-structure")} onCollapseChange={toggleSection} title="Site Navigation" icon={<Navigation className="h-5 w-5 text-foreground" />} loading={navLoading && !(session as any)?.nav_structure} loadingText="Extracting navigation structure from header..." error={navFailed} errorText={integrationErrors['nav-structure']} headerExtra={<div className="flex items-center gap-1.5">{(session as any)?.nav_structure && <><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navRef.current?.copyMarkdown()} title="Copy as Markdown"><Copy className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navRef.current?.copyRichText()} title="Copy as Rich Text"><FileText className="h-3.5 w-3.5" /></Button></>}{rerunButton('nav-structure', 'nav_structure', navLoading)}{(session as any)?.nav_structure && innerExpandToggle(navInnerExpand, setNavInnerExpand)}</div>}>
                {(session as any)?.nav_structure ? <NavStructureCard ref={navRef} data={(session as any).nav_structure} pageTags={(session as any).page_tags} onPageTagChange={handlePageTagChange} globalInnerExpand={navInnerExpand} /> : null}
              </SectionCard>
              )}

              {session && (session as any)?.page_tags && (
              <SectionCard collapsed={allCollapsed} sectionId="content-audit" persistedCollapsed={isSectionCollapsed("content-audit")} onCollapseChange={toggleSection} title="Content Audit" icon={<Layers className="h-5 w-5 text-foreground" />} headerExtra={<div className="flex items-center gap-1.5">{innerExpandToggle(redesignInnerExpand, setRedesignInnerExpand)}</div>}>
                <RedesignEstimateCard pageTags={(session as any).page_tags} contentTypesData={(session as any).content_types_data} globalInnerExpand={redesignInnerExpand} />
              </SectionCard>
              )}

              {shouldShowIntegration('content-types', !!(session as any)?.content_types_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="content-types" persistedCollapsed={isSectionCollapsed("content-types")} onCollapseChange={toggleSection} title="Repeating Content (Posts & CPTs)" icon={<Layers className="h-5 w-5 text-foreground" />} loading={contentTypesLoading && !(session as any)?.content_types_data} loadingText={contentTypesProgress || "Classifying content types across discovered URLs..."} error={contentTypesFailed} errorText={integrationErrors['content-types']} headerExtra={<div className="flex items-center gap-1.5">{rerunButton('content-types', 'content_types_data', contentTypesLoading)}{(session as any)?.content_types_data && innerExpandToggle(contentTypesInnerExpand, setContentTypesInnerExpand)}</div>}>
                {(session as any)?.content_types_data ? <ContentTypesCard data={(session as any).content_types_data} navStructure={(session as any).nav_structure || null} pageTags={(session as any).page_tags} onPageTagChange={handlePageTagChange} globalInnerExpand={contentTypesInnerExpand} onDataChange={async (updated) => {
                  await supabase.from('crawl_sessions').update({ content_types_data: updated as any }).eq('id', sessionId!);
                  fetchData();
                }} /> : null}
              </SectionCard>
              )}

              {session && shouldShowIntegration('content', pages.length > 0) && (
                <ContentSectionCard
                  pages={pages}
                  sessionId={session.id}
                  baseUrl={session.base_url}
                  domain={session.domain}
                  discoveredUrls={discoveredUrls}
                  existingPageUrls={new Set(pages.map(p => p.url))}
                  onPagesAdded={fetchData}
                  expandedPages={expandedPages}
                  toggleExpand={toggleExpand}
                  generateOutline={generateOutline}
                  generatingOutline={generatingOutline}
                  collapsed={allCollapsed}
                />
              )}

              {shouldShowIntegration('readable', !!(session as any)?.readable_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="readable" persistedCollapsed={isSectionCollapsed("readable")} onCollapseChange={toggleSection} title="Readable.com — Readability Analysis" icon={<FileText className="h-5 w-5 text-foreground" />} loading={readableLoading && !(session as any)?.readable_data} loadingText="Scoring content readability..." error={readableFailed} errorText={integrationErrors.readable} headerExtra={rerunButton('readable', 'readable_data', readableLoading)}>
                {(session as any)?.readable_data ? <ReadableCard data={(session as any).readable_data} /> : null}
              </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* ══════ 🎨 Design Analysis ══════ */}
        {(
          (session && (session as any)?.page_tags) ||
          shouldShowIntegration('screenshots', false)
        ) && (
          <div>
            <h2 className="text-4xl font-light tracking-tight text-foreground/80 mt-12 mb-6 first:mt-0">Design Analysis</h2>
            <div className="space-y-6">
              {session && (session as any)?.page_tags && (
              <SectionCard collapsed={allCollapsed} sectionId="templates" persistedCollapsed={isSectionCollapsed("templates")} onCollapseChange={toggleSection} title="Unique Templates" icon={<Layers className="h-5 w-5 text-foreground" />}>
                <TemplatesCard pageTags={(session as any).page_tags} navStructure={(session as any).nav_structure} domain={(session as any).domain} />
              </SectionCard>
              )}

              {session && shouldShowIntegration('screenshots', false) && (
                <ScreenshotGallery
                  sessionId={session.id}
                  baseUrl={session.base_url}
                  discoveredUrls={discoveredUrls}
                  collapsed={allCollapsed}
                />
              )}
            </div>
          </div>
        )}

        {/* ══════ 🔧 Technology Detection ══════ */}
        {(shouldShowIntegration('builtwith', !!session?.builtwith_data) || shouldShowIntegration('wappalyzer', !!session?.wappalyzer_data)) && (
          <div>
            <h2 className="text-4xl font-light tracking-tight text-foreground/80 mt-12 mb-6 first:mt-0">Technology Detection</h2>
            <div className="space-y-6">
              {shouldShowIntegration('builtwith', !!session?.builtwith_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="builtwith" persistedCollapsed={isSectionCollapsed("builtwith")} onCollapseChange={toggleSection} title="BuiltWith — Technology Stack" icon={<Code className="h-5 w-5 text-foreground" />} loading={builtwithLoading && !session?.builtwith_data} loadingText="Detecting technology stack..." error={builtwithFailed} errorText={integrationErrors.builtwith} headerExtra={rerunButton('builtwith', 'builtwith_data', builtwithLoading)}>
                {session?.builtwith_data ? (
                  <BuiltWithCard grouped={session.builtwith_data.grouped} totalCount={session.builtwith_data.totalCount} isLoading={false} credits={builtwithCredits} />
                ) : !builtwithLoading && !builtwithFailed ? (
                  <p className="text-sm text-muted-foreground">Technology detection will run automatically.</p>
                ) : null}
              </SectionCard>
              )}

              {shouldShowIntegration('wappalyzer', !!session?.wappalyzer_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="wappalyzer" persistedCollapsed={isSectionCollapsed("wappalyzer")} onCollapseChange={toggleSection} title="Wappalyzer — Technology Profiling" icon={<Layers className="h-5 w-5 text-foreground" />} loading={wappalyzerLoading && !session?.wappalyzer_data} loadingText="Running Wappalyzer detection..." error={wappalyzerFailed} errorText={integrationErrors.wappalyzer} headerExtra={rerunButton('wappalyzer', 'wappalyzer_data', wappalyzerLoading)}>
                {session?.wappalyzer_data ? (
                  <WappalyzerCard data={session.wappalyzer_data} isLoading={false} />
                ) : null}
              </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* ══════ ⚡ Performance & Sustainability ══════ */}
        {(shouldShowIntegration('gtmetrix', !!session?.gtmetrix_grade) || shouldShowIntegration('psi', !!session?.psi_data) || shouldShowIntegration('crux', !!session?.crux_data) || shouldShowIntegration('yellowlab', !!(session as any)?.yellowlab_data) || shouldShowIntegration('carbon', !!session?.carbon_data)) && (
          <div>
            <h2 className="text-4xl font-light tracking-tight text-foreground/80 mt-12 mb-6 first:mt-0">Performance & Sustainability</h2>
            <div className="space-y-6">
              {shouldShowIntegration('gtmetrix', !!session?.gtmetrix_grade) && (
              <SectionCard collapsed={allCollapsed} sectionId="gtmetrix" persistedCollapsed={isSectionCollapsed("gtmetrix")} onCollapseChange={toggleSection} title="GTmetrix — Performance Audit" icon={<Zap className="h-5 w-5 text-foreground" />} loading={runningGtmetrix} loadingText="Running GTmetrix performance test..." error={gtmetrixFailed} errorText={integrationErrors.gtmetrix} headerExtra={rerunButton('gtmetrix', 'gtmetrix_grade', runningGtmetrix)}>
                <GtmetrixCard grade={session?.gtmetrix_grade || null} scores={session?.gtmetrix_scores || null} testId={session?.gtmetrix_test_id || null} isRunning={false} />
              </SectionCard>
              )}

              {shouldShowIntegration('psi', !!session?.psi_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="psi" persistedCollapsed={isSectionCollapsed("psi")} onCollapseChange={toggleSection} title="PageSpeed Insights — Lighthouse" icon={<Gauge className="h-5 w-5 text-foreground" />} loading={psiLoading && !session?.psi_data} loadingText="Running PageSpeed Insights (mobile + desktop)..." error={psiFailed} errorText={integrationErrors.psi} headerExtra={rerunButton('psi', 'psi_data', psiLoading)}>
                {session?.psi_data ? <PageSpeedCard data={session.psi_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('crux', !!session?.crux_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="crux" persistedCollapsed={isSectionCollapsed("crux")} onCollapseChange={toggleSection} title="CrUX — Real-User Field Data" icon={<Users className="h-5 w-5 text-foreground" />} loading={cruxLoading && !session?.crux_data} loadingText="Fetching Chrome UX Report field data..." error={cruxFailed} errorText={integrationErrors.crux} headerExtra={rerunButton('crux', 'crux_data', cruxLoading)}>
                {session?.crux_data ? (
                  <CruxCard data={session.crux_data} isLoading={false} />
                ) : null}
              </SectionCard>
              )}

              {shouldShowIntegration('yellowlab', !!(session as any)?.yellowlab_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="yellowlab" persistedCollapsed={isSectionCollapsed("yellowlab")} onCollapseChange={toggleSection} title="Yellow Lab Tools — Front-End Quality" icon={<Gauge className="h-5 w-5 text-foreground" />} loading={yellowlabLoading && !(session as any)?.yellowlab_data} loadingText="Running Yellow Lab Tools audit (this may take 1-2 minutes)..." error={yellowlabFailed} errorText={integrationErrors.yellowlab} headerExtra={rerunButton('yellowlab', 'yellowlab_data', yellowlabLoading)}>
                {(session as any)?.yellowlab_data ? <YellowLabCard data={(session as any).yellowlab_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('carbon', !!session?.carbon_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="carbon" persistedCollapsed={isSectionCollapsed("carbon")} onCollapseChange={toggleSection} title="Website Carbon — Sustainability" icon={<Leaf className="h-5 w-5 text-foreground" />} loading={carbonLoading && !session?.carbon_data} loadingText="Measuring carbon footprint..." error={carbonFailed} errorText={integrationErrors.carbon} headerExtra={rerunButton('carbon', 'carbon_data', carbonLoading)}>
                {session?.carbon_data ? <WebsiteCarbonCard data={session.carbon_data} isLoading={false} /> : null}
              </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* ══════ 🔍 SEO & Search ══════ */}
        {(shouldShowIntegration('semrush', !!session?.semrush_data) || shouldShowIntegration('schema', !!session?.schema_data)) && (
          <div>
            <h2 className="text-4xl font-light tracking-tight text-foreground/80 mt-12 mb-6 first:mt-0">SEO & Search</h2>
            <div className="space-y-6">
              {shouldShowIntegration('semrush', !!session?.semrush_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="semrush" persistedCollapsed={isSectionCollapsed("semrush")} onCollapseChange={toggleSection} title="SEMrush — Domain Analysis" icon={<Search className="h-5 w-5 text-foreground" />} loading={semrushLoading && !session?.semrush_data} loadingText="Pulling SEMrush data..." error={semrushFailed} errorText={integrationErrors.semrush} headerExtra={rerunButton('semrush', 'semrush_data', semrushLoading)}>
                {session?.semrush_data ? <SemrushCard data={session.semrush_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('schema', !!session?.schema_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="schema" persistedCollapsed={isSectionCollapsed("schema")} onCollapseChange={toggleSection} title="Schema.org — Structured Data & Rich Results" icon={<FileText className="h-5 w-5 text-foreground" />} loading={schemaLoading && !session?.schema_data} loadingText="Analyzing structured data markup..." error={schemaFailed} errorText={integrationErrors.schema} headerExtra={rerunButton('schema', 'schema_data', schemaLoading)}>
                {session?.schema_data ? <SchemaCard data={session.schema_data} /> : null}
              </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* ══════ 🎨 UX & Accessibility ══════ */}
        {(shouldShowIntegration('psi-accessibility', !!session?.psi_data) || shouldShowIntegration('wave', !!session?.wave_data) || shouldShowIntegration('w3c', !!session?.w3c_data)) && (
          <div>
            <h2 className="text-4xl font-light tracking-tight text-foreground/80 mt-12 mb-6 first:mt-0">UX & Accessibility</h2>
            <div className="space-y-6">
              {shouldShowIntegration('psi-accessibility', !!session?.psi_data) && shouldShowIntegration('psi', !!session?.psi_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="psi-accessibility" persistedCollapsed={isSectionCollapsed("psi-accessibility")} onCollapseChange={toggleSection} title="Lighthouse — Accessibility Audit" icon={<Accessibility className="h-5 w-5 text-foreground" />} loading={psiLoading && !session?.psi_data} loadingText="Extracting accessibility audits from Lighthouse...">
                {session?.psi_data ? (
                  <LighthouseAccessibilityCard data={extractPsiAccessibility(session.psi_data)} isLoading={false} />
                ) : !psiLoading && psiFailed ? (
                  <p className="text-sm text-muted-foreground">PageSpeed Insights failed — accessibility data unavailable.</p>
                ) : !psiLoading ? (
                  <p className="text-sm text-muted-foreground">Waiting for PageSpeed Insights data…</p>
                ) : null}
              </SectionCard>
              )}

              {shouldShowIntegration('wave', !!session?.wave_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="wave" persistedCollapsed={isSectionCollapsed("wave")} onCollapseChange={toggleSection} title="WAVE — WCAG Accessibility Scan" icon={<Eye className="h-5 w-5 text-foreground" />} loading={waveLoading && !session?.wave_data} loadingText="Running WAVE accessibility scan..." error={waveFailed} errorText={integrationErrors.wave} headerExtra={rerunButton('wave', 'wave_data', waveLoading)}>
                {session?.wave_data ? <WaveCard data={session.wave_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('w3c', !!session?.w3c_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="w3c" persistedCollapsed={isSectionCollapsed("w3c")} onCollapseChange={toggleSection} title="W3C — HTML & CSS Validation" icon={<Code className="h-5 w-5 text-foreground" />} loading={w3cLoading && !session?.w3c_data} loadingText="Running W3C HTML & CSS validation..." error={w3cFailed} errorText={integrationErrors.w3c} headerExtra={rerunButton('w3c', 'w3c_data', w3cLoading)}>
                {session?.w3c_data ? <W3CCard data={session.w3c_data} /> : null}
              </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* ══════ 🛡️ Security & Compliance ══════ */}
        {(shouldShowIntegration('observatory', !!session?.observatory_data) || shouldShowIntegration('ssllabs', !!session?.ssllabs_data)) && (
          <div>
            <h2 className="text-4xl font-light tracking-tight text-foreground/80 mt-12 mb-6 first:mt-0">Security & Compliance</h2>
            <div className="space-y-6">
              {shouldShowIntegration('observatory', !!session?.observatory_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="observatory" persistedCollapsed={isSectionCollapsed("observatory")} onCollapseChange={toggleSection} title="Mozilla Observatory — Security Headers" icon={<Shield className="h-5 w-5 text-foreground" />} loading={observatoryLoading && !session?.observatory_data} loadingText="Running Mozilla Observatory security scan..." error={observatoryFailed} errorText={integrationErrors.observatory} headerExtra={rerunButton('observatory', 'observatory_data', observatoryLoading)}>
                {session?.observatory_data ? <ObservatoryCard data={session.observatory_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('ssllabs', !!session?.ssllabs_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="ssllabs" persistedCollapsed={isSectionCollapsed("ssllabs")} onCollapseChange={toggleSection} title="SSL Labs — TLS/SSL Assessment" icon={<Lock className="h-5 w-5 text-foreground" />} loading={ssllabsLoading && !session?.ssllabs_data} loadingText="Running SSL Labs assessment (this may take 1-3 minutes)..." error={ssllabsFailed} errorText={integrationErrors.ssllabs} headerExtra={rerunButton('ssllabs', 'ssllabs_data', ssllabsLoading)}>
                {session?.ssllabs_data ? <SslLabsCard data={session.ssllabs_data} /> : null}
              </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* ══════ 🧲 Enrichment & Prospecting ══════ */}
        {(shouldShowIntegration('ocean', !!session?.ocean_data) || shouldShowIntegration('apollo', !!session?.apollo_data)) && (
          <div>
            <h2 className="text-4xl font-light tracking-tight text-foreground/80 mt-12 mb-6 first:mt-0">Enrichment & Prospecting</h2>
            <div className="space-y-6">
              {shouldShowIntegration('ocean', !!session?.ocean_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="ocean" persistedCollapsed={isSectionCollapsed("ocean")} onCollapseChange={toggleSection} title="Ocean.io — Firmographics" icon={<Building2 className="h-5 w-5 text-foreground" />} loading={oceanLoading && !session?.ocean_data} loadingText="Enriching company firmographics via Ocean.io..." error={oceanFailed} errorText={integrationErrors.ocean} headerExtra={rerunButton('ocean', 'ocean_data', oceanLoading)}>
                {session?.ocean_data ? <OceanCard data={session.ocean_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('apollo', !!session?.apollo_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="apollo" persistedCollapsed={isSectionCollapsed("apollo")} onCollapseChange={toggleSection} title="Apollo.io — Contact Enrichment" icon={<UserPlus className="h-5 w-5 text-foreground" />}>
                <ApolloCard data={apolloData} isLoading={apolloLoading} onSearch={handleApolloSearch} />
              </SectionCard>
              )}
            </div>
          </div>
        )}


          </TabsContent>

          <TabsContent value="ai-research" className="mt-0 space-y-6">
            {session && (
              <>
                <SectionCard
                  sectionId="deep-research" persistedCollapsed={isSectionCollapsed("deep-research")} onCollapseChange={toggleSection} title="Gemini Deep Research"
                  icon={<Brain className="h-5 w-5 text-foreground" />}
                  collapsed={allCollapsed}
                >
                  <DeepResearchCard session={session} pages={scrapedPages} collapsed={allCollapsed} />
                </SectionCard>

                <SectionCard
                  sectionId="observations" persistedCollapsed={isSectionCollapsed("observations")} onCollapseChange={toggleSection} title="Observations & Insights"
                  icon={<Lightbulb className="h-5 w-5 text-foreground" />}
                  collapsed={allCollapsed}
                >
                  <ObservationsInsightsCard session={session} pages={scrapedPages} />
                </SectionCard>
              </>
            )}
          </TabsContent>

          {shouldShowIntegration('avoma', !!(session as any)?.avoma_data) && (
            <TabsContent value="avoma" className="mt-0 space-y-6">
              <SectionCard
                sectionId="avoma" persistedCollapsed={isSectionCollapsed("avoma")} onCollapseChange={toggleSection} title="Avoma — Call Intelligence"
                icon={<Phone className="h-5 w-5 text-foreground" />}
                loading={avomaLoading && !(session as any)?.avoma_data}
                loadingText="Searching Avoma for meetings with @domain attendees..."
                error={avomaFailed}
                errorText={integrationErrors.avoma}
                headerExtra={rerunButton('avoma', 'avoma_data', avomaLoading)}
                collapsed={allCollapsed}
              >
                {(session as any)?.avoma_data ? <AvomaCard
                  data={(session as any).avoma_data}
                  apolloEmail={session.apollo_data?.email || null}
                  onSearchDomain={async (domain) => {
                    setAvomaLoading(true);
                    setAvomaFailed(false);
                    try {
                      const result = await avomaApi.lookup(domain);
                      if (result.success) {
                        await supabase.from('crawl_sessions').update({ avoma_data: result } as any).eq('id', session!.id);
                        clearError('avoma');
                        fetchData();
                      } else {
                        setError('avoma', result.error || 'No results');
                        await supabase.from('crawl_sessions').update({ avoma_data: { ...result, domain, totalMatches: 0, meetings: [] } } as any).eq('id', session!.id);
                        fetchData();
                      }
                    } catch (e: any) {
                      setError('avoma', e?.message || 'Search failed');
                    }
                    setAvomaLoading(false);
                  }}
                  onExcludedChange={async (excludedUuids) => {
                    const current = (session as any).avoma_data;
                    if (!current) return;
                    const updated = { ...current, excludedMeetings: excludedUuids };
                    await supabase.from('crawl_sessions').update({ avoma_data: updated } as any).eq('id', session!.id);
                    fetchData();
                  }}
                /> : null}
              </SectionCard>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
