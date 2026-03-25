import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { useSectionCollapse } from '@/hooks/use-section-collapse';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Menu, Brain, Building2, ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, Clock, Copy, Download, ExternalLink, FileText, Lightbulb, Loader2, Zap, Globe, Code, Gauge, Search, Layers, Leaf, Users, Accessibility, Eye, Shield, Lock, Link, LinkIcon, RefreshCw, Phone, UserPlus, Navigation, MapIcon, Share2, Settings, History, BookOpen } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { firecrawlApi, aiApi, gtmetrixApi, builtwithApi, semrushApi, pagespeedApi, wappalyzerApi, detectzestackApi, techAnalysisApi, websiteCarbonApi, cruxApi, waveApi, observatoryApi, oceanApi, ssllabsApi, httpstatusApi, linkCheckerApi, w3cApi, schemaApi, readableApi, yellowlabApi, avomaApi, apolloApi, navExtractApi, contentTypesApi, autoTagPagesApi, sitemapApi, formsDetectApi, hubspotApi } from '@/lib/api/firecrawl';
import { DeepResearchCard } from '@/components/DeepResearchCard';
import { ObservationsInsightsCard } from '@/components/ObservationsInsightsCard';
import { GtmetrixCard } from '@/components/GtmetrixCard';
import { BuiltWithCard } from '@/components/BuiltWithCard';
import { SemrushCard } from '@/components/SemrushCard';
import { PageSpeedCard } from '@/components/PageSpeedCard';
import { WappalyzerCard } from '@/components/WappalyzerCard';
import { DetectZeStackCard } from '@/components/DetectZeStackCard';
import { TechAnalysisCard } from '@/components/TechAnalysisCard';
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
import { isIntegrationPaused, loadPausedIntegrations, toggleIntegrationPause } from '@/lib/integrationState';

/** Show integration if it has data, is active, or user toggled "Show All" */
function shouldShowIntegration(key: string, hasData: boolean, showAll: boolean, sharedView?: boolean): boolean {
  if (sharedView) return hasData;
  if (showAll) return true;
  return hasData || !isIntegrationPaused(key);
}
import { AvomaCard } from '@/components/AvomaCard';
import { HubSpotCard } from '@/components/HubSpotCard';
import { ApolloCard } from '@/components/ApolloCard';
import { SectionCard } from '@/components/SectionCard';
import { SortedIntegrationList } from '@/components/SortedIntegrationList';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { ContentTypesCard } from '@/components/ContentTypesCard';
import { SitemapCard } from '@/components/SitemapCard';
import { RedesignEstimateCard } from '@/components/RedesignEstimateCard';
import { TemplatesCard } from '@/components/TemplatesCard';
import { FormsCard } from '@/components/FormsCard';
import { GlobalProgressBar } from '@/components/GlobalProgressBar';
import { KnowledgeChatCard } from '@/components/KnowledgeChatCard';
import { ChatModelSelector, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { exportAsJson, exportAsMarkdown, exportAsPdf, exportAsZip } from '@/lib/exportResults';
import { downloadReportPdf } from '@/lib/downloadReportPdf';
import { autoSeedPageTags, setPageTemplate, setPageTag, getPageTag, type PageTagsMap, type PageTag, getPageTagsSummary } from '@/lib/pageTags';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
  updated_at: string;
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
  forms_data: any | null;
  tech_analysis_data: any | null;
};


export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSharedView = searchParams.get('view') === 'shared';
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
  const [detectzestackLoading, setDetectzestackLoading] = useState(false);
  const [carbonLoading, setCarbonLoading] = useState(false);
  const [cruxLoading, setCruxLoading] = useState(false);
  const [waveLoading, setWaveLoading] = useState(false);
  const [observatoryLoading, setObservatoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [sitemapHints, setSitemapHints] = useState<{ label: string; urls: string[] }[]>([]);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [chatModel, setChatModel] = useState('google/gemini-3-flash-preview');
  const [chatReasoning, setChatReasoning] = useState<ReasoningEffort>('none');
  const [showAllIntegrations, setShowAllIntegrations] = useState(!isSharedView);
  const [activeTab, setActiveTab] = useState('raw-data');
  const [rerunConfirmOpen, setRerunConfirmOpen] = useState(false);
  const { isSectionCollapsed, toggleSection } = useSectionCollapse(sessionId);
  const navRef = useRef<NavStructureCardHandle>(null);
  const [navInnerExpand, setNavInnerExpand] = useState<boolean | null>(null);
  const [sitemapInnerExpand, setSitemapInnerExpand] = useState<boolean | null>(null);
  const [contentTypesInnerExpand, setContentTypesInnerExpand] = useState<boolean | null>(null);
  const [redesignInnerExpand, setRedesignInnerExpand] = useState<boolean | null>(null);
  // Timing tracking per integration
  const integrationStartTimes = useRef<Record<string, number>>({});
  const [integrationDurations, setIntegrationDurations] = useState<Record<string, number>>({});
  const [integrationTimestamps, setIntegrationTimestamps] = useState<Record<string, string>>({});
  // Error tracking per integration
  const [integrationErrors, setIntegrationErrors] = useState<Record<string, string>>({});
  const [pauseVersion, setPauseVersion] = useState(0);
  const setError = (key: string, msg: string) => setIntegrationErrors(prev => ({ ...prev, [key]: msg }));
  const clearError = (key: string) => setIntegrationErrors(prev => { const next = { ...prev }; delete next[key]; return next; });

  /** Persist a failure sentinel to the DB so revisits don't re-trigger the integration */
  const persistFailure = useCallback(async (dbColumn: string, errorMsg: string) => {
    if (!sessionId) return;
    await supabase.from('crawl_sessions').update({ [dbColumn]: { _error: true, message: errorMsg } } as any).eq('id', sessionId);
  }, [sessionId]);

  /** Check if persisted data is a failure sentinel */
  const isPersistedError = (data: any): boolean => data && typeof data === 'object' && data._error === true;

  /** Toggle an integration on from the results page — unpause it and bump version to trigger re-render & re-run */
  const handleTogglePause = useCallback(async (key: string) => {
    await toggleIntegrationPause(key);
    setPauseVersion(v => v + 1);
  }, []);
  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    const [sessionRes, pagesRes] = await Promise.all([
      supabase.from('crawl_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('crawl_pages').select('*').eq('session_id', sessionId),
    ]);
    if (sessionRes.data) {
      const sessionData = sessionRes.data as any;
      setSession(sessionData as unknown as CrawlSession);
      // Restore persisted integration durations & timestamps
      if (sessionData.integration_durations && typeof sessionData.integration_durations === 'object') {
        setIntegrationDurations(prev => ({ ...sessionData.integration_durations, ...prev }));
      }
      if (sessionData.integration_timestamps && typeof sessionData.integration_timestamps === 'object') {
        setIntegrationTimestamps(prev => ({ ...sessionData.integration_timestamps, ...prev }));
      }
      // Restore failed states from persisted error sentinels
      const errorColumns: [string, (v: boolean) => void, string][] = [
        ['builtwith_data', setBuiltwithFailed, 'builtwith'],
        ['semrush_data', setSemrushFailed, 'semrush'],
        ['psi_data', setPsiFailed, 'psi'],
        ['wappalyzer_data', setWappalyzerFailed, 'wappalyzer'],
        ['detectzestack_data', setDetectzestackFailed, 'detectzestack'],
        ['carbon_data', setCarbonFailed, 'carbon'],
        ['crux_data', setCruxFailed, 'crux'],
        ['wave_data', setWaveFailed, 'wave'],
        ['observatory_data', setObservatoryFailed, 'observatory'],
        ['ocean_data', setOceanFailed, 'ocean'],
        ['ssllabs_data', setSsllabsFailed, 'ssllabs'],
        ['httpstatus_data', setHttpstatusFailed, 'httpstatus'],
        ['w3c_data', setW3cFailed, 'w3c'],
        ['schema_data', setSchemaFailed, 'schema'],
        ['readable_data', setReadableFailed, 'readable'],
        ['yellowlab_data', setYellowlabFailed, 'yellowlab'],
        ['linkcheck_data', setLinkcheckFailed, 'linkcheck'],
        ['nav_structure', setNavFailed, 'nav-structure'],
        ['content_types_data', setContentTypesFailed, 'content-types'],
        ['avoma_data', setAvomaFailed, 'avoma'],
        ['hubspot_data', setHubspotFailed, 'hubspot'],
        ['tech_analysis_data', setTechAnalysisFailed, 'tech-analysis'],
      ];
      for (const [col, setFailed, key] of errorColumns) {
        const val = sessionData[col];
        if (val && typeof val === 'object' && val._error) {
          setFailed(true);
          setError(key, val.message || 'Previously failed');
        }
      }
    }
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

  // ── Integration trigger refs (prevent duplicate API calls during React re-renders) ──
  const builtwithTriggeredRef = useRef(false);
  const semrushTriggeredRef = useRef(false);
  const psiTriggeredRef = useRef(false);
  const wappalyzerTriggeredRef = useRef(false);
  const detectzestackTriggeredRef = useRef(false);
  const gtmetrixTriggeredRef = useRef(false);
  const carbonTriggeredRef = useRef(false);
  const cruxTriggeredRef = useRef(false);
  const waveTriggeredRef = useRef(false);
  const observatoryTriggeredRef = useRef(false);
  const httpstatusTriggeredRef = useRef(false);
  const w3cTriggeredRef = useRef(false);
  const schemaTriggeredRef = useRef(false);
  const readableTriggeredRef = useRef(false);
  const navTriggeredRef = useRef(false);
  const sitemapTriggeredRef = useRef(false);
  const contentTypesTriggeredRef = useRef(false);

  // BuiltWith
  const [builtwithFailed, setBuiltwithFailed] = useState(false);
  const [builtwithCredits, setBuiltwithCredits] = useState<{ available?: string | null; used?: string | null; remaining?: string | null } | null>(null);
  useEffect(() => {
    if (!session || session.builtwith_data || builtwithLoading || builtwithFailed || isIntegrationPaused('builtwith')) return;
    if (builtwithTriggeredRef.current) return;
    builtwithTriggeredRef.current = true;
    setBuiltwithLoading(true);
    builtwithApi.lookup(session.domain).then(async (result) => {
      if (result.credits) setBuiltwithCredits(result.credits);
      if (result.success && result.grouped) {
        await supabase.from('crawl_sessions').update({ builtwith_data: { grouped: result.grouped, totalCount: result.totalCount } } as any).eq('id', session.id);
        clearError('builtwith');
        fetchData();
      } else {
        setBuiltwithFailed(true);
        const msg = result.error || 'BuiltWith API returned an error';
        setError('builtwith', msg);
        persistFailure('builtwith_data', msg);
      }
      setBuiltwithLoading(false);
    }).catch((e) => { const msg = e?.message || 'BuiltWith request failed'; setBuiltwithFailed(true); setError('builtwith', msg); persistFailure('builtwith_data', msg); setBuiltwithLoading(false); });
  }, [session, builtwithLoading, builtwithFailed, fetchData, pauseVersion]);
  // SEMrush
  const [semrushFailed, setSemrushFailed] = useState(false);
  useEffect(() => {
    if (!session || session.semrush_data || semrushLoading || semrushFailed || isIntegrationPaused('semrush')) return;
    if (semrushTriggeredRef.current) return;
    semrushTriggeredRef.current = true;
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
  }, [session, semrushLoading, semrushFailed, fetchData, pauseVersion]);
  // PSI
  const [psiFailed, setPsiFailed] = useState(false);
  useEffect(() => {
    if (!session || session.psi_data || psiLoading || psiFailed || isIntegrationPaused('psi')) return;
    if (psiTriggeredRef.current) return;
    psiTriggeredRef.current = true;
    setPsiLoading(true);
    pagespeedApi.analyze(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ psi_data: { mobile: result.mobile, desktop: result.desktop } } as any).eq('id', session.id);
        clearError('psi');
        fetchData();
      } else { setPsiFailed(true); setError('psi', result.error || 'PageSpeed Insights returned an error'); }
      setPsiLoading(false);
    }).catch((e) => { setPsiFailed(true); setError('psi', e?.message || 'PageSpeed request failed'); setPsiLoading(false); });
  }, [session, psiLoading, psiFailed, fetchData, pauseVersion]);
  // Wappalyzer
  const [wappalyzerFailed, setWappalyzerFailed] = useState(false);
  useEffect(() => {
    if (!session || session.wappalyzer_data || wappalyzerLoading || wappalyzerFailed || isIntegrationPaused('wappalyzer')) return;
    if (wappalyzerTriggeredRef.current) return;
    wappalyzerTriggeredRef.current = true;
    setWappalyzerLoading(true);
    wappalyzerApi.lookup(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ wappalyzer_data: { grouped: result.grouped, totalCount: result.totalCount, social: result.social } } as any).eq('id', session.id);
        clearError('wappalyzer');
        fetchData();
      } else { setWappalyzerFailed(true); setError('wappalyzer', result.error || 'Wappalyzer returned an error'); }
      setWappalyzerLoading(false);
    }).catch((e) => { setWappalyzerFailed(true); setError('wappalyzer', e?.message || 'Wappalyzer request failed'); setWappalyzerLoading(false); });
  }, [session, wappalyzerLoading, wappalyzerFailed, fetchData, pauseVersion]);
  // DetectZeStack
  const [detectzestackFailed, setDetectzestackFailed] = useState(false);
  useEffect(() => {
    if (!session || (session as any).detectzestack_data || detectzestackLoading || detectzestackFailed || isIntegrationPaused('detectzestack')) return;
    if (detectzestackTriggeredRef.current) return;
    detectzestackTriggeredRef.current = true;
    setDetectzestackLoading(true);
    detectzestackApi.lookup(session.domain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ detectzestack_data: { grouped: result.grouped, totalCount: result.totalCount, scanDepth: result.scanDepth } } as any).eq('id', session.id);
        clearError('detectzestack');
        fetchData();
      } else { setDetectzestackFailed(true); setError('detectzestack', result.error || 'DetectZeStack returned an error'); }
      setDetectzestackLoading(false);
    }).catch((e) => { setDetectzestackFailed(true); setError('detectzestack', e?.message || 'DetectZeStack request failed'); setDetectzestackLoading(false); });
  }, [session, detectzestackLoading, detectzestackFailed, fetchData, pauseVersion]);
  // AI Tech Analysis — runs after at least one tech source has data
  const [techAnalysisData, setTechAnalysisData] = useState<any>(null);
  const [techAnalysisLoading, setTechAnalysisLoading] = useState(false);
  const [techAnalysisFailed, setTechAnalysisFailed] = useState(false);

  // Load persisted tech analysis data from session
  useEffect(() => {
    if (session?.tech_analysis_data && !techAnalysisData) {
      setTechAnalysisData(session.tech_analysis_data);
    }
  }, [session]);

  useEffect(() => {
    if (techAnalysisData || techAnalysisLoading || techAnalysisFailed) return;
    if (!session) return;
    if (isIntegrationPaused('tech-analysis')) return;
    // Skip if already persisted
    if (session.tech_analysis_data) return;
    const bw = session.builtwith_data;
    const dz = (session as any).detectzestack_data;
    const wp = session.wappalyzer_data;
    if (!bw && !dz && !wp) return;
    const bwReady = !!bw || isIntegrationPaused('builtwith') || builtwithFailed || (!builtwithLoading && !bw);
    const dzReady = !!dz || isIntegrationPaused('detectzestack') || detectzestackFailed || (!detectzestackLoading && !dz);
    const wpReady = !!wp || isIntegrationPaused('wappalyzer') || wappalyzerFailed || (!wappalyzerLoading && !wp);
    if (!bwReady || !dzReady || !wpReady) return;

    setTechAnalysisLoading(true);
    techAnalysisApi.analyze(bw, dz, wp, session.domain).then(async (result) => {
      if (result.success) {
        const data = { analysis: result.analysis, techCount: result.techCount, sourceCount: result.sourceCount, sources: result.sources };
        setTechAnalysisData(data);
        clearError('tech-analysis');
        // Persist to database
        await supabase.from('crawl_sessions').update({ tech_analysis_data: data } as any).eq('id', session.id);
      } else {
        setTechAnalysisFailed(true);
        setError('tech-analysis', result.error || 'AI tech analysis failed');
      }
      setTechAnalysisLoading(false);
    }).catch((e) => { setTechAnalysisFailed(true); setError('tech-analysis', e?.message || 'AI tech analysis failed'); setTechAnalysisLoading(false); });
  }, [session, techAnalysisData, techAnalysisLoading, techAnalysisFailed, builtwithFailed, detectzestackFailed, wappalyzerFailed, builtwithLoading, detectzestackLoading, wappalyzerLoading, pauseVersion]);

  const [gtmetrixFailed, setGtmetrixFailed] = useState(false);
  useEffect(() => {
    if (!session || session.gtmetrix_grade || session.gtmetrix_test_id || runningGtmetrix || gtmetrixFailed || isIntegrationPaused('gtmetrix')) return;
    if (gtmetrixTriggeredRef.current) return;
    gtmetrixTriggeredRef.current = true;
    setRunningGtmetrix(true);
    gtmetrixApi.runTest(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ gtmetrix_grade: result.grade, gtmetrix_scores: result.scores, gtmetrix_test_id: result.testId } as any).eq('id', session.id);
        clearError('gtmetrix');
        fetchData();
      } else { setGtmetrixFailed(true); setError('gtmetrix', result.error || 'GTmetrix returned an error'); }
      setRunningGtmetrix(false);
    }).catch((e) => { setGtmetrixFailed(true); setError('gtmetrix', e?.message || 'GTmetrix request failed'); setRunningGtmetrix(false); });
  }, [session, runningGtmetrix, gtmetrixFailed, fetchData, pauseVersion]);
  // Carbon
  const [carbonFailed, setCarbonFailed] = useState(false);
  useEffect(() => {
    if (!session || session.carbon_data || carbonLoading || carbonFailed || isIntegrationPaused('carbon')) return;
    if (carbonTriggeredRef.current) return;
    carbonTriggeredRef.current = true;
    setCarbonLoading(true);
    websiteCarbonApi.check(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ carbon_data: { green: result.green, bytes: result.bytes, cleanerThan: result.cleanerThan, statistics: result.statistics, rating: result.rating } } as any).eq('id', session.id);
        clearError('carbon');
        fetchData();
      } else { setCarbonFailed(true); setError('carbon', result.error || 'Website Carbon returned an error'); }
      setCarbonLoading(false);
    }).catch((e) => { setCarbonFailed(true); setError('carbon', e?.message || 'Website Carbon request failed'); setCarbonLoading(false); });
  }, [session, carbonLoading, carbonFailed, fetchData, pauseVersion]);
  // CrUX
  const [cruxFailed, setCruxFailed] = useState(false);
  const [cruxNoData, setCruxNoData] = useState(false);
  useEffect(() => {
    if (!session || session.crux_data || cruxLoading || cruxFailed || cruxNoData || isIntegrationPaused('crux')) return;
    if (cruxTriggeredRef.current) return;
    cruxTriggeredRef.current = true;
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
  }, [session, cruxLoading, cruxFailed, cruxNoData, fetchData, pauseVersion]);
  // WAVE
  const [waveFailed, setWaveFailed] = useState(false);
  useEffect(() => {
    if (!session || session.wave_data || waveLoading || waveFailed || isIntegrationPaused('wave')) return;
    if (waveTriggeredRef.current) return;
    waveTriggeredRef.current = true;
    setWaveLoading(true);
    waveApi.scan(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ wave_data: { summary: result.summary, items: result.items, waveUrl: result.waveUrl, creditsRemaining: result.creditsRemaining, pageTitle: result.pageTitle } } as any).eq('id', session.id);
        clearError('wave');
        fetchData();
      } else { setWaveFailed(true); setError('wave', result.error || 'WAVE returned an error'); }
      setWaveLoading(false);
    }).catch((e) => { setWaveFailed(true); setError('wave', e?.message || 'WAVE request failed'); setWaveLoading(false); });
  }, [session, waveLoading, waveFailed, fetchData, pauseVersion]);
  // Mozilla Observatory
  const [observatoryFailed, setObservatoryFailed] = useState(false);
  useEffect(() => {
    if (!session || session.observatory_data || observatoryLoading || observatoryFailed || isIntegrationPaused('observatory')) return;
    if (observatoryTriggeredRef.current) return;
    observatoryTriggeredRef.current = true;
    setObservatoryLoading(true);
    observatoryApi.scan(session.domain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ observatory_data: { grade: result.grade, score: result.score, scannedAt: result.scannedAt, detailsUrl: result.detailsUrl, tests: result.tests, rawHeaders: result.rawHeaders || null, cspRaw: result.cspRaw || null, cspDirectives: result.cspDirectives || null, cookies: result.cookies || null } } as any).eq('id', session.id);
        clearError('observatory');
        fetchData();
      } else { setObservatoryFailed(true); setError('observatory', result.error || 'Observatory returned an error'); }
      setObservatoryLoading(false);
    }).catch((e) => { setObservatoryFailed(true); setError('observatory', e?.message || 'Observatory request failed'); setObservatoryLoading(false); });
  }, [session, observatoryLoading, observatoryFailed, fetchData, pauseVersion]);
  // Ocean.io
  const [oceanLoading, setOceanLoading] = useState(false);
  const [oceanFailed, setOceanFailed] = useState(false);
  const oceanTriggeredRef = useRef(false);
  useEffect(() => {
    if (!session || session.ocean_data || oceanLoading || oceanFailed || isIntegrationPaused('ocean')) return;
    if (oceanTriggeredRef.current) return;
    oceanTriggeredRef.current = true;
    setOceanLoading(true);
    oceanApi.enrich(session.domain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ ocean_data: result } as any).eq('id', session.id);
        clearError('ocean');
        fetchData();
      } else { setOceanFailed(true); setError('ocean', result.error || 'Ocean.io returned an error'); }
      setOceanLoading(false);
    }).catch((e) => { setOceanFailed(true); setError('ocean', e?.message || 'Ocean.io request failed'); setOceanLoading(false); });
  }, [session, oceanLoading, oceanFailed, fetchData, pauseVersion]);
  // Avoma
  const [avomaLoading, setAvomaLoading] = useState(false);
  const [avomaFailed, setAvomaFailed] = useState(false);
  const avomaTriggeredRef = useRef(false);
  useEffect(() => {
    if (!session || (session as any).avoma_data || avomaLoading || avomaFailed || isIntegrationPaused('avoma')) return;
    if (avomaTriggeredRef.current) return;
    avomaTriggeredRef.current = true;
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
  }, [session, avomaLoading, avomaFailed, fetchData, pauseVersion]);
  // HubSpot CRM lookup
  const [hubspotLoading, setHubspotLoading] = useState(false);
  const [hubspotFailed, setHubspotFailed] = useState(false);
  const hubspotTriggeredRef = useRef(false);
  useEffect(() => {
    if (!session || (session as any).hubspot_data || hubspotLoading || hubspotFailed || isIntegrationPaused('hubspot')) return;
    if (hubspotTriggeredRef.current) return;
    hubspotTriggeredRef.current = true;
    setHubspotLoading(true);
    hubspotApi.lookup(session.domain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ hubspot_data: result } as any).eq('id', session.id);
        clearError('hubspot');
        fetchData();
      } else { setHubspotFailed(true); setError('hubspot', result.error || 'HubSpot returned an error'); }
      setHubspotLoading(false);
    }).catch((e) => { setHubspotFailed(true); setError('hubspot', e?.message || 'HubSpot request failed'); setHubspotLoading(false); });
  }, [session, hubspotLoading, hubspotFailed, fetchData, pauseVersion]);
  // Apollo.io contact enrichment (manual search, persisted)
  const [apolloData, setApolloData] = useState<any>(session?.apollo_data || null);
  const [apolloLoading, setApolloLoading] = useState(false);
  const apolloAutoTriggered = useRef(false);

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

  // Auto-enrich Apollo using primary HubSpot contact
  useEffect(() => {
    if (apolloAutoTriggered.current) return;
    if (apolloLoading || apolloData || session?.apollo_data) return;
    if (isIntegrationPaused('apollo')) return;
    const hubspot = (session as any)?.hubspot_data;
    if (!hubspot?.success || !hubspot?.contacts?.length) return;

    // Find primary contact (same logic as HubSpotCard: job title first, then most recent)
    const sorted = [...hubspot.contacts].sort((a: any, b: any) => {
      const aHasTitle = a.jobtitle ? 1 : 0;
      const bHasTitle = b.jobtitle ? 1 : 0;
      if (bHasTitle !== aHasTitle) return bHasTitle - aHasTitle;
      const aDate = a.lastmodifieddate ? new Date(a.lastmodifieddate).getTime() : 0;
      const bDate = b.lastmodifieddate ? new Date(b.lastmodifieddate).getTime() : 0;
      return bDate - aDate;
    });
    const primary = sorted[0];
    if (!primary?.email) return;

    apolloAutoTriggered.current = true;
    console.log(`[apollo] Auto-enriching primary HubSpot contact: ${primary.email}`);
    handleApolloSearch(primary.email, primary.firstname || undefined, primary.lastname || undefined);
  }, [(session as any)?.hubspot_data, apolloData, apolloLoading, pauseVersion]);

  // Unique Templates rerun support
  const [templatesRerunning, setTemplatesRerunning] = useState(false);
  const templatesRerunFnRef = useRef<(() => void) | null>(null);

  // Forms rerun support
  const formsRerunFnRef = useRef<(() => void) | null>(null);

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
  }, [session, httpstatusLoading, httpstatusFailed, fetchData, pauseVersion]);
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
  }, [session, w3cLoading, w3cFailed, fetchData, pauseVersion]);
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
  }, [session, schemaLoading, schemaFailed, fetchData, pauseVersion]);
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
  }, [session, readableLoading, readableFailed, fetchData, pauseVersion]);
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
  }, [session, yellowlabLoading, yellowlabFailed, fetchData, pauseVersion]);
  // Broken Link Checker
  const [linkcheckLoading, setLinkcheckLoading] = useState(false);
  const [linkcheckFailed, setLinkcheckFailed] = useState(false);
  const [linkcheckProgress, setLinkcheckProgress] = useState<{ checked: number; total: number } | null>(null);
  const [linkcheckStreamingResults, setLinkcheckStreamingResults] = useState<{ url: string; statusCode: number }[] | null>(null);
  const linkcheckRunningRef = useRef(false);
  const linkcheckAbortRef = useRef<AbortController | null>(null);
  const effectiveDiscoveredUrls = discoveredUrls.length > 0 ? discoveredUrls : (session?.discovered_urls || []);

  const stopLinkcheck = useCallback(async () => {
    linkcheckAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!session || session.linkcheck_data || linkcheckLoading || linkcheckFailed || isIntegrationPaused('link-checker') || effectiveDiscoveredUrls.length === 0) return;
    if (linkcheckRunningRef.current) return;
    linkcheckRunningRef.current = true;
    // Snapshot URLs at start so mid-run URL changes don't cause issues
    const urlsToCheck = [...effectiveDiscoveredUrls];
    const abortController = new AbortController();
    linkcheckAbortRef.current = abortController;
    setLinkcheckLoading(true);
    setLinkcheckStreamingResults(null);
    setLinkcheckProgress({ checked: 0, total: urlsToCheck.length });
    linkCheckerApi.check(
      urlsToCheck,
      (checked, total) => { setLinkcheckProgress({ checked, total }); },
      (partialResults) => { setLinkcheckStreamingResults(partialResults); },
      abortController.signal,
    ).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ linkcheck_data: result } as any).eq('id', session.id);
        clearError('link-checker');
        setLinkcheckStreamingResults(null);
        await fetchData();
      } else { setLinkcheckFailed(true); setError('link-checker', result.error || 'Link checker returned an error'); }
      setLinkcheckLoading(false);
      setLinkcheckProgress(null);
      linkcheckRunningRef.current = false;
      linkcheckAbortRef.current = null;
    }).catch((e) => { setLinkcheckFailed(true); setError('link-checker', e?.message || 'Link checker request failed'); setLinkcheckLoading(false); setLinkcheckProgress(null); linkcheckRunningRef.current = false; linkcheckAbortRef.current = null; });
  }, [session, linkcheckLoading, linkcheckFailed, effectiveDiscoveredUrls, fetchData, pauseVersion]);
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
  }, [session, navLoading, navFailed, fetchData, pauseVersion]);
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
  }, [session, sitemapLoading, sitemapFailed, fetchData, pauseVersion]);
  // Hydrate sitemapHints from persisted sitemap_data on load
  useEffect(() => {
    if (session?.sitemap_data?.contentTypeHints?.length && sitemapHints.length === 0) {
      setSitemapHints(session.sitemap_data.contentTypeHints);
    }
  }, [session?.sitemap_data]);

  // Forms Detection (manual trigger — scrapes pages via Firecrawl)
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsFailed, setFormsFailed] = useState(false);
  const runFormsDetection = useCallback(async () => {
    if (!session || formsLoading) return;
    setFormsLoading(true);
    setFormsFailed(false);
    clearError('forms');
    try {
      const urls = effectiveDiscoveredUrls.length > 0 ? effectiveDiscoveredUrls : [session.base_url];
      const result = await formsDetectApi.detect(urls, session.domain);
      if (result.success && result.data) {
        await supabase.from('crawl_sessions').update({ forms_data: result.data } as any).eq('id', session.id);
        clearError('forms');
        fetchData();
        toast.success(`Found ${result.data.summary?.uniqueForms || 0} unique forms`);
      } else {
        setFormsFailed(true);
        setError('forms', result.error || 'Forms detection failed');
      }
    } catch (e: any) {
      setFormsFailed(true);
      setError('forms', e?.message || 'Forms detection request failed');
    } finally {
      setFormsLoading(false);
    }
  }, [session, formsLoading, effectiveDiscoveredUrls, fetchData]);

  const formsAutoRunRef = useRef(false);

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
  }, [session, contentTypesLoading, contentTypesFailed, effectiveDiscoveredUrls, fetchData, pauseVersion]);
  // Auto-run forms detection after content types and nav structure are ready
  useEffect(() => {
    if (!session || (session as any).forms_data || formsLoading || formsFailed || formsAutoRunRef.current || isIntegrationPaused('forms')) return;
    if (effectiveDiscoveredUrls.length === 0) return;
    if (!contentTypesFailed && !(session as any).content_types_data) return;
    if (!navFailed && !(session as any).nav_structure) return;
    formsAutoRunRef.current = true;
    runFormsDetection();
  }, [session, formsLoading, formsFailed, effectiveDiscoveredUrls, runFormsDetection, contentTypesFailed, navFailed, pauseVersion]);

  // IMPORTANT: Wait for content_types_data and nav_structure to be available (or failed) before running
  const [autoTagging, setAutoTagging] = useState(false);
  const [autoTagProgress, setAutoTagProgress] = useState('');
  const autoTagTriedRef = useRef(false);

  const contentTypesReady = !!(session as any)?.content_types_data || contentTypesFailed;
  const navReady = !!(session as any)?.nav_structure || navFailed;
  const prerequisitesReady = contentTypesReady && navReady && effectiveDiscoveredUrls.length > 0;

  useEffect(() => {
    if (!session || !prerequisitesReady || autoTagging || autoTagTriedRef.current) return;
    // Only auto-seed if page_tags is empty/null
    if ((session as any).page_tags && Object.keys((session as any).page_tags).length > 0) return;

    const runAutoTag = async () => {
      autoTagTriedRef.current = true;
      setAutoTagging(true);
      try {
        // Gather homepage content from scraped pages if available
        const homePage = pages.find(p => {
          try { return new URL(p.url).pathname === '/'; } catch { return false; }
        });
        const homepageContent = homePage?.raw_content?.substring(0, 4000) || '';
        const navData = (session as any).nav_structure;

        const BATCH_SIZE = autoTagPagesApi.BATCH_SIZE;
        const allUrls = effectiveDiscoveredUrls;
        const totalBatches = Math.ceil(allUrls.length / BATCH_SIZE);
        const allPages: { url: string; template: string; baseType?: string; cptName?: string }[] = [];
        let industry: string | undefined;
        let industryConfidence: string | undefined;

        // Batch 1: detect industry
        const firstBatchUrls = allUrls.slice(0, BATCH_SIZE);
        setAutoTagProgress(`1/${totalBatches}`);
        const firstResult = await autoTagPagesApi.classifyBatch(
          firstBatchUrls, session.domain, homepageContent, navData,
        );
        if (firstResult.success && firstResult.pages?.length) {
          allPages.push(...firstResult.pages);
        }
        if (firstResult.industry) {
          industry = firstResult.industry;
          industryConfidence = firstResult.industryConfidence;
        }

        // Batches 2+: run in parallel with detected industry
        if (totalBatches > 1) {
          const remainingBatches: string[][] = [];
          for (let i = 1; i < totalBatches; i++) {
            remainingBatches.push(allUrls.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE));
          }
          let completed = 1;
          const results = await Promise.allSettled(
            remainingBatches.map(batchUrls =>
              autoTagPagesApi.classifyBatch(
                batchUrls, session.domain, homepageContent, navData, industry,
              ).then(r => {
                completed++;
                setAutoTagProgress(`${completed}/${totalBatches}`);
                return r;
              })
            )
          );
          for (const r of results) {
            if (r.status === 'fulfilled' && r.value.success && r.value.pages?.length) {
              allPages.push(...r.value.pages);
            }
          }
        }

        setAutoTagProgress('');

        if (allPages.length > 0) {
          // Build PageTagsMap from AI results (now with baseType)
          const tagMap: PageTagsMap = {};
          for (const page of allPages) {
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
          if (industry) {
            console.log(`[auto-tag] Industry: ${industry} (${industryConfidence})`);
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
        setAutoTagProgress('');
      }
    };

    runAutoTag();
  }, [session?.id, prerequisitesReady, autoTagging]);

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
      builtwith: () => { setBuiltwithFailed(false); setBuiltwithLoading(false); builtwithTriggeredRef.current = false; },
      semrush: () => { setSemrushFailed(false); setSemrushLoading(false); semrushTriggeredRef.current = false; },
      psi: () => { setPsiFailed(false); setPsiLoading(false); psiTriggeredRef.current = false; },
      wappalyzer: () => { setWappalyzerFailed(false); setWappalyzerLoading(false); wappalyzerTriggeredRef.current = false; },
      detectzestack: () => { setDetectzestackFailed(false); setDetectzestackLoading(false); detectzestackTriggeredRef.current = false; },
      gtmetrix: () => { setGtmetrixFailed(false); setRunningGtmetrix(false); gtmetrixTriggeredRef.current = false; },
      carbon: () => { setCarbonFailed(false); setCarbonLoading(false); carbonTriggeredRef.current = false; },
      crux: () => { setCruxFailed(false); setCruxNoData(false); setCruxLoading(false); cruxTriggeredRef.current = false; },
      wave: () => { setWaveFailed(false); setWaveLoading(false); waveTriggeredRef.current = false; },
      observatory: () => { setObservatoryFailed(false); setObservatoryLoading(false); observatoryTriggeredRef.current = false; },
      ocean: () => { setOceanFailed(false); setOceanLoading(false); oceanTriggeredRef.current = false; },
      avoma: () => { setAvomaFailed(false); setAvomaLoading(false); avomaTriggeredRef.current = false; },
      hubspot: () => { setHubspotFailed(false); setHubspotLoading(false); hubspotTriggeredRef.current = false; },
      apollo: () => { setApolloLoading(false); apolloAutoTriggered.current = false; },
      ssllabs: () => { setSsllabsFailed(false); setSsllabsLoading(false); ssllabsPollingRef.current = false; },
      httpstatus: () => { setHttpstatusFailed(false); setHttpstatusLoading(false); },
      w3c: () => { setW3cFailed(false); setW3cLoading(false); },
      schema: () => { setSchemaFailed(false); setSchemaLoading(false); },
      readable: () => { setReadableFailed(false); setReadableLoading(false); },
      yellowlab: () => { setYellowlabFailed(false); setYellowlabLoading(false); yellowlabPollingRef.current = false; },
      'link-checker': () => { setLinkcheckFailed(false); setLinkcheckLoading(false); linkcheckRunningRef.current = false; },
      'nav-structure': () => { setNavFailed(false); setNavLoading(false); },
      'content-types': () => { setContentTypesFailed(false); setContentTypesLoading(false); },
      'sitemap': () => { setSitemapFailed(false); setSitemapLoading(false); },
      'templates': () => { setTemplatesRerunning(false); templatesRerunFnRef.current?.(); },
      'page-tags': () => { setAutoTagging(false); autoTagTriedRef.current = false; },
      'forms': () => {
        setFormsFailed(false); setFormsLoading(false); formsAutoRunRef.current = false;
        formsRerunFnRef.current?.();
        // Also clear forms_tiers
        supabase.from('crawl_sessions').update({ forms_tiers: null } as any).eq('id', session!.id).then();
      },
    };
    resetMap[key]?.();
    // Refresh session so useEffect picks up null data
    fetchData();
  }, [session, fetchData]);

  const integrationList: { key: string; dbColumn: string }[] = [
    { key: 'sitemap', dbColumn: 'sitemap_data' },
    { key: 'builtwith', dbColumn: 'builtwith_data' },
    { key: 'wappalyzer', dbColumn: 'wappalyzer_data' },
    { key: 'detectzestack', dbColumn: 'detectzestack_data' },
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
    { key: 'avoma', dbColumn: 'avoma_data' },
    { key: 'hubspot', dbColumn: 'hubspot_data' },
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
    setDetectzestackFailed(false); setDetectzestackLoading(false);
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
    setLinkcheckFailed(false); setLinkcheckLoading(false); linkcheckRunningRef.current = false;
    setAvomaFailed(false); setAvomaLoading(false);
    setHubspotFailed(false); setHubspotLoading(false);
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
    wappalyzer: wappalyzerLoading, detectzestack: detectzestackLoading, carbon: carbonLoading, crux: cruxLoading,
    wave: waveLoading, observatory: observatoryLoading, ocean: oceanLoading,
    ssllabs: ssllabsLoading, httpstatus: httpstatusLoading, w3c: w3cLoading,
    schema: schemaLoading, readable: readableLoading, yellowlab: yellowlabLoading,
    'link-checker': linkcheckLoading, 'nav-structure': navLoading,
    sitemap: sitemapLoading, 'content-types': contentTypesLoading,
    gtmetrix: runningGtmetrix, avoma: avomaLoading, hubspot: hubspotLoading,
    forms: formsLoading, templates: templatesRerunning,
    'tech-analysis': techAnalysisLoading, 'page-tags': autoTagging,
  };

  useEffect(() => {
    const prev = prevLoadingRef.current;
    for (const [key, isLoading] of Object.entries(loadingMap)) {
      if (prev[key] === undefined && isLoading) {
        integrationStartTimes.current[key] = Date.now();
      } else if (prev[key] && !isLoading) {
        const start = integrationStartTimes.current[key];
        if (start) {
          const duration = Math.round((Date.now() - start) / 1000);
          const timestamp = new Date().toISOString();
          setIntegrationDurations(d => {
            const next = { ...d, [key]: duration };
            if (sessionId) {
              supabase.from('crawl_sessions').update({ integration_durations: next } as any).eq('id', sessionId).then();
            }
            return next;
          });
          setIntegrationTimestamps(t => {
            const next = { ...t, [key]: timestamp };
            if (sessionId) {
              supabase.from('crawl_sessions').update({ integration_timestamps: next } as any).eq('id', sessionId).then();
            }
            return next;
          });
          delete integrationStartTimes.current[key];
        }
      } else if (!prev[key] && isLoading) {
        integrationStartTimes.current[key] = Date.now();
      }
    }
    prevLoadingRef.current = { ...loadingMap };
  });

  // Record timestamps for integrations that load internally (not tracked by loadingMap)
  useEffect(() => {
    if ((session as any)?.template_tiers && !integrationTimestamps['templates']) {
      const timestamp = new Date().toISOString();
      setIntegrationTimestamps(t => {
        const next = { ...t, templates: timestamp };
        if (sessionId) supabase.from('crawl_sessions').update({ integration_timestamps: next } as any).eq('id', sessionId).then();
        return next;
      });
    }
  }, [(session as any)?.template_tiers]);

  // Build ordered integration steps for global progress bar
  const integrationSteps = session ? [
    { key: 'sitemap', label: 'Sitemaps', loading: sitemapLoading, failed: sitemapFailed, data: session.sitemap_data, paused: isIntegrationPaused('sitemap') },
    { key: 'builtwith', label: 'BuiltWith', loading: builtwithLoading, failed: builtwithFailed, data: session.builtwith_data, paused: isIntegrationPaused('builtwith') },
    { key: 'wappalyzer', label: 'Wappalyzer', loading: wappalyzerLoading, failed: wappalyzerFailed, data: session.wappalyzer_data, paused: isIntegrationPaused('wappalyzer') },
    { key: 'detectzestack', label: 'DetectZeStack', loading: detectzestackLoading, failed: detectzestackFailed, data: (session as any).detectzestack_data, paused: isIntegrationPaused('detectzestack') },
    { key: 'tech-analysis', label: 'Tech Analysis', loading: techAnalysisLoading, failed: techAnalysisFailed, data: techAnalysisData, paused: isIntegrationPaused('tech-analysis') },
    { key: 'semrush', label: 'SEMrush', loading: semrushLoading, failed: semrushFailed, data: session.semrush_data, paused: isIntegrationPaused('semrush') },
    { key: 'httpstatus', label: 'HTTP Status', loading: httpstatusLoading, failed: httpstatusFailed, data: session.httpstatus_data, paused: isIntegrationPaused('httpstatus') },
    { key: 'psi', label: 'PageSpeed', loading: psiLoading, failed: psiFailed, data: session.psi_data, paused: isIntegrationPaused('psi') },
    { key: 'gtmetrix', label: 'GTmetrix', loading: runningGtmetrix, failed: gtmetrixFailed, data: session.gtmetrix_grade, paused: isIntegrationPaused('gtmetrix') },
    { key: 'carbon', label: 'Carbon', loading: carbonLoading, failed: carbonFailed, data: session.carbon_data, paused: isIntegrationPaused('carbon') },
    { key: 'crux', label: 'CrUX', loading: cruxLoading, failed: cruxFailed || cruxNoData, data: session.crux_data, paused: isIntegrationPaused('crux') },
    { key: 'wave', label: 'WAVE', loading: waveLoading, failed: waveFailed, data: session.wave_data, paused: isIntegrationPaused('wave') },
    { key: 'w3c', label: 'W3C', loading: w3cLoading, failed: w3cFailed, data: session.w3c_data, paused: isIntegrationPaused('w3c') },
    { key: 'schema', label: 'Schema', loading: schemaLoading, failed: schemaFailed, data: session.schema_data, paused: isIntegrationPaused('schema') },
    { key: 'readable', label: 'Readable', loading: readableLoading, failed: readableFailed, data: (session as any).readable_data, paused: isIntegrationPaused('readable') },
    { key: 'observatory', label: 'Observatory', loading: observatoryLoading, failed: observatoryFailed, data: session.observatory_data, paused: isIntegrationPaused('observatory') },
    { key: 'ssllabs', label: 'SSL Labs', loading: ssllabsLoading, failed: ssllabsFailed, data: session.ssllabs_data, paused: isIntegrationPaused('ssllabs') },
    { key: 'yellowlab', label: 'Yellow Lab', loading: yellowlabLoading, failed: yellowlabFailed, data: (session as any).yellowlab_data, paused: isIntegrationPaused('yellowlab') },
    { key: 'ocean', label: 'Ocean.io', loading: oceanLoading, failed: oceanFailed, data: session.ocean_data, paused: isIntegrationPaused('ocean') },
    { key: 'nav-structure', label: 'Nav Structure', loading: navLoading, failed: navFailed, data: (session as any).nav_structure, paused: isIntegrationPaused('nav-structure') },
    { key: 'content-types', label: 'Content Types', loading: contentTypesLoading, failed: contentTypesFailed, data: (session as any).content_types_data, paused: isIntegrationPaused('content-types') },
    { key: 'link-checker', label: 'Link Checker', loading: linkcheckLoading, failed: linkcheckFailed, data: session.linkcheck_data, paused: isIntegrationPaused('link-checker') },
    { key: 'forms', label: 'Forms', loading: formsLoading, failed: formsFailed, data: (session as any).forms_data, paused: isIntegrationPaused('forms') },
    { key: 'page-tags', label: autoTagProgress ? `Page Tagging (${autoTagProgress})` : 'Page Tagging', loading: autoTagging, failed: false, data: (session as any).page_tags, paused: false },
    { key: 'templates', label: 'Templates', loading: templatesRerunning || (autoTagging && !(session as any).template_tiers), failed: false, data: (session as any).template_tiers, paused: false },
    { key: 'avoma', label: 'Avoma', loading: avomaLoading, failed: avomaFailed, data: (session as any).avoma_data, paused: isIntegrationPaused('avoma') },
    { key: 'hubspot', label: 'HubSpot', loading: hubspotLoading, failed: hubspotFailed, data: (session as any).hubspot_data, paused: isIntegrationPaused('hubspot') },
  ].map(s => ({
    key: s.key,
    label: s.label,
    status: s.paused ? 'paused' as const
      : s.data ? 'done' as const
      : s.failed ? 'failed' as const
      : s.loading ? 'loading' as const
      : 'pending' as const,
  })) : [];

  const rerunButton = (key: string, dbColumn: string, isLoading: boolean) => {
    if (isSharedView) return null;
    return (
      <div className="flex items-center gap-1">
        {integrationTimestamps[key] && !isLoading && (
          <span className="text-[10px] text-muted-foreground tabular-nums" title={`Last run: ${format(new Date(integrationTimestamps[key]), 'MMM d, yyyy h:mm a')}`}>
            {format(new Date(integrationTimestamps[key]), 'MMM d, h:mm a')}
          </span>
        )}
        {integrationDurations[key] != null && !isLoading && (
          <span className="text-[10px] text-muted-foreground tabular-nums">({integrationDurations[key]}s)</span>
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
      </div>
    );
  };

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
      <header className="px-6">
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-4">
           <div className="flex items-center justify-between">
             <div>
               <h1 className="text-7xl font-light tracking-tight text-foreground leading-none pt-2.5">
                 {session?.domain?.replace(/^www\./i, '')}
               </h1>
               {session?.created_at && (
                 <div className="flex items-center gap-4 text-sm text-muted-foreground tabular-nums mt-2">
                   <span className="flex items-center gap-1">
                     <Clock className="h-3 w-3" />
                     <span className="font-semibold">Created:</span> {format(new Date(session.created_at), 'MMM d, yyyy h:mm a')}
                   </span>
                   {session?.updated_at && session.updated_at !== session.created_at && (
                     <span className="flex items-center gap-1">
                       <RefreshCw className="h-3 w-3" />
                       <span className="font-semibold">Updated:</span> {format(new Date(session.updated_at), 'MMM d, yyyy h:mm a')}
                     </span>
                   )}
                 </div>
               )}
             </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground h-16 w-16 [&>svg]:h-10 [&>svg]:w-10">
                  <Menu className="!h-10 !w-10" strokeWidth={2} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-0">
                <nav className="flex flex-col gap-1 p-4 pt-12">
                  <Button variant="ghost" className="justify-start gap-3 text-base" onClick={() => navigate('/')}>
                    <Search className="h-5 w-5" />
                    New Search
                  </Button>
                  <Button variant="ghost" className="justify-start gap-3 text-base" onClick={() => navigate('/history')}>
                    <History className="h-5 w-5" />
                    History
                  </Button>
                  <Button variant="ghost" className="justify-start gap-3 text-base" onClick={() => navigate('/integrations')}>
                    <Settings className="h-5 w-5" />
                    Integrations
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Global integration progress bar */}
      {session && !isSharedView && <GlobalProgressBar steps={integrationSteps} />}

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="relative flex items-end justify-between">
            {/* Horizontal rule drawn BEHIND the tabs so active tab covers it */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground/30 z-0" />
            <TabsList className="relative h-auto bg-transparent p-0 rounded-none mb-0 gap-0 z-10">
              <TabsTrigger
                value="raw-data"
                style={activeTab === 'raw-data' ? { borderBottomColor: 'transparent', marginBottom: '-2px', paddingBottom: 'calc(0.625rem + 2px)', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : undefined}
                className="relative text-base font-bold px-5 py-2.5 !rounded-t-lg !rounded-b-none border-2 border-transparent bg-transparent text-muted-foreground transition-all !shadow-none !ring-0 data-[state=active]:border-foreground/30 data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                <Globe className="h-4 w-4 mr-2" />
                Site Analysis
              </TabsTrigger>
              {(shouldShowIntegration('avoma', !!(session as any)?.avoma_data, showAllIntegrations) || shouldShowIntegration('hubspot', !!(session as any)?.hubspot_data, showAllIntegrations) || shouldShowIntegration('ocean', !!session?.ocean_data, showAllIntegrations) || shouldShowIntegration('apollo', !!session?.apollo_data, showAllIntegrations)) && (
                <TabsTrigger
                  value="prospecting"
                  style={activeTab === 'prospecting' ? { borderBottomColor: 'transparent', marginBottom: '-2px', paddingBottom: 'calc(0.625rem + 2px)', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : undefined}
                  className="relative text-base font-bold px-5 py-2.5 !rounded-t-lg !rounded-b-none border-2 border-transparent bg-transparent text-muted-foreground transition-all !shadow-none !ring-0 data-[state=active]:border-foreground/30 data-[state=active]:bg-background data-[state=active]:text-foreground"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Prospecting
                </TabsTrigger>
              )}
              <TabsTrigger
                value="ai-research"
                style={activeTab === 'ai-research' ? { borderBottomColor: 'transparent', marginBottom: '-2px', paddingBottom: 'calc(0.625rem + 2px)', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : undefined}
                className="relative text-base font-bold px-5 py-2.5 !rounded-t-lg !rounded-b-none border-2 border-transparent bg-transparent text-muted-foreground transition-all !shadow-none !ring-0 data-[state=active]:border-foreground/30 data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                <Brain className="h-4 w-4 mr-2" />
                AI Research
              </TabsTrigger>
              <TabsTrigger
                value="knowledge"
                style={activeTab === 'knowledge' ? { borderBottomColor: 'transparent', marginBottom: '-2px', paddingBottom: 'calc(0.625rem + 2px)', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : undefined}
                className="relative text-base font-bold px-5 py-2.5 !rounded-t-lg !rounded-b-none border-2 border-transparent bg-transparent text-muted-foreground transition-all !shadow-none !ring-0 data-[state=active]:border-foreground/30 data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Knowledge
              </TabsTrigger>
            </TabsList>

            {/* Unified actions dropdown */}
            <div className="flex items-center gap-2 pb-2 no-print">
              {activeTab === 'raw-data' && !isSharedView && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 px-2 text-muted-foreground">
                      <Menu className="h-4 w-4" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">View</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setShowAllIntegrations(!showAllIntegrations)}>
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      {showAllIntegrations ? 'Active Only' : 'Show All'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAllCollapsed(!allCollapsed)}>
                      {allCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5 mr-1.5" /> : <ChevronsDownUp className="h-3.5 w-3.5 mr-1.5" />}
                      {allCollapsed ? 'Expand All' : 'Collapse All'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setRerunConfirmOpen(true)} disabled={rerunningAll}>
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${rerunningAll ? 'animate-spin' : ''}`} />
                      Re-run All
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set('view', 'shared');
                      navigator.clipboard.writeText(url.toString());
                      toast.success('View-only link copied to clipboard');
                    }}>
                      <Share2 className="h-3.5 w-3.5 mr-1.5" />
                      Share Link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Export</DropdownMenuLabel>
                    {session?.deep_research_data?.report && (
                      <DropdownMenuItem onClick={() => downloadReportPdf(session.deep_research_data.report, 'Deep Research Report', session.domain)}>
                        <Brain className="h-3.5 w-3.5 mr-1.5" />
                        Deep Research PDF
                      </DropdownMenuItem>
                    )}
                    {session?.observations_data && (
                      <DropdownMenuItem onClick={() => downloadReportPdf(session.observations_data, 'Observations & Insights', session.domain)}>
                        <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
                        Observations PDF
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => exportAsPdf()}>
                      Export as PDF (Print)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => session && exportAsJson(session, pages)}>
                      Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => session && exportAsMarkdown(session, pages)}>
                      Export as Markdown
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => session && exportAsZip(session, pages)}>
                      <Layers className="h-3.5 w-3.5 mr-1.5" />
                      Export as ZIP
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {activeTab === 'ai-research' && !isSharedView && (
                <>
                  {session?.deep_research_data?.report && (
                    <Button variant="outline" size="sm" onClick={() => downloadReportPdf(session.deep_research_data.report, 'Deep Research Report', session.domain)}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Deep Research PDF
                    </Button>
                  )}
                  {session?.observations_data && (
                    <Button variant="outline" size="sm" onClick={() => downloadReportPdf(session.observations_data, 'Observations & Insights', session.domain)}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Observations PDF
                    </Button>
                  )}
                </>
              )}
            </div>
            <AlertDialog open={rerunConfirmOpen} onOpenChange={setRerunConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Re-run all integrations?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all existing results and re-run every active integration from scratch. This may take several minutes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { setRerunConfirmOpen(false); rerunAll(); }}>Yes, re-run all</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <TabsContent value="raw-data" className="mt-8 space-y-8">

        {/* ══════ 🔗 URL Analysis ══════ */}
        {(
          (session && shouldShowIntegration('sitemap', !!session.sitemap_data, showAllIntegrations, isSharedView)) ||
          (session && shouldShowIntegration('url-discovery', !!session.discovered_urls, showAllIntegrations, isSharedView)) ||
          shouldShowIntegration('httpstatus', !!session?.httpstatus_data, showAllIntegrations, isSharedView) ||
          shouldShowIntegration('link-checker', !!session?.linkcheck_data || effectiveDiscoveredUrls.length > 0, showAllIntegrations, isSharedView)
        ) && (
          <CollapsibleSection title="URL Analysis" collapsed={isSectionCollapsed("section-url-analysis") ?? false} onToggle={(c) => toggleSection("section-url-analysis", c)}>
            <SortedIntegrationList className="space-y-6">
              {session && shouldShowIntegration('sitemap', !!session.sitemap_data, showAllIntegrations, isSharedView) && (
                <SectionCard collapsed={allCollapsed} sectionId="sitemap" persistedCollapsed={isSectionCollapsed("sitemap")} onCollapseChange={toggleSection} title="XML Sitemaps" icon={<MapIcon className="h-5 w-5 text-foreground" />} loading={sitemapLoading && !session.sitemap_data} loadingText="Parsing XML sitemaps..." error={sitemapFailed} errorText={integrationErrors.sitemap} headerExtra={<div className="flex items-center gap-1.5">{rerunButton('sitemap', 'sitemap_data', sitemapLoading)}{session.sitemap_data && innerExpandToggle(sitemapInnerExpand, setSitemapInnerExpand)}</div>} paused={isIntegrationPaused('sitemap') && !session.sitemap_data} onTogglePause={() => handleTogglePause('sitemap')}>
                  {session.sitemap_data ? <SitemapCard data={session.sitemap_data} globalInnerExpand={sitemapInnerExpand} pageTags={(session as any).page_tags} onPageTagChange={handlePageTagChange} /> : null}
                </SectionCard>
              )}

              {session && shouldShowIntegration('url-discovery', !!session.discovered_urls, showAllIntegrations, isSharedView) && (
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
                  lastRunTimestamp={integrationTimestamps['url-discovery'] || null}
                  duration={integrationDurations['url-discovery'] ?? null}
                  isSharedView={isSharedView}
                  onUrlsPersist={async (urls) => {
                    const timestamp = new Date().toISOString();
                    setIntegrationTimestamps(t => {
                      const next = { ...t, 'url-discovery': timestamp };
                      supabase.from('crawl_sessions').update({ integration_timestamps: next } as any).eq('id', session.id).then();
                      return next;
                    });
                    await supabase.from('crawl_sessions').update({ discovered_urls: urls, linkcheck_data: null } as any).eq('id', session.id);
                    setDiscoveredUrls(urls);
                    setLinkcheckFailed(false);
                    setLinkcheckLoading(false);
                    linkcheckRunningRef.current = false;
                    linkcheckRunningRef.current = false;
                    setLinkcheckProgress(null);
                    console.log('Discovered URLs persisted, link check data cleared for re-run');
                    fetchData();
                  }}
                />
              )}

              {shouldShowIntegration('httpstatus', !!session?.httpstatus_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="httpstatus" persistedCollapsed={isSectionCollapsed("httpstatus")} onCollapseChange={toggleSection} title="httpstatus.io — Redirects & HTTP Status" icon={<Link className="h-5 w-5 text-foreground" />} loading={httpstatusLoading && !session?.httpstatus_data} loadingText="Checking HTTP redirect chain..." error={httpstatusFailed} errorText={integrationErrors.httpstatus} headerExtra={rerunButton('httpstatus', 'httpstatus_data', httpstatusLoading)} paused={isIntegrationPaused('httpstatus') && !session?.httpstatus_data} onTogglePause={() => handleTogglePause('httpstatus')}>
                {session?.httpstatus_data ? <HttpStatusCard data={session.httpstatus_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('link-checker', !!session?.linkcheck_data || effectiveDiscoveredUrls.length > 0, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="link-checker" persistedCollapsed={isSectionCollapsed("link-checker")} onCollapseChange={toggleSection} title="Broken Link Checker" icon={<LinkIcon className="h-5 w-5 text-foreground" />} loading={linkcheckLoading && !session?.linkcheck_data} loadingText={linkcheckProgress ? `Checking URLs for broken links... ${linkcheckProgress.checked} of ${linkcheckProgress.total} checked` : `Checking ${effectiveDiscoveredUrls.length} URLs for broken links...`} error={linkcheckFailed} errorText={integrationErrors['link-checker']} headerExtra={rerunButton('link-checker', 'linkcheck_data', linkcheckLoading)} paused={isIntegrationPaused('link-checker') && !session?.linkcheck_data} onTogglePause={() => handleTogglePause('link-checker')}>
                {session?.linkcheck_data ? <BrokenLinksCard data={session.linkcheck_data} /> : !linkcheckLoading && effectiveDiscoveredUrls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Waiting for URL discovery to complete…</p>
                ) : !linkcheckLoading ? (
                  <p className="text-sm text-muted-foreground">Preparing link checks…</p>
                ) : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}

        {/* ══════ 📊 Content Analysis ══════ */}
        {(
          shouldShowIntegration('nav-structure', !!(session as any)?.nav_structure, showAllIntegrations) ||
          (session && (session as any)?.page_tags) ||
          shouldShowIntegration('content-types', !!(session as any)?.content_types_data, showAllIntegrations) ||
          shouldShowIntegration('content', pages.length > 0, showAllIntegrations, isSharedView) ||
          shouldShowIntegration('readable', !!(session as any)?.readable_data, showAllIntegrations) ||
          shouldShowIntegration('forms', !!(session as any)?.forms_data, showAllIntegrations)
        ) && (
          <CollapsibleSection title="Content Analysis" collapsed={isSectionCollapsed("section-content-analysis") ?? false} onToggle={(c) => toggleSection("section-content-analysis", c)}>
            <SortedIntegrationList className="space-y-6">
              {session && (
              <SectionCard collapsed={allCollapsed} sectionId="content-audit" persistedCollapsed={isSectionCollapsed("content-audit")} onCollapseChange={toggleSection} title="Content Audit" icon={<Layers className="h-5 w-5 text-foreground" />} loading={!(session as any)?.page_tags && (autoTagging || contentTypesLoading)} loadingText="Waiting for page tagging to complete…" headerExtra={(session as any)?.page_tags ? <div className="flex items-center gap-1.5">{integrationTimestamps['page-tags'] && !autoTagging && (<span className="text-[10px] text-muted-foreground tabular-nums" title={`Last run: ${format(new Date(integrationTimestamps['page-tags']), 'MMM d, yyyy h:mm a')}`}>{format(new Date(integrationTimestamps['page-tags']), 'MMM d, h:mm a')}</span>)}{integrationDurations['page-tags'] != null && !autoTagging && (<span className="text-[10px] text-muted-foreground tabular-nums">({integrationDurations['page-tags']}s)</span>)}{innerExpandToggle(redesignInnerExpand, setRedesignInnerExpand)}</div> : undefined}>
                {(session as any)?.page_tags ? (
                  <RedesignEstimateCard pageTags={(session as any).page_tags} contentTypesData={(session as any).content_types_data} globalInnerExpand={redesignInnerExpand} />
                ) : null}
              </SectionCard>
              )}

              {shouldShowIntegration('content-types', !!(session as any)?.content_types_data, showAllIntegrations) && (
              <SectionCard collapsed={allCollapsed} sectionId="content-types" persistedCollapsed={isSectionCollapsed("content-types")} onCollapseChange={toggleSection} title="Bulk Content (Posts & CPTs)" icon={<Layers className="h-5 w-5 text-foreground" />} loading={contentTypesLoading && !(session as any)?.content_types_data} loadingText={contentTypesProgress || "Classifying content types across discovered URLs..."} error={contentTypesFailed} errorText={integrationErrors['content-types']} headerExtra={<div className="flex items-center gap-1.5">{rerunButton('content-types', 'content_types_data', contentTypesLoading)}{(session as any)?.content_types_data && innerExpandToggle(contentTypesInnerExpand, setContentTypesInnerExpand)}</div>} paused={isIntegrationPaused('content-types') && !(session as any)?.content_types_data} onTogglePause={() => handleTogglePause('content-types')}>
                {(session as any)?.content_types_data ? <ContentTypesCard data={(session as any).content_types_data} navStructure={(session as any).nav_structure || null} pageTags={(session as any).page_tags} onPageTagChange={isSharedView ? undefined : handlePageTagChange} globalInnerExpand={contentTypesInnerExpand} onDataChange={isSharedView ? undefined : async (updated) => {
                  await supabase.from('crawl_sessions').update({ content_types_data: updated as any }).eq('id', sessionId!);
                  fetchData();
                }} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('nav-structure', !!(session as any)?.nav_structure, showAllIntegrations) && (
              <SectionCard collapsed={allCollapsed} sectionId="nav-structure" persistedCollapsed={isSectionCollapsed("nav-structure")} onCollapseChange={toggleSection} title="Site Navigation" icon={<Navigation className="h-5 w-5 text-foreground" />} loading={navLoading && !(session as any)?.nav_structure} loadingText="Extracting navigation structure from header..." error={navFailed} errorText={integrationErrors['nav-structure']} headerExtra={<div className="flex items-center gap-1.5">{!isSharedView && (session as any)?.nav_structure && <><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navRef.current?.copyMarkdown()} title="Copy as Markdown"><Copy className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navRef.current?.copyRichText()} title="Copy as Rich Text"><FileText className="h-3.5 w-3.5" /></Button></>}{rerunButton('nav-structure', 'nav_structure', navLoading)}{(session as any)?.nav_structure && innerExpandToggle(navInnerExpand, setNavInnerExpand)}</div>} paused={isIntegrationPaused('nav-structure') && !(session as any)?.nav_structure} onTogglePause={() => handleTogglePause('nav-structure')}>
                {(session as any)?.nav_structure ? <NavStructureCard ref={navRef} data={(session as any).nav_structure} pageTags={(session as any).page_tags} onPageTagChange={isSharedView ? undefined : handlePageTagChange} globalInnerExpand={navInnerExpand} /> : null}
              </SectionCard>
              )}

              {session && shouldShowIntegration('content', pages.length > 0, showAllIntegrations, isSharedView) && (
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

              {shouldShowIntegration('readable', !!(session as any)?.readable_data, showAllIntegrations) && (
              <SectionCard collapsed={allCollapsed} sectionId="readable" persistedCollapsed={isSectionCollapsed("readable")} onCollapseChange={toggleSection} title="Readable.com — Readability Analysis" icon={<FileText className="h-5 w-5 text-foreground" />} loading={readableLoading && !(session as any)?.readable_data} loadingText="Scoring content readability..." error={readableFailed} errorText={integrationErrors.readable} headerExtra={rerunButton('readable', 'readable_data', readableLoading)} paused={isIntegrationPaused('readable') && !(session as any)?.readable_data} onTogglePause={() => handleTogglePause('readable')}>
                {(session as any)?.readable_data ? <ReadableCard data={(session as any).readable_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('forms', !!(session as any)?.forms_data, showAllIntegrations) && (
              <SectionCard collapsed={allCollapsed} sectionId="forms" persistedCollapsed={isSectionCollapsed("forms")} onCollapseChange={toggleSection} title="Forms Analysis (Form Recommendations)" icon={<FileText className="h-5 w-5 text-foreground" />} loading={formsLoading && !(session as any)?.forms_data} loadingText="Scraping pages and detecting forms..." error={formsFailed} errorText={integrationErrors.forms} headerExtra={rerunButton('forms', 'forms_data', formsLoading)} paused={isIntegrationPaused('forms') && !(session as any)?.forms_data} onTogglePause={() => handleTogglePause('forms')}>
                {(session as any)?.forms_data ? (
                  <FormsCard data={(session as any).forms_data} domain={(session as any).domain} savedTiers={(session as any).forms_tiers} onTiersChange={async (tiers) => { await supabase.from('crawl_sessions').update({ forms_tiers: tiers } as any).eq('id', sessionId!); fetchData(); }} onRerunRequest={(fn) => { formsRerunFnRef.current = fn; }} />
                ) : !formsLoading && !isSharedView ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">Detect all forms on the website — contact forms, signups, embedded widgets, and global forms that appear across multiple pages.</p>
                    <Button variant="outline" size="sm" onClick={runFormsDetection} disabled={formsLoading}>
                      <Search className="h-3.5 w-3.5 mr-1.5" />
                      Detect Forms
                    </Button>
                  </div>
                ) : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}

        {/* ══════ 🎨 Design Analysis ══════ */}
        {session && (
          <CollapsibleSection title="Design Analysis" collapsed={isSectionCollapsed("section-design-analysis") ?? false} onToggle={(c) => toggleSection("section-design-analysis", c)}>
            <SortedIntegrationList className="space-y-6">
              {session && (
              <SectionCard collapsed={allCollapsed} sectionId="templates" persistedCollapsed={isSectionCollapsed("templates")} onCollapseChange={toggleSection} title="Template Analysis (Recommended Layouts)" icon={<Layers className="h-5 w-5 text-foreground" />} loading={!(session as any)?.page_tags && (autoTagging || contentTypesLoading)} loadingText="Waiting for page tagging to complete…" headerExtra={(session as any)?.page_tags ? rerunButton('templates', 'template_tiers', templatesRerunning) : undefined}>
                {(session as any)?.page_tags ? (
                  <TemplatesCard pageTags={(session as any).page_tags} navStructure={(session as any).nav_structure} domain={(session as any).domain} savedTiers={(session as any).template_tiers} onTiersChange={async (tiers) => { await supabase.from('crawl_sessions').update({ template_tiers: tiers as any }).eq('id', sessionId!); fetchData(); }} onRerunRequest={(fn) => { templatesRerunFnRef.current = fn; }} />
                ) : null}
              </SectionCard>
              )}

              {session && !isIntegrationPaused('screenshots') && (
                <ScreenshotGallery
                  sessionId={session.id}
                  baseUrl={session.base_url}
                  discoveredUrls={discoveredUrls}
                  collapsed={allCollapsed}
                />
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}

        {/* ══════ 🔧 Technology Detection ══════ */}
        {(shouldShowIntegration('builtwith', !!session?.builtwith_data, showAllIntegrations, isSharedView) || shouldShowIntegration('wappalyzer', !!session?.wappalyzer_data, showAllIntegrations, isSharedView) || shouldShowIntegration('detectzestack', !!(session as any)?.detectzestack_data, showAllIntegrations)) && (
          <CollapsibleSection title="Technology Detection" collapsed={isSectionCollapsed("section-tech-detection") ?? false} onToggle={(c) => toggleSection("section-tech-detection", c)}>
            <SortedIntegrationList className="space-y-6">
              {/* AI Tech Analysis — merged card */}
              {(techAnalysisData || techAnalysisLoading || session?.tech_analysis_data) && (
              <SectionCard collapsed={allCollapsed} sectionId="tech-analysis" persistedCollapsed={isSectionCollapsed("tech-analysis")} onCollapseChange={toggleSection} title="AI Tech Analysis — Merged Stack Intelligence" icon={<Brain className="h-5 w-5 text-foreground" />} loading={techAnalysisLoading} loadingText="AI is analyzing technologies across all sources..." error={techAnalysisFailed} errorText={integrationErrors['tech-analysis']} paused={isIntegrationPaused('tech-analysis') && !(session as any)?.tech_analysis_data} onTogglePause={() => handleTogglePause('tech-analysis')} headerExtra={
                !isSharedView ? (
                  <div className="flex items-center gap-1">
                    {integrationTimestamps['tech-analysis'] && !techAnalysisLoading && (
                      <span className="text-[10px] text-muted-foreground tabular-nums" title={`Last run: ${format(new Date(integrationTimestamps['tech-analysis']), 'MMM d, yyyy h:mm a')}`}>
                        {format(new Date(integrationTimestamps['tech-analysis']), 'MMM d, h:mm a')}
                      </span>
                    )}
                    {integrationDurations['tech-analysis'] != null && !techAnalysisLoading && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">({integrationDurations['tech-analysis']}s)</span>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={techAnalysisLoading} onClick={async () => {
                      setIntegrationDurations(d => { const next = { ...d }; delete next['tech-analysis']; return next; });
                      setTechAnalysisData(null);
                      setTechAnalysisFailed(false);
                      clearError('tech-analysis');
                      if (session) await supabase.from('crawl_sessions').update({ tech_analysis_data: null } as any).eq('id', session.id);
                      fetchData();
                    }} title="Run again">
                      <RefreshCw className={`h-3.5 w-3.5 ${techAnalysisLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                ) : null
              }>
                <TechAnalysisCard data={techAnalysisData} isLoading={techAnalysisLoading} />
              </SectionCard>
              )}

              {shouldShowIntegration('builtwith', !!session?.builtwith_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="builtwith" persistedCollapsed={isSectionCollapsed("builtwith")} onCollapseChange={toggleSection} title="BuiltWith — Technology Stack" icon={<Code className="h-5 w-5 text-foreground" />} loading={builtwithLoading && !session?.builtwith_data} loadingText="Detecting technology stack..." error={builtwithFailed} errorText={integrationErrors.builtwith} headerExtra={rerunButton('builtwith', 'builtwith_data', builtwithLoading)} paused={isIntegrationPaused('builtwith') && !session?.builtwith_data} onTogglePause={() => handleTogglePause('builtwith')}>
                {session?.builtwith_data ? (
                  <BuiltWithCard grouped={session.builtwith_data.grouped} totalCount={session.builtwith_data.totalCount} isLoading={false} credits={builtwithCredits} />
                ) : !builtwithLoading && !builtwithFailed ? (
                  <p className="text-sm text-muted-foreground">Technology detection will run automatically.</p>
                ) : null}
              </SectionCard>
              )}

              {shouldShowIntegration('detectzestack', !!(session as any)?.detectzestack_data, showAllIntegrations) && (
              <SectionCard collapsed={allCollapsed} sectionId="detectzestack" persistedCollapsed={isSectionCollapsed("detectzestack")} onCollapseChange={toggleSection} title="DetectZeStack — Technology Profiling" icon={<Layers className="h-5 w-5 text-foreground" />} loading={detectzestackLoading && !(session as any)?.detectzestack_data} loadingText="Running DetectZeStack detection..." error={detectzestackFailed} errorText={integrationErrors.detectzestack} headerExtra={rerunButton('detectzestack', 'detectzestack_data', detectzestackLoading)} paused={isIntegrationPaused('detectzestack') && !(session as any)?.detectzestack_data} onTogglePause={() => handleTogglePause('detectzestack')}>
                {(session as any)?.detectzestack_data ? (
                  <DetectZeStackCard data={(session as any).detectzestack_data} />
                ) : null}
              </SectionCard>
              )}

              {shouldShowIntegration('wappalyzer', !!session?.wappalyzer_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="wappalyzer" persistedCollapsed={isSectionCollapsed("wappalyzer")} onCollapseChange={toggleSection} title="Wappalyzer — Technology Profiling" icon={<Layers className="h-5 w-5 text-foreground" />} loading={wappalyzerLoading && !session?.wappalyzer_data} loadingText="Running Wappalyzer detection..." error={wappalyzerFailed} errorText={integrationErrors.wappalyzer} headerExtra={rerunButton('wappalyzer', 'wappalyzer_data', wappalyzerLoading)} paused={isIntegrationPaused('wappalyzer') && !session?.wappalyzer_data} onTogglePause={() => handleTogglePause('wappalyzer')}>
                {session?.wappalyzer_data ? (
                  <WappalyzerCard data={session.wappalyzer_data} isLoading={false} />
                ) : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}

        {/* ══════ ⚡ Performance & Sustainability ══════ */}
        {(shouldShowIntegration('gtmetrix', !!session?.gtmetrix_grade, showAllIntegrations, isSharedView) || shouldShowIntegration('psi', !!session?.psi_data, showAllIntegrations, isSharedView) || shouldShowIntegration('crux', !!session?.crux_data, showAllIntegrations, isSharedView) || shouldShowIntegration('yellowlab', !!(session as any)?.yellowlab_data, showAllIntegrations) || shouldShowIntegration('carbon', !!session?.carbon_data, showAllIntegrations, isSharedView)) && (
          <CollapsibleSection title="Performance & Sustainability" collapsed={isSectionCollapsed("section-performance") ?? false} onToggle={(c) => toggleSection("section-performance", c)}>
            <SortedIntegrationList className="space-y-6">
              {shouldShowIntegration('gtmetrix', !!session?.gtmetrix_grade, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="gtmetrix" persistedCollapsed={isSectionCollapsed("gtmetrix")} onCollapseChange={toggleSection} title="GTmetrix — Performance Audit" icon={<Zap className="h-5 w-5 text-foreground" />} loading={runningGtmetrix} loadingText="Running GTmetrix performance test..." error={gtmetrixFailed} errorText={integrationErrors.gtmetrix} headerExtra={rerunButton('gtmetrix', 'gtmetrix_grade', runningGtmetrix)} paused={isIntegrationPaused('gtmetrix') && !session?.gtmetrix_grade} onTogglePause={() => handleTogglePause('gtmetrix')}>
                <GtmetrixCard grade={session?.gtmetrix_grade || null} scores={session?.gtmetrix_scores || null} testId={session?.gtmetrix_test_id || null} isRunning={false} />
              </SectionCard>
              )}

              {shouldShowIntegration('psi', !!session?.psi_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="psi" persistedCollapsed={isSectionCollapsed("psi")} onCollapseChange={toggleSection} title="PageSpeed Insights — Lighthouse" icon={<Gauge className="h-5 w-5 text-foreground" />} loading={psiLoading && !session?.psi_data} loadingText="Running PageSpeed Insights (mobile + desktop)..." error={psiFailed} errorText={integrationErrors.psi} headerExtra={rerunButton('psi', 'psi_data', psiLoading)} paused={isIntegrationPaused('psi') && !session?.psi_data} onTogglePause={() => handleTogglePause('psi')}>
                {session?.psi_data ? <PageSpeedCard data={session.psi_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('crux', !!session?.crux_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="crux" persistedCollapsed={isSectionCollapsed("crux")} onCollapseChange={toggleSection} title="CrUX — Real-User Field Data" icon={<Users className="h-5 w-5 text-foreground" />} loading={cruxLoading && !session?.crux_data} loadingText="Fetching Chrome UX Report field data..." error={cruxFailed} errorText={integrationErrors.crux} headerExtra={rerunButton('crux', 'crux_data', cruxLoading)} paused={isIntegrationPaused('crux') && !session?.crux_data} onTogglePause={() => handleTogglePause('crux')}>
                {session?.crux_data ? (
                  <CruxCard data={session.crux_data} isLoading={false} />
                ) : null}
              </SectionCard>
              )}

              {shouldShowIntegration('yellowlab', !!(session as any)?.yellowlab_data, showAllIntegrations) && (
              <SectionCard collapsed={allCollapsed} sectionId="yellowlab" persistedCollapsed={isSectionCollapsed("yellowlab")} onCollapseChange={toggleSection} title="Yellow Lab Tools — Front-End Quality" icon={<Gauge className="h-5 w-5 text-foreground" />} loading={yellowlabLoading && !(session as any)?.yellowlab_data} loadingText="Running Yellow Lab Tools audit (this may take 1-2 minutes)..." error={yellowlabFailed} errorText={integrationErrors.yellowlab} headerExtra={rerunButton('yellowlab', 'yellowlab_data', yellowlabLoading)} paused={isIntegrationPaused('yellowlab') && !(session as any)?.yellowlab_data} onTogglePause={() => handleTogglePause('yellowlab')}>
                {(session as any)?.yellowlab_data ? <YellowLabCard data={(session as any).yellowlab_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('carbon', !!session?.carbon_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="carbon" persistedCollapsed={isSectionCollapsed("carbon")} onCollapseChange={toggleSection} title="Website Carbon — Sustainability" icon={<Leaf className="h-5 w-5 text-foreground" />} loading={carbonLoading && !session?.carbon_data} loadingText="Measuring carbon footprint..." error={carbonFailed} errorText={integrationErrors.carbon} headerExtra={rerunButton('carbon', 'carbon_data', carbonLoading)} paused={isIntegrationPaused('carbon') && !session?.carbon_data} onTogglePause={() => handleTogglePause('carbon')}>
                {session?.carbon_data ? <WebsiteCarbonCard data={session.carbon_data} isLoading={false} /> : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}

        {/* ══════ 🔍 SEO & Search ══════ */}
        {(shouldShowIntegration('semrush', !!session?.semrush_data, showAllIntegrations, isSharedView) || shouldShowIntegration('schema', !!session?.schema_data, showAllIntegrations, isSharedView)) && (
          <CollapsibleSection title="SEO & Search" collapsed={isSectionCollapsed("section-seo") ?? false} onToggle={(c) => toggleSection("section-seo", c)}>
            <SortedIntegrationList className="space-y-6">
              {shouldShowIntegration('semrush', !!session?.semrush_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="semrush" persistedCollapsed={isSectionCollapsed("semrush")} onCollapseChange={toggleSection} title="SEMrush — Domain Analysis" icon={<Search className="h-5 w-5 text-foreground" />} loading={semrushLoading && !session?.semrush_data} loadingText="Pulling SEMrush data..." error={semrushFailed} errorText={integrationErrors.semrush} headerExtra={rerunButton('semrush', 'semrush_data', semrushLoading)} paused={isIntegrationPaused('semrush') && !session?.semrush_data} onTogglePause={() => handleTogglePause('semrush')}>
                {session?.semrush_data ? <SemrushCard data={session.semrush_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('schema', !!session?.schema_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="schema" persistedCollapsed={isSectionCollapsed("schema")} onCollapseChange={toggleSection} title="Schema.org — Structured Data & Rich Results" icon={<FileText className="h-5 w-5 text-foreground" />} loading={schemaLoading && !session?.schema_data} loadingText="Analyzing structured data markup..." error={schemaFailed} errorText={integrationErrors.schema} headerExtra={rerunButton('schema', 'schema_data', schemaLoading)} paused={isIntegrationPaused('schema') && !session?.schema_data} onTogglePause={() => handleTogglePause('schema')}>
                {session?.schema_data ? <SchemaCard data={session.schema_data} /> : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}

        {/* ══════ 🎨 UX & Accessibility ══════ */}
        {(shouldShowIntegration('psi-accessibility', !!session?.psi_data, showAllIntegrations, isSharedView) || shouldShowIntegration('wave', !!session?.wave_data, showAllIntegrations, isSharedView) || shouldShowIntegration('w3c', !!session?.w3c_data, showAllIntegrations, isSharedView)) && (
          <CollapsibleSection title="UX & Accessibility" collapsed={isSectionCollapsed("section-ux-accessibility") ?? false} onToggle={(c) => toggleSection("section-ux-accessibility", c)}>
            <SortedIntegrationList className="space-y-6">
              {shouldShowIntegration('psi-accessibility', !!session?.psi_data, showAllIntegrations, isSharedView) && shouldShowIntegration('psi', !!session?.psi_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="psi-accessibility" persistedCollapsed={isSectionCollapsed("psi-accessibility")} onCollapseChange={toggleSection} title="Lighthouse — Accessibility Audit" icon={<Accessibility className="h-5 w-5 text-foreground" />} loading={psiLoading && !session?.psi_data} loadingText="Extracting accessibility audits from Lighthouse..." paused={isIntegrationPaused('psi-accessibility') && !session?.psi_data} onTogglePause={() => handleTogglePause('psi-accessibility')}>
                {session?.psi_data ? (
                  <LighthouseAccessibilityCard data={extractPsiAccessibility(session.psi_data)} isLoading={false} />
                ) : !psiLoading && psiFailed ? (
                  <p className="text-sm text-muted-foreground">PageSpeed Insights failed — accessibility data unavailable.</p>
                ) : !psiLoading ? (
                  <p className="text-sm text-muted-foreground">Waiting for PageSpeed Insights data…</p>
                ) : null}
              </SectionCard>
              )}

              {shouldShowIntegration('wave', !!session?.wave_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="wave" persistedCollapsed={isSectionCollapsed("wave")} onCollapseChange={toggleSection} title="WAVE — WCAG Accessibility Scan" icon={<Eye className="h-5 w-5 text-foreground" />} loading={waveLoading && !session?.wave_data} loadingText="Running WAVE accessibility scan..." error={waveFailed} errorText={integrationErrors.wave} headerExtra={rerunButton('wave', 'wave_data', waveLoading)} paused={isIntegrationPaused('wave') && !session?.wave_data} onTogglePause={() => handleTogglePause('wave')}>
                {session?.wave_data ? <WaveCard data={session.wave_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('w3c', !!session?.w3c_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="w3c" persistedCollapsed={isSectionCollapsed("w3c")} onCollapseChange={toggleSection} title="W3C — HTML & CSS Validation" icon={<Code className="h-5 w-5 text-foreground" />} loading={w3cLoading && !session?.w3c_data} loadingText="Running W3C HTML & CSS validation..." error={w3cFailed} errorText={integrationErrors.w3c} headerExtra={rerunButton('w3c', 'w3c_data', w3cLoading)} paused={isIntegrationPaused('w3c') && !session?.w3c_data} onTogglePause={() => handleTogglePause('w3c')}>
                {session?.w3c_data ? <W3CCard data={session.w3c_data} /> : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}

        {/* ══════ 🛡️ Security & Compliance ══════ */}
        {(shouldShowIntegration('observatory', !!session?.observatory_data, showAllIntegrations, isSharedView) || shouldShowIntegration('ssllabs', !!session?.ssllabs_data, showAllIntegrations, isSharedView)) && (
          <CollapsibleSection title="Security & Compliance" collapsed={isSectionCollapsed("section-security") ?? false} onToggle={(c) => toggleSection("section-security", c)}>
            <SortedIntegrationList className="space-y-6">
              {shouldShowIntegration('observatory', !!session?.observatory_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="observatory" persistedCollapsed={isSectionCollapsed("observatory")} onCollapseChange={toggleSection} title="Mozilla Observatory — Security Headers" icon={<Shield className="h-5 w-5 text-foreground" />} loading={observatoryLoading && !session?.observatory_data} loadingText="Running Mozilla Observatory security scan..." error={observatoryFailed} errorText={integrationErrors.observatory} headerExtra={rerunButton('observatory', 'observatory_data', observatoryLoading)} paused={isIntegrationPaused('observatory') && !session?.observatory_data} onTogglePause={() => handleTogglePause('observatory')}>
                {session?.observatory_data ? <ObservatoryCard data={session.observatory_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('ssllabs', !!session?.ssllabs_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="ssllabs" persistedCollapsed={isSectionCollapsed("ssllabs")} onCollapseChange={toggleSection} title="SSL Labs — TLS/SSL Assessment" icon={<Lock className="h-5 w-5 text-foreground" />} loading={ssllabsLoading && !session?.ssllabs_data} loadingText="Running SSL Labs assessment (this may take 1-3 minutes)..." error={ssllabsFailed} errorText={integrationErrors.ssllabs} headerExtra={rerunButton('ssllabs', 'ssllabs_data', ssllabsLoading)} paused={isIntegrationPaused('ssllabs') && !session?.ssllabs_data} onTogglePause={() => handleTogglePause('ssllabs')}>
                {session?.ssllabs_data ? <SslLabsCard data={session.ssllabs_data} /> : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}


          </TabsContent>

          <TabsContent value="ai-research" className="mt-8 space-y-6">
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

          {(shouldShowIntegration('avoma', !!(session as any)?.avoma_data, showAllIntegrations) || shouldShowIntegration('hubspot', !!(session as any)?.hubspot_data, showAllIntegrations) || shouldShowIntegration('ocean', !!session?.ocean_data, showAllIntegrations) || shouldShowIntegration('apollo', !!session?.apollo_data, showAllIntegrations)) && (
            <TabsContent value="prospecting" className="mt-8 space-y-6">
              {shouldShowIntegration('hubspot', !!(session as any)?.hubspot_data, showAllIntegrations) && (
                <SectionCard
                  sectionId="hubspot" persistedCollapsed={isSectionCollapsed("hubspot")} onCollapseChange={toggleSection} title="HubSpot CRM"
                  icon={<Building2 className="h-5 w-5 text-foreground" />}
                  loading={hubspotLoading && !(session as any)?.hubspot_data}
                  loadingText="Searching HubSpot for contacts, companies & deals..."
                  error={hubspotFailed}
                  errorText={integrationErrors.hubspot}
                  headerExtra={rerunButton('hubspot', 'hubspot_data', hubspotLoading)}
                  collapsed={allCollapsed}
                  paused={isIntegrationPaused('hubspot') && !(session as any)?.hubspot_data}
                  onTogglePause={() => handleTogglePause('hubspot')}
                >
                  {(session as any)?.hubspot_data ? <HubSpotCard data={(session as any).hubspot_data} onEnrichWithApollo={handleApolloSearch} /> : null}
                </SectionCard>
              )}
              {shouldShowIntegration('apollo', !!session?.apollo_data, showAllIntegrations) && (
                <SectionCard collapsed={allCollapsed} sectionId="apollo" persistedCollapsed={isSectionCollapsed("apollo")} onCollapseChange={toggleSection} title="Apollo.io — Contact Enrichment" icon={<UserPlus className="h-5 w-5 text-foreground" />} paused={isIntegrationPaused('apollo') && !session?.apollo_data} onTogglePause={() => handleTogglePause('apollo')}>
                  <ApolloCard data={apolloData} isLoading={apolloLoading} onSearch={handleApolloSearch} />
                </SectionCard>
              )}
              {shouldShowIntegration('ocean', !!session?.ocean_data, showAllIntegrations) && (
                <SectionCard collapsed={allCollapsed} sectionId="ocean" persistedCollapsed={isSectionCollapsed("ocean")} onCollapseChange={toggleSection} title="Ocean.io — Firmographics" icon={<Building2 className="h-5 w-5 text-foreground" />} loading={oceanLoading && !session?.ocean_data} loadingText="Enriching company firmographics via Ocean.io..." error={oceanFailed} errorText={integrationErrors.ocean} headerExtra={rerunButton('ocean', 'ocean_data', oceanLoading)} paused={isIntegrationPaused('ocean') && !session?.ocean_data} onTogglePause={() => handleTogglePause('ocean')}>
                  {session?.ocean_data ? <OceanCard data={session.ocean_data} /> : null}
                </SectionCard>
              )}
              {shouldShowIntegration('avoma', !!(session as any)?.avoma_data, showAllIntegrations) && (
                <SectionCard
                  sectionId="avoma" persistedCollapsed={isSectionCollapsed("avoma")} onCollapseChange={toggleSection} title="Avoma — Call Intelligence"
                  icon={<Phone className="h-5 w-5 text-foreground" />}
                  loading={avomaLoading && !(session as any)?.avoma_data}
                  loadingText="Searching Avoma for meetings with @domain attendees..."
                  error={avomaFailed}
                  errorText={integrationErrors.avoma}
                  headerExtra={rerunButton('avoma', 'avoma_data', avomaLoading)}
                  collapsed={allCollapsed}
                  paused={isIntegrationPaused('avoma') && !(session as any)?.avoma_data}
                  onTogglePause={() => handleTogglePause('avoma')}
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
              )}
            </TabsContent>
          )}

          <TabsContent value="knowledge" className="mt-8">
            {session && (
              <SectionCard
                sectionId="knowledge-chat" persistedCollapsed={isSectionCollapsed("knowledge-chat")} onCollapseChange={toggleSection} title="Knowledge Chat"
                icon={<BookOpen className="h-5 w-5 text-foreground" />}
                collapsed={allCollapsed}
                headerExtra={
                  <ChatModelSelector
                    model={chatModel}
                    reasoning={chatReasoning}
                    onModelChange={setChatModel}
                    onReasoningChange={setChatReasoning}
                  />
                }
              >
                <KnowledgeChatCard session={session} pages={scrapedPages} selectedModel={chatModel} reasoning={chatReasoning} />
              </SectionCard>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
