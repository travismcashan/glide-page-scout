import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { recordView } from '@/lib/recentViews';
import { useSectionCollapse } from '@/hooks/use-section-collapse';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ArrowUp, Menu, Brain, Building2, ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, Clock, Copy, Database, Download, ExternalLink, FileText, Lightbulb, Loader2, Zap, Globe, Code, Gauge, Search, Layers, Leaf, Users, Accessibility, Eye, Shield, Lock, Link, LinkIcon, RefreshCw, Phone, UserPlus, Navigation, MapIcon, Share2, Settings, History, BookOpen, MessageCircle, Mail, FileQuestion, Plug, BarChart3 } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { firecrawlApi, aiApi, gtmetrixApi, builtwithApi, semrushApi, pagespeedApi, wappalyzerApi, detectzestackApi, techAnalysisApi, websiteCarbonApi, cruxApi, waveApi, observatoryApi, oceanApi, ssllabsApi, httpstatusApi, linkCheckerApi, w3cApi, schemaApi, readableApi, yellowlabApi, avomaApi, apolloApi, navExtractApi, contentTypesApi, autoTagPagesApi, sitemapApi, formsDetectApi, hubspotApi, ga4Api, searchConsoleApi } from '@/lib/api/firecrawl';
import { PromptLibrary, type PromptTemplate } from '@/components/PromptLibrary';
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
import { GA4Card } from '@/components/GA4Card';
import { SearchConsoleCard } from '@/components/SearchConsoleCard';
import { isIntegrationPaused, loadPausedIntegrations, toggleIntegrationPause } from '@/lib/integrationState';
import { TabSkeleton } from '@/components/TabSkeleton';

/** Check if persisted data is a failure sentinel */
function isErrorSentinel(data: any): boolean {
  return data && typeof data === 'object' && data._error === true;
}

/** Return data only if it's real (not an error sentinel) */
function realData<T>(data: T | null | undefined): T | null {
  if (!data) return null;
  if (isErrorSentinel(data)) return null;
  return data;
}

/** Show integration if it has real (non-error) data, is active, or user toggled "Show All" */
function shouldShowIntegration(key: string, hasData: boolean, showAll: boolean, sharedView?: boolean): boolean {
  if (sharedView) return hasData;
  if (showAll) return true;
  return hasData || !isIntegrationPaused(key);
}
import { AvomaCard } from '@/components/AvomaCard';
import { HubSpotCard } from '@/components/HubSpotCard';
import { ApolloCard } from '@/components/ApolloCard';
import { GmailCard, type GmailCardHandle } from '@/components/GmailCard';
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
import { DocumentLibrary } from '@/components/DocumentLibrary';
import { KnowledgeTabContent } from '@/components/KnowledgeTabContent';
import { ChatModelSelector, type ReasoningEffort, type ModelProvider, PROVIDERS, VERSIONS } from '@/components/chat/ChatModelSelector';
import { exportAsJson, exportAsMarkdown, exportAsPdf, exportAsZip } from '@/lib/exportResults';
import { downloadReportPdf } from '@/lib/downloadReportPdf';
import { autoSeedPageTags, setPageTemplate, setPageTag, getPageTag, type PageTagsMap, type PageTag, getPageTagsSummary } from '@/lib/pageTags';
import { autoIngestIntegrations, autoIngestPages } from '@/lib/ragIngest';
import { computeOverallScore, getIntegrationScore, getCategoryScore, SECTION_TO_CATEGORY, type OverallScore, scoreToGrade } from '@/lib/siteScore';
import { buildSitePath, tabSlugToValue, TAB_SLUGS } from '@/lib/sessionSlug';
import { ScoreOverview } from '@/components/ScoreOverview';
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
  prospect_domain: string | null;
};


function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-40 h-9 w-9 rounded-full bg-muted text-foreground hover:bg-muted/80 shadow-lg flex items-center justify-center transition-opacity"
      aria-label="Back to top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

export default function ResultsPage() {
  const params = useParams<{ sessionId?: string; domain?: string; dateSlug?: string; tab?: string }>();
  const navigate = useNavigate();
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(null);

  // Resolve friendly slug to session ID
  useEffect(() => {
    const resolve = async () => {
      // Direct UUID route (/results/:sessionId)
      if (params.sessionId && /^[0-9a-f]{8}-/i.test(params.sessionId)) {
        setResolvedSessionId(params.sessionId);
        return;
      }
      // Friendly domain route (/sites/:domain or /results/:domain)
      const domain = params.sessionId || params.domain;
      if (!domain) return;
      // Skip if "domain" is actually a tab slug (from /sites/:domain/:tab)
      const domainVariants = [domain, `www.${domain}`];
      let query = supabase
        .from('crawl_sessions')
        .select('id, created_at')
        .in('domain', domainVariants)
        .order('created_at', { ascending: false });
      
      const { data } = await query;
      if (!data || data.length === 0) { navigate('/'); return; }
      
      if (params.dateSlug && data.length > 1) {
        // Match against date slug
        const { format } = await import('date-fns');
        const match = data.find(s => {
          const slug = format(new Date(s.created_at), "MMM-dd-yyyy").toLowerCase();
          return slug === params.dateSlug;
        });
        setResolvedSessionId(match ? match.id : data[0].id);
      } else {
        setResolvedSessionId(data[0].id);
      }
    };
    resolve();
  }, [params.sessionId, params.domain, params.dateSlug]);

  const sessionId = resolvedSessionId;
  // navigate already declared above
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [ga4Loading, setGa4Loading] = useState(false);
  const [gscLoading, setGscLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [sitemapHints, setSitemapHints] = useState<{ label: string; urls: string[] }[]>([]);
  const [allCollapsed, setAllCollapsed] = useState(false);
  // Prospect domain override for prospecting integrations
  const [prospectDomainInput, setProspectDomainInput] = useState('');
  const [prospectSettingsOpen, setProspectSettingsOpen] = useState(false);
  const [lookbackDays, setLookbackDays] = useState<number>(90);
  const prospectingDomain = session?.prospect_domain || session?.domain || '';
  const [chatProvider, setChatProviderRaw] = useState<ModelProvider>(() => {
    return (localStorage.getItem('chat-provider') as ModelProvider) || 'gemini';
  });
  const [chatModel, setChatModelRaw] = useState(() => {
    return localStorage.getItem('chat-model') || 'google/gemini-3.1-pro-preview';
  });
  const [chatReasoning, setChatReasoning] = useState<ReasoningEffort>(() => {
    const savedProvider = (localStorage.getItem('chat-provider') as ModelProvider) || 'gemini';
    return savedProvider === 'claude' ? 'high' : savedProvider === 'perplexity' ? 'none' : 'medium';
  });

  // Best (most powerful) model per provider
  const BEST_MODEL: Record<ModelProvider, string> = {
    gemini: 'google/gemini-3.1-pro-preview',
    claude: 'claude-opus',
    gpt: 'openai/gpt-5.2',
    perplexity: 'perplexity-sonar-reasoning-pro',
  };
  // Default reasoning per provider
  const DEFAULT_REASONING: Record<ModelProvider, ReasoningEffort> = {
    gemini: 'medium',
    claude: 'high', // extended thinking
    gpt: 'medium',
    perplexity: 'none',
  };

  const setChatProvider = (p: ModelProvider) => {
    setChatProviderRaw(p);
    localStorage.setItem('chat-provider', p);
    const bestId = BEST_MODEL[p] || VERSIONS[p]?.[VERSIONS[p].length - 1]?.id;
    if (bestId) {
      setChatModelRaw(bestId);
      localStorage.setItem('chat-model', bestId);
    }
    setChatReasoning(DEFAULT_REASONING[p] || 'none');
  };
  const setChatModel = (id: string) => {
    setChatModelRaw(id);
    localStorage.setItem('chat-model', id);
  };
  const [showAllIntegrations, setShowAllIntegrations] = useState(!isSharedView);
  // Pending prompt from Prompts tab → passed to chat
  const [pendingPrompt, setPendingPrompt] = useState<{ text: string; deepResearch: boolean } | null>(null);
  const ragIngestTriggeredRef = useRef(false);
  // Tab from URL path param or query string fallback
  const urlTab = params.tab;
  const activeTab = urlTab && TAB_SLUGS.includes(urlTab as any) ? tabSlugToValue(urlTab) : (searchParams.get('tab') || 'raw-data');
  const setActiveTab = useCallback((tab: string) => {
    if (session) {
      navigate(buildSitePath(session.domain, session.created_at, !!params.dateSlug, tab), { replace: true });
    } else {
      setSearchParams(prev => {
        prev.set('tab', tab);
        return prev;
      }, { replace: true });
    }
  }, [session, params.dateSlug, navigate, setSearchParams]);
  const [tabReady, setTabReady] = useState(true);
  const prevTabRef = useRef(activeTab);

  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      setTabReady(false);
      const t = requestAnimationFrame(() => {
        setTabReady(true);
      });
      return () => cancelAnimationFrame(t);
    }
  }, [activeTab]);
  const [rerunConfirmOpen, setRerunConfirmOpen] = useState(false);

  // Sticky tab bar on scroll-up
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [stickyTabVisible, setStickyTabVisible] = useState(false);
  const lastScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const scrollUpDistance = useRef(0);
  useEffect(() => {
    lastScrollY.current = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = lastScrollY.current - currentY;
      const tabBarTop = tabBarRef.current?.getBoundingClientRect().top ?? 0;
      const pastTabBar = tabBarTop < 0;

      if (delta > 0) {
        // Scrolling up — accumulate distance
        scrollUpDistance.current += delta;
      } else {
        // Scrolling down — reset and hide
        scrollUpDistance.current = 0;
        setStickyTabVisible(false);
      }

      // Only show after scrolling up at least 30px while past the tab bar
      if (!pastTabBar) {
        setStickyTabVisible(false);
      } else if (scrollUpDistance.current > 30) {
        setStickyTabVisible(true);
      }

      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const { isSectionCollapsed, toggleSection } = useSectionCollapse(sessionId);
  const navRef = useRef<NavStructureCardHandle>(null);
  const gmailRef = useRef<GmailCardHandle>(null);
  const [gmailState, setGmailState] = useState<{ canIngest: boolean; isIngesting: boolean; emailCount: number; isRefreshing: boolean; lastFetched: string | null; durationSec: number | null }>({ canIngest: false, isIngesting: false, emailCount: 0, isRefreshing: false, lastFetched: null, durationSec: null });
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
      recordView(sessionData.id, sessionData.domain, sessionData.created_at);
      if (sessionData.prospect_domain) setProspectDomainInput(sessionData.prospect_domain);
      if (sessionData.lookback_days != null) setLookbackDays(sessionData.lookback_days);
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
        ['ga4_data', setGa4Failed, 'ga4'],
        ['search_console_data', setGscFailed, 'search-console'],
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

  // Direct session state merge — avoids re-fetching the entire row from DB
  const updateSession = useCallback((partial: Partial<CrawlSession>) => {
    setSession(prev => prev ? { ...prev, ...partial } : prev);
  }, []);

  useEffect(() => {
    loadPausedIntegrations().catch(() => undefined).finally(() => {
      fetchData();
    });
  }, [fetchData]);

  // ── Analysis stop control ──
  const [analysisStopped, setAnalysisStopped] = useState(false);
  const analysisStoppedRef = useRef(false);

  const handleStopAnalysis = useCallback(() => {
    analysisStoppedRef.current = true;
    setAnalysisStopped(true);
    // Set all trigger refs to prevent any new effects from firing
    [builtwithTriggeredRef, semrushTriggeredRef, psiTriggeredRef, wappalyzerTriggeredRef,
     detectzestackTriggeredRef, gtmetrixTriggeredRef, carbonTriggeredRef, cruxTriggeredRef,
     waveTriggeredRef, observatoryTriggeredRef, httpstatusTriggeredRef, w3cTriggeredRef,
     schemaTriggeredRef, readableTriggeredRef, navTriggeredRef, sitemapTriggeredRef,
     contentTypesTriggeredRef, ga4TriggeredRef, gscTriggeredRef,
     oceanTriggeredRef, avomaTriggeredRef, hubspotTriggeredRef,
     yellowlabPollingRef, linkcheckRunningRef, formsAutoRunRef, autoTagTriedRef,
    ].forEach(ref => { ref.current = true; });
    // Abort link checker if running
    if (linkcheckAbortRef.current) linkcheckAbortRef.current.abort();
    toast.info('Analysis stopped — completed integrations are preserved.');
  }, []);

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
  const ga4TriggeredRef = useRef(false);
  const gscTriggeredRef = useRef(false);

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
        const saved = { grouped: result.grouped, totalCount: result.totalCount };
        await supabase.from('crawl_sessions').update({ builtwith_data: saved } as any).eq('id', session.id);
        clearError('builtwith');
        updateSession({ builtwith_data: saved } as any);
      } else {
        setBuiltwithFailed(true);
        const msg = result.error || 'BuiltWith API returned an error';
        setError('builtwith', msg);
        persistFailure('builtwith_data', msg);
      }
      setBuiltwithLoading(false);
    }).catch((e) => { const msg = e?.message || 'BuiltWith request failed'; setBuiltwithFailed(true); setError('builtwith', msg); persistFailure('builtwith_data', msg); setBuiltwithLoading(false); });
  }, [session, builtwithLoading, builtwithFailed, pauseVersion]);
  // SEMrush
  const [semrushFailed, setSemrushFailed] = useState(false);
  useEffect(() => {
    if (!session || session.semrush_data || semrushLoading || semrushFailed || isIntegrationPaused('semrush')) return;
    if (semrushTriggeredRef.current) return;
    semrushTriggeredRef.current = true;
    setSemrushLoading(true);
    semrushApi.domainOverview(session.domain).then(async (result) => {
      if (result.success) {
        const saved = { overview: result.overview, organicKeywords: result.organicKeywords, backlinks: result.backlinks };
        await supabase.from('crawl_sessions').update({ semrush_data: saved } as any).eq('id', session.id);
        clearError('semrush');
        updateSession({ semrush_data: saved } as any);
      } else {
        setSemrushFailed(true);
        const msg = result.error || 'SEMrush API returned an error';
        setError('semrush', msg);
        persistFailure('semrush_data', msg);
      }
      setSemrushLoading(false);
    }).catch((e) => { const msg = e?.message || 'SEMrush request failed'; setSemrushFailed(true); setError('semrush', msg); persistFailure('semrush_data', msg); setSemrushLoading(false); });
  }, [session, semrushLoading, semrushFailed, pauseVersion]);
  // PSI
  const [psiFailed, setPsiFailed] = useState(false);
  useEffect(() => {
    if (!session || session.psi_data || psiLoading || psiFailed || isIntegrationPaused('psi')) return;
    if (psiTriggeredRef.current) return;
    psiTriggeredRef.current = true;
    setPsiLoading(true);
    pagespeedApi.analyze(session.base_url).then(async (result) => {
      if (result.success) {
        const saved = { mobile: result.mobile, desktop: result.desktop };
        await supabase.from('crawl_sessions').update({ psi_data: saved } as any).eq('id', session.id);
        clearError('psi');
        updateSession({ psi_data: saved } as any);
      } else { const msg = result.error || 'PageSpeed Insights returned an error'; setPsiFailed(true); setError('psi', msg); persistFailure('psi_data', msg); }
      setPsiLoading(false);
    }).catch((e) => { const msg = e?.message || 'PageSpeed request failed'; setPsiFailed(true); setError('psi', msg); persistFailure('psi_data', msg); setPsiLoading(false); });
  }, [session, psiLoading, psiFailed, pauseVersion]);
  // Wappalyzer
  const [wappalyzerFailed, setWappalyzerFailed] = useState(false);
  useEffect(() => {
    if (!session || session.wappalyzer_data || wappalyzerLoading || wappalyzerFailed || isIntegrationPaused('wappalyzer')) return;
    if (wappalyzerTriggeredRef.current) return;
    wappalyzerTriggeredRef.current = true;
    setWappalyzerLoading(true);
    wappalyzerApi.lookup(session.base_url).then(async (result) => {
      if (result.success) {
        const saved = { grouped: result.grouped, totalCount: result.totalCount, social: result.social };
        await supabase.from('crawl_sessions').update({ wappalyzer_data: saved } as any).eq('id', session.id);
        clearError('wappalyzer');
        updateSession({ wappalyzer_data: saved } as any);
      } else { const msg = result.error || 'Wappalyzer returned an error'; setWappalyzerFailed(true); setError('wappalyzer', msg); persistFailure('wappalyzer_data', msg); }
      setWappalyzerLoading(false);
    }).catch((e) => { const msg = e?.message || 'Wappalyzer request failed'; setWappalyzerFailed(true); setError('wappalyzer', msg); persistFailure('wappalyzer_data', msg); setWappalyzerLoading(false); });
  }, [session, wappalyzerLoading, wappalyzerFailed, pauseVersion]);
  // DetectZeStack
  const [detectzestackFailed, setDetectzestackFailed] = useState(false);
  useEffect(() => {
    if (!session || (session as any).detectzestack_data || detectzestackLoading || detectzestackFailed || isIntegrationPaused('detectzestack')) return;
    if (detectzestackTriggeredRef.current) return;
    detectzestackTriggeredRef.current = true;
    setDetectzestackLoading(true);
    detectzestackApi.lookup(session.domain).then(async (result) => {
      if (result.success) {
        const saved = { grouped: result.grouped, totalCount: result.totalCount, scanDepth: result.scanDepth };
        await supabase.from('crawl_sessions').update({ detectzestack_data: saved } as any).eq('id', session.id);
        clearError('detectzestack');
        updateSession({ detectzestack_data: saved } as any);
      } else { const msg = result.error || 'DetectZeStack returned an error'; setDetectzestackFailed(true); setError('detectzestack', msg); persistFailure('detectzestack_data', msg); }
      setDetectzestackLoading(false);
    }).catch((e) => { const msg = e?.message || 'DetectZeStack request failed'; setDetectzestackFailed(true); setError('detectzestack', msg); persistFailure('detectzestack_data', msg); setDetectzestackLoading(false); });
  }, [session, detectzestackLoading, detectzestackFailed, pauseVersion]);
  // AI Tech Analysis — runs after at least one tech source has data
  const [techAnalysisData, setTechAnalysisData] = useState<any>(null);
  const [techAnalysisLoading, setTechAnalysisLoading] = useState(false);
  const [techAnalysisFailed, setTechAnalysisFailed] = useState(false);

  useEffect(() => {
    if (session?.tech_analysis_data && !isErrorSentinel(session.tech_analysis_data) && !techAnalysisData) {
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
        const msg = result.error || 'AI tech analysis failed';
        setError('tech-analysis', msg);
        persistFailure('tech_analysis_data', msg);
      }
      setTechAnalysisLoading(false);
    }).catch((e) => { const msg = e?.message || 'AI tech analysis failed'; setTechAnalysisFailed(true); setError('tech-analysis', msg); persistFailure('tech_analysis_data', msg); setTechAnalysisLoading(false); });
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
        updateSession({ gtmetrix_grade: result.grade, gtmetrix_scores: result.scores, gtmetrix_test_id: result.testId } as any);
      } else { const msg = result.error || 'GTmetrix returned an error'; setGtmetrixFailed(true); setError('gtmetrix', msg); persistFailure('gtmetrix_scores', msg); }
      setRunningGtmetrix(false);
    }).catch((e) => { const msg = e?.message || 'GTmetrix request failed'; setGtmetrixFailed(true); setError('gtmetrix', msg); persistFailure('gtmetrix_scores', msg); setRunningGtmetrix(false); });
  }, [session, runningGtmetrix, gtmetrixFailed, pauseVersion]);
  // Carbon
  const [carbonFailed, setCarbonFailed] = useState(false);
  useEffect(() => {
    if (!session || session.carbon_data || carbonLoading || carbonFailed || isIntegrationPaused('carbon')) return;
    if (carbonTriggeredRef.current) return;
    carbonTriggeredRef.current = true;
    setCarbonLoading(true);
    websiteCarbonApi.check(session.base_url).then(async (result) => {
      if (result.success) {
        const saved = { green: result.green, bytes: result.bytes, cleanerThan: result.cleanerThan, statistics: result.statistics, rating: result.rating };
        await supabase.from('crawl_sessions').update({ carbon_data: saved } as any).eq('id', session.id);
        clearError('carbon');
        updateSession({ carbon_data: saved } as any);
      } else { const msg = result.error || 'Website Carbon returned an error'; setCarbonFailed(true); setError('carbon', msg); persistFailure('carbon_data', msg); }
      setCarbonLoading(false);
    }).catch((e) => { const msg = e?.message || 'Website Carbon request failed'; setCarbonFailed(true); setError('carbon', msg); persistFailure('carbon_data', msg); setCarbonLoading(false); });
  }, [session, carbonLoading, carbonFailed, pauseVersion]);
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
        const saved = { overall: result.overall, phone: result.phone, desktop: result.desktop, collectionPeriod: result.collectionPeriod };
        await supabase.from('crawl_sessions').update({ crux_data: saved } as any).eq('id', session.id);
        clearError('crux');
        updateSession({ crux_data: saved } as any);
      } else if (result.noData) {
        setCruxNoData(true);
        persistFailure('crux_data', 'No CrUX data available for this site');
      } else { const msg = result.error || 'CrUX returned an error'; setCruxFailed(true); setError('crux', msg); persistFailure('crux_data', msg); }
      setCruxLoading(false);
    }).catch((e) => { const msg = e?.message || 'CrUX request failed'; setCruxFailed(true); setError('crux', msg); persistFailure('crux_data', msg); setCruxLoading(false); });
  }, [session, cruxLoading, cruxFailed, cruxNoData, pauseVersion]);
  // WAVE
  const [waveFailed, setWaveFailed] = useState(false);
  useEffect(() => {
    if (!session || session.wave_data || waveLoading || waveFailed || isIntegrationPaused('wave')) return;
    if (waveTriggeredRef.current) return;
    waveTriggeredRef.current = true;
    setWaveLoading(true);
    waveApi.scan(session.base_url).then(async (result) => {
      if (result.success) {
        const saved = { summary: result.summary, items: result.items, waveUrl: result.waveUrl, creditsRemaining: result.creditsRemaining, pageTitle: result.pageTitle };
        await supabase.from('crawl_sessions').update({ wave_data: saved } as any).eq('id', session.id);
        clearError('wave');
        updateSession({ wave_data: saved } as any);
      } else { const msg = result.error || 'WAVE returned an error'; setWaveFailed(true); setError('wave', msg); persistFailure('wave_data', msg); }
      setWaveLoading(false);
    }).catch((e) => { const msg = e?.message || 'WAVE request failed'; setWaveFailed(true); setError('wave', msg); persistFailure('wave_data', msg); setWaveLoading(false); });
  }, [session, waveLoading, waveFailed, pauseVersion]);
  // Mozilla Observatory
  const [observatoryFailed, setObservatoryFailed] = useState(false);
  useEffect(() => {
    if (!session || session.observatory_data || observatoryLoading || observatoryFailed || isIntegrationPaused('observatory')) return;
    if (observatoryTriggeredRef.current) return;
    observatoryTriggeredRef.current = true;
    setObservatoryLoading(true);
    observatoryApi.scan(session.domain).then(async (result) => {
      if (result.success) {
        const saved = { grade: result.grade, score: result.score, scannedAt: result.scannedAt, detailsUrl: result.detailsUrl, tests: result.tests, rawHeaders: result.rawHeaders || null, cspRaw: result.cspRaw || null, cspDirectives: result.cspDirectives || null, cookies: result.cookies || null };
        await supabase.from('crawl_sessions').update({ observatory_data: saved } as any).eq('id', session.id);
        clearError('observatory');
        updateSession({ observatory_data: saved } as any);
      } else { const msg = result.error || 'Observatory returned an error'; setObservatoryFailed(true); setError('observatory', msg); persistFailure('observatory_data', msg); }
      setObservatoryLoading(false);
    }).catch((e) => { const msg = e?.message || 'Observatory request failed'; setObservatoryFailed(true); setError('observatory', msg); persistFailure('observatory_data', msg); setObservatoryLoading(false); });
  }, [session, observatoryLoading, observatoryFailed, pauseVersion]);
  // Ocean.io
  const [oceanLoading, setOceanLoading] = useState(false);
  const [oceanFailed, setOceanFailed] = useState(false);
  const oceanTriggeredRef = useRef(false);
  useEffect(() => {
    if (!session || session.ocean_data || oceanLoading || oceanFailed || isIntegrationPaused('ocean')) return;
    if (oceanTriggeredRef.current) return;
    oceanTriggeredRef.current = true;
    setOceanLoading(true);
    oceanApi.enrich(prospectingDomain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ ocean_data: result } as any).eq('id', session.id);
        clearError('ocean');
        updateSession({ ocean_data: result } as any);
      } else { const msg = result.error || 'Ocean.io returned an error'; setOceanFailed(true); setError('ocean', msg); persistFailure('ocean_data', msg); }
      setOceanLoading(false);
    }).catch((e) => { const msg = e?.message || 'Ocean.io request failed'; setOceanFailed(true); setError('ocean', msg); persistFailure('ocean_data', msg); setOceanLoading(false); });
  }, [session, oceanLoading, oceanFailed, pauseVersion]);
  // Avoma
  const [avomaLoading, setAvomaLoading] = useState(false);
  const [avomaFailed, setAvomaFailed] = useState(false);
  const [avomaProgress, setAvomaProgress] = useState<{ page: number; meetingsScanned: number; totalMeetings: number; matchesFound: number; phase: string } | null>(null);
  const avomaTriggeredRef = useRef(false);
  useEffect(() => {
    if (!session || (session as any).avoma_data || avomaLoading || avomaFailed || isIntegrationPaused('avoma')) return;
    if (avomaTriggeredRef.current) return;
    avomaTriggeredRef.current = true;
    setAvomaLoading(true);
    setAvomaProgress(null);
    // Prefer Apollo contact email for Avoma search, fallback to domain
    const apolloEmail = session.apollo_data?.email;
    const searchDomain = apolloEmail
      ? apolloEmail.split('@').pop()?.toLowerCase() || prospectingDomain
      : prospectingDomain;
    avomaApi.lookupStreaming(searchDomain, lookbackDays, (progress) => {
      setAvomaProgress(progress);
    }).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ avoma_data: result } as any).eq('id', session.id);
        clearError('avoma');
        updateSession({ avoma_data: result } as any);
      } else { const msg = result.error || 'Avoma returned an error'; setAvomaFailed(true); setError('avoma', msg); persistFailure('avoma_data', msg); }
      setAvomaLoading(false);
      setAvomaProgress(null);
    }).catch((e) => { const msg = e?.message || 'Avoma request failed'; setAvomaFailed(true); setError('avoma', msg); persistFailure('avoma_data', msg); setAvomaLoading(false); setAvomaProgress(null); });
  }, [session, avomaLoading, avomaFailed, pauseVersion]);
  // HubSpot CRM lookup
  const [hubspotLoading, setHubspotLoading] = useState(false);
  const [hubspotFailed, setHubspotFailed] = useState(false);
  const hubspotTriggeredRef = useRef(false);
  useEffect(() => {
    if (!session || (session as any).hubspot_data || hubspotLoading || hubspotFailed || isIntegrationPaused('hubspot')) return;
    if (hubspotTriggeredRef.current) return;
    hubspotTriggeredRef.current = true;
    setHubspotLoading(true);
    hubspotApi.lookup(prospectingDomain).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ hubspot_data: result } as any).eq('id', session.id);
        clearError('hubspot');
        updateSession({ hubspot_data: result } as any);
      } else { const msg = result.error || 'HubSpot returned an error'; setHubspotFailed(true); setError('hubspot', msg); persistFailure('hubspot_data', msg); }
      setHubspotLoading(false);
    }).catch((e) => { const msg = e?.message || 'HubSpot request failed'; setHubspotFailed(true); setError('hubspot', msg); persistFailure('hubspot_data', msg); setHubspotLoading(false); });
  }, [session, hubspotLoading, hubspotFailed, pauseVersion]);
  // Apollo.io contact enrichment (manual search, persisted)
  const [apolloData, setApolloData] = useState<any>(session?.apollo_data || null);
  const [apolloLoading, setApolloLoading] = useState(false);
  const apolloAutoTriggered = useRef(false);

  // Apollo team search state
  const [apolloTeamData, setApolloTeamData] = useState<any>((session as any)?.apollo_team_data || null);
  const [apolloTeamLoading, setApolloTeamLoading] = useState(false);
  const apolloTeamAutoTriggered = useRef(false);

  // Sync apolloData from session when session loads/changes
  useEffect(() => {
    if (session?.apollo_data && !apolloData) {
      setApolloData(session.apollo_data);
    }
  }, [session?.apollo_data]);

  useEffect(() => {
    if ((session as any)?.apollo_team_data && !apolloTeamData) {
      setApolloTeamData((session as any).apollo_team_data);
    }
  }, [(session as any)?.apollo_team_data]);

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

  const handleApolloTeamSearch = async () => {
    const domain = prospectingDomain || apolloData?.organizationDomain || session?.domain;
    if (!domain) { toast.error('No domain available for team search'); return; }
    setApolloTeamLoading(true);
    try {
      const result = await apolloApi.teamSearch(domain);
      setApolloTeamData(result);
      if (result.success && session) {
        await supabase.from('crawl_sessions').update({ apollo_team_data: result } as any).eq('id', session.id);
      }
      if (!result.success) toast.error(result.error || 'Apollo team search failed');
      else if (result.totalFound > 0) toast.success(`Found ${result.totalFound} team contacts`);
    } catch (e: any) {
      toast.error(e?.message || 'Apollo team search failed');
    }
    setApolloTeamLoading(false);
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

  // Auto-trigger team search once Apollo enrichment completes with org domain
  useEffect(() => {
    if (apolloTeamAutoTriggered.current) return;
    if (apolloTeamLoading || apolloTeamData || (session as any)?.apollo_team_data) return;
    if (isIntegrationPaused('apollo')) return;
    const domain = apolloData?.organizationDomain || prospectingDomain;
    if (!domain || !apolloData?.found) return;
    apolloTeamAutoTriggered.current = true;
    console.log(`[apollo] Auto-searching team contacts at: ${domain}`);
    handleApolloTeamSearch();
  }, [apolloData, apolloTeamData, apolloTeamLoading, prospectingDomain, pauseVersion]);

  // Unique Templates rerun support
  const [templatesRerunning, setTemplatesRerunning] = useState(false);
  const templatesRerunFnRef = useRef<(() => void) | null>(null);

  // Forms rerun support
  const formsRerunFnRef = useRef<(() => void) | null>(null);

  const [ssllabsLoading, setSsllabsLoading] = useState(false);
  const [ssllabsFailed, setSsllabsFailed] = useState(false);
  const ssllabsPollingRef = useRef(false);

  const runSslLabsScan = useCallback(async () => {
    if (!session || ssllabsPollingRef.current) return;
    ssllabsPollingRef.current = true;
    setSsllabsLoading(true);
    setSsllabsFailed(false);
    clearError('ssllabs');

    try {
      const startResult = await ssllabsApi.start(session.domain);
      if (!startResult.success) {
        const msg = startResult.error || 'SSL Labs start failed';
        setSsllabsFailed(true);
        setError('ssllabs', msg);
        setSsllabsLoading(false);
        ssllabsPollingRef.current = false;
        return;
      }
      if (startResult.status === 'OVERLOADED') {
        setSsllabsFailed(true);
        setError('ssllabs', 'SSL Labs is at full capacity — try again later');
        setSsllabsLoading(false);
        ssllabsPollingRef.current = false;
        return;
      }
      if (startResult.status === 'READY') {
        await supabase.from('crawl_sessions').update({ ssllabs_data: startResult } as any).eq('id', session.id);
        clearError('ssllabs');
        updateSession({ ssllabs_data: startResult } as any);
        setSsllabsLoading(false);
        ssllabsPollingRef.current = false;
        return;
      }

      // Poll every 10s, up to 5 minutes
      const maxPolls = 30;
      let overloadedCount = 0;
      for (let i = 0; i < maxPolls; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const pollResult = await ssllabsApi.poll(session.domain);
        if (!pollResult.success) {
          const msg = pollResult.error || 'SSL Labs poll error';
          setSsllabsFailed(true);
          setError('ssllabs', msg);
          setSsllabsLoading(false);
          ssllabsPollingRef.current = false;
          return;
        }
        if (pollResult.status === 'READY') {
          await supabase.from('crawl_sessions').update({ ssllabs_data: pollResult } as any).eq('id', session.id);
          clearError('ssllabs');
          updateSession({ ssllabs_data: pollResult } as any);
          setSsllabsLoading(false);
          ssllabsPollingRef.current = false;
          return;
        }
        if (pollResult.status === 'ERROR') {
          const msg = 'SSL Labs assessment failed';
          setSsllabsFailed(true);
          setError('ssllabs', msg);
          setSsllabsLoading(false);
          ssllabsPollingRef.current = false;
          return;
        }
        if (pollResult.status === 'OVERLOADED') {
          overloadedCount++;
          if (overloadedCount >= 5) {
            setSsllabsFailed(true);
            setError('ssllabs', 'SSL Labs is at full capacity — try again later');
            setSsllabsLoading(false);
            ssllabsPollingRef.current = false;
            return;
          }
        }
      }
      const msg = 'SSL Labs scan timed out after 5 minutes — try again later';
      setSsllabsFailed(true);
      setError('ssllabs', msg);
      setSsllabsLoading(false);
      ssllabsPollingRef.current = false;
    } catch (e: any) {
      const msg = e?.message || 'SSL Labs request failed';
      setSsllabsFailed(true);
      setError('ssllabs', msg);
      setSsllabsLoading(false);
      ssllabsPollingRef.current = false;
    }
  }, [session]);

  // httpstatus.io
  const [httpstatusLoading, setHttpstatusLoading] = useState(false);
  const [httpstatusFailed, setHttpstatusFailed] = useState(false);
  useEffect(() => {
    if (!session || session.httpstatus_data || httpstatusLoading || httpstatusFailed || isIntegrationPaused('httpstatus')) return;
    if (httpstatusTriggeredRef.current) return;
    httpstatusTriggeredRef.current = true;
    setHttpstatusLoading(true);
    httpstatusApi.check(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ httpstatus_data: result } as any).eq('id', session.id);
        clearError('httpstatus');
        updateSession({ httpstatus_data: result } as any);
      } else { const msg = result.error || 'httpstatus.io returned an error'; setHttpstatusFailed(true); setError('httpstatus', msg); persistFailure('httpstatus_data', msg); }
      setHttpstatusLoading(false);
    }).catch((e) => { const msg = e?.message || 'httpstatus.io request failed'; setHttpstatusFailed(true); setError('httpstatus', msg); persistFailure('httpstatus_data', msg); setHttpstatusLoading(false); });
  }, [session, httpstatusLoading, httpstatusFailed, pauseVersion]);
  // W3C HTML/CSS Validation
  const [w3cLoading, setW3cLoading] = useState(false);
  const [w3cFailed, setW3cFailed] = useState(false);
  useEffect(() => {
    if (!session || session.w3c_data || w3cLoading || w3cFailed || isIntegrationPaused('w3c')) return;
    if (w3cTriggeredRef.current) return;
    w3cTriggeredRef.current = true;
    setW3cLoading(true);
    w3cApi.validate(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ w3c_data: result } as any).eq('id', session.id);
        clearError('w3c');
        updateSession({ w3c_data: result } as any);
      } else { const msg = result.error || 'W3C validation failed'; setW3cFailed(true); setError('w3c', msg); persistFailure('w3c_data', msg); }
      setW3cLoading(false);
    }).catch((e) => { const msg = e?.message || 'W3C validation request failed'; setW3cFailed(true); setError('w3c', msg); persistFailure('w3c_data', msg); setW3cLoading(false); });
  }, [session, w3cLoading, w3cFailed, pauseVersion]);
  // Schema.org / Rich Results
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaFailed, setSchemaFailed] = useState(false);
  useEffect(() => {
    if (!session || session.schema_data || schemaLoading || schemaFailed || isIntegrationPaused('schema')) return;
    if (schemaTriggeredRef.current) return;
    schemaTriggeredRef.current = true;
    setSchemaLoading(true);
    schemaApi.validate(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ schema_data: result } as any).eq('id', session.id);
        clearError('schema');
        updateSession({ schema_data: result } as any);
      } else { const msg = result.error || 'Schema validation failed'; setSchemaFailed(true); setError('schema', msg); persistFailure('schema_data', msg); }
      setSchemaLoading(false);
    }).catch((e) => { const msg = e?.message || 'Schema validation request failed'; setSchemaFailed(true); setError('schema', msg); persistFailure('schema_data', msg); setSchemaLoading(false); });
  }, [session, schemaLoading, schemaFailed, pauseVersion]);
  // Readable.com
  const [readableLoading, setReadableLoading] = useState(false);
  const [readableFailed, setReadableFailed] = useState(false);
  useEffect(() => {
    if (!session || (session as any).readable_data || readableLoading || readableFailed || isIntegrationPaused('readable')) return;
    if (readableTriggeredRef.current) return;
    readableTriggeredRef.current = true;
    setReadableLoading(true);
    readableApi.score(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ readable_data: result } as any).eq('id', session.id);
        clearError('readable');
        updateSession({ readable_data: result } as any);
      } else { const msg = result.error || 'Readable.com returned an error'; setReadableFailed(true); setError('readable', msg); persistFailure('readable_data', msg); }
      setReadableLoading(false);
    }).catch((e) => { const msg = e?.message || 'Readable.com request failed'; setReadableFailed(true); setError('readable', msg); persistFailure('readable_data', msg); setReadableLoading(false); });
  }, [session, readableLoading, readableFailed, pauseVersion]);
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
          const msg = startResult.error || 'Yellow Lab Tools start failed';
          setYellowlabFailed(true);
          setError('yellowlab', msg);
          persistFailure('yellowlab_data', msg);
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
            const msg = pollResult.error || 'Yellow Lab Tools poll error';
            setYellowlabFailed(true);
            setError('yellowlab', msg);
            persistFailure('yellowlab_data', msg);
            setYellowlabLoading(false);
            return;
          }
          if (pollResult.status === 'complete') {
            const saved = { globalScore: pollResult.globalScore, runId, categories: pollResult.categories };
            await supabase.from('crawl_sessions').update({ yellowlab_data: saved } as any).eq('id', session.id);
            clearError('yellowlab');
            updateSession({ yellowlab_data: saved } as any);
            setYellowlabLoading(false);
            return;
          }
          if (pollResult.status === 'failed') {
            const msg = (pollResult as any).error || 'Yellow Lab Tools could not analyze this page — the site may block automated testing';
            setYellowlabFailed(true);
            setError('yellowlab', msg);
            persistFailure('yellowlab_data', msg);
            setYellowlabLoading(false);
            return;
          }
        }
        const msg = 'Yellow Lab Tools timed out after 3 minutes';
        setYellowlabFailed(true);
        setError('yellowlab', msg);
        persistFailure('yellowlab_data', msg);
        setYellowlabLoading(false);
      } catch (e: any) {
        const msg = e?.message || 'Yellow Lab Tools request failed';
        setYellowlabFailed(true);
        setError('yellowlab', msg);
        persistFailure('yellowlab_data', msg);
        setYellowlabLoading(false);
      }
    })();
  }, [session, yellowlabLoading, yellowlabFailed, pauseVersion]);
  // Broken Link Checker
  const [linkcheckLoading, setLinkcheckLoading] = useState(false);
  const [linkcheckFailed, setLinkcheckFailed] = useState(false);
  const [linkcheckProgress, setLinkcheckProgress] = useState<{ checked: number; total: number } | null>(null);
  const [linkcheckStreamingResults, setLinkcheckStreamingResults] = useState<{ url: string; statusCode: number }[] | null>(null);
  const linkcheckRunningRef = useRef(false);
  const linkcheckAbortRef = useRef<AbortController | null>(null);
  const effectiveDiscoveredUrls = discoveredUrls.length > 0 ? discoveredUrls : (session?.discovered_urls || []);

  // Unified scoring system
  const overallScore = useMemo(() => computeOverallScore(session), [session]);
  const intGrade = (key: string) => {
    const s = getIntegrationScore(session, key);
    return s != null ? { integrationGrade: scoreToGrade(s) as any, integrationScore: s } : {};
  };
  const catGrade = (sectionId: string) => {
    const catKey = SECTION_TO_CATEGORY[sectionId];
    if (!catKey) return {};
    const cat = getCategoryScore(overallScore, catKey);
    return cat ? { grade: cat.grade, score: cat.score } : {};
  };

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
        updateSession({ linkcheck_data: result } as any);
      } else { const msg = result.error || 'Link checker returned an error'; setLinkcheckFailed(true); setError('link-checker', msg); persistFailure('linkcheck_data', msg); }
      setLinkcheckLoading(false);
      setLinkcheckProgress(null);
      linkcheckRunningRef.current = false;
      linkcheckAbortRef.current = null;
    }).catch((e) => { const msg = e?.message || 'Link checker request failed'; setLinkcheckFailed(true); setError('link-checker', msg); persistFailure('linkcheck_data', msg); setLinkcheckLoading(false); setLinkcheckProgress(null); linkcheckRunningRef.current = false; linkcheckAbortRef.current = null; });
  }, [session, linkcheckLoading, linkcheckFailed, effectiveDiscoveredUrls, pauseVersion]);
  // Nav Structure extraction
  const [navLoading, setNavLoading] = useState(false);
  const [navFailed, setNavFailed] = useState(false);
  useEffect(() => {
    if (!session || (session as any).nav_structure || navLoading || navFailed || isIntegrationPaused('nav-structure')) return;
    if (navTriggeredRef.current) return;
    navTriggeredRef.current = true;
    setNavLoading(true);
    navExtractApi.extract(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ nav_structure: result } as any).eq('id', session.id);
        clearError('nav-structure');
        updateSession({ nav_structure: result } as any);
      } else { const msg = result.error || 'Nav structure extraction failed'; setNavFailed(true); setError('nav-structure', msg); persistFailure('nav_structure', msg); }
      setNavLoading(false);
    }).catch((e) => { const msg = e?.message || 'Nav structure request failed'; setNavFailed(true); setError('nav-structure', msg); persistFailure('nav_structure', msg); setNavLoading(false); });
  }, [session, navLoading, navFailed, pauseVersion]);
  // XML Sitemap parsing (runs early — feeds URLs into URL discovery)
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [sitemapFailed, setSitemapFailed] = useState(false);
  useEffect(() => {
    if (!session || session.sitemap_data || sitemapLoading || sitemapFailed || isIntegrationPaused('sitemap')) return;
    if (sitemapTriggeredRef.current) return;
    sitemapTriggeredRef.current = true;
    setSitemapLoading(true);
    sitemapApi.parse(session.base_url).then(async (result) => {
      if (result.success) {
        await supabase.from('crawl_sessions').update({ sitemap_data: result } as any).eq('id', session.id);
        clearError('sitemap');
        // Feed sitemap hints upstream
        if (result.contentTypeHints?.length) {
          setSitemapHints(result.contentTypeHints);
        }
        updateSession({ sitemap_data: result } as any);
      } else { const msg = result.error || 'Sitemap parsing failed'; setSitemapFailed(true); setError('sitemap', msg); persistFailure('sitemap_data', msg); }
      setSitemapLoading(false);
    }).catch((e) => { const msg = e?.message || 'Sitemap parsing request failed'; setSitemapFailed(true); setError('sitemap', msg); persistFailure('sitemap_data', msg); setSitemapLoading(false); });
  }, [session, sitemapLoading, sitemapFailed, pauseVersion]);
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
        updateSession({ forms_data: result.data } as any);
        toast.success(`Found ${result.data.summary?.uniqueForms || 0} unique forms`);
      } else {
        setFormsFailed(true);
        const msg = result.error || 'Forms detection failed';
        setError('forms', msg);
        persistFailure('forms_data', msg);
      }
    } catch (e: any) {
      setFormsFailed(true);
      const msg = e?.message || 'Forms detection request failed';
      setError('forms', msg);
      persistFailure('forms_data', msg);
    } finally {
      setFormsLoading(false);
    }
  }, [session, formsLoading, effectiveDiscoveredUrls]);

  const formsAutoRunRef = useRef(false);

  const [contentTypesLoading, setContentTypesLoading] = useState(false);
  const [contentTypesFailed, setContentTypesFailed] = useState(false);
  const [contentTypesProgress, setContentTypesProgress] = useState('');
  useEffect(() => {
    if (!session || (session as any).content_types_data || contentTypesLoading || contentTypesFailed || isIntegrationPaused('content-types')) return;
    if (!effectiveDiscoveredUrls.length) return;
    if (contentTypesTriggeredRef.current) return;
    contentTypesTriggeredRef.current = true;
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
        updateSession({ content_types_data: result } as any);
      } else { const msg = result.error || 'Content type classification failed'; setContentTypesFailed(true); setError('content-types', msg); persistFailure('content_types_data', msg); }
      setContentTypesLoading(false);
      setContentTypesProgress('');
    }).catch((e) => { const msg = e?.message || 'Content type classification request failed'; setContentTypesFailed(true); setError('content-types', msg); persistFailure('content_types_data', msg); setContentTypesLoading(false); setContentTypesProgress(''); });
  }, [session, contentTypesLoading, contentTypesFailed, effectiveDiscoveredUrls, pauseVersion]);

  // GA4
  const [ga4Failed, setGa4Failed] = useState(false);
  useEffect(() => {
    if (!session || (session as any).ga4_data || ga4Loading || ga4Failed || isIntegrationPaused('ga4')) return;
    if (ga4TriggeredRef.current) return;
    ga4TriggeredRef.current = true;
    setGa4Loading(true);
    ga4Api.lookup(session.domain).then(async (result) => {
      if (result.success) {
        const saved = result.data || result;
        await supabase.from('crawl_sessions').update({ ga4_data: saved } as any).eq('id', session.id);
        clearError('ga4');
        updateSession({ ga4_data: saved } as any);
      } else {
        setGa4Failed(true);
        const msg = result.error || 'GA4 lookup failed';
        setError('ga4', msg);
        persistFailure('ga4_data', msg);
      }
      setGa4Loading(false);
    }).catch((e) => { const msg = e?.message || 'GA4 request failed'; setGa4Failed(true); setError('ga4', msg); persistFailure('ga4_data', msg); setGa4Loading(false); });
  }, [session, ga4Loading, ga4Failed, pauseVersion]);

  // Search Console
  const [gscFailed, setGscFailed] = useState(false);
  useEffect(() => {
    if (!session || (session as any).search_console_data || gscLoading || gscFailed || isIntegrationPaused('search-console')) return;
    if (gscTriggeredRef.current) return;
    gscTriggeredRef.current = true;
    setGscLoading(true);
    searchConsoleApi.lookup(session.domain).then(async (result) => {
      if (result.success) {
        const saved = result.data || result;
        await supabase.from('crawl_sessions').update({ search_console_data: saved } as any).eq('id', session.id);
        clearError('search-console');
        updateSession({ search_console_data: saved } as any);
      } else {
        setGscFailed(true);
        const msg = result.error || 'Search Console lookup failed';
        setError('search-console', msg);
        persistFailure('search_console_data', msg);
      }
      setGscLoading(false);
    }).catch((e) => { const msg = e?.message || 'Search Console request failed'; setGscFailed(true); setError('search-console', msg); persistFailure('search_console_data', msg); setGscLoading(false); });
  }, [session, gscLoading, gscFailed, pauseVersion]);
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
          updateSession({ page_tags: merged } as any);
        } else {
          // Fallback to pure pattern matching
          const ctData = (session as any).content_types_data;
          const classified = ctData?.classified || [];
          const seeded = autoSeedPageTags(null, effectiveDiscoveredUrls, classified, session.base_url);
          if (Object.keys(seeded).length > 0) {
            await supabase.from('crawl_sessions').update({ page_tags: seeded } as any).eq('id', session.id);
            updateSession({ page_tags: seeded } as any);
          }
        }
      } catch (e) {
        console.error('[auto-tag] AI tagging failed, using pattern fallback:', e);
        const ctData = (session as any).content_types_data;
        const classified = ctData?.classified || [];
        const seeded = autoSeedPageTags(null, effectiveDiscoveredUrls, classified, session.base_url);
        if (Object.keys(seeded).length > 0) {
          await supabase.from('crawl_sessions').update({ page_tags: seeded } as any).eq('id', session.id);
          updateSession({ page_tags: seeded } as any);
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
    updateSession({ page_tags: updated } as any);
  }, [session]);

  useEffect(() => {
    const pending = pages.filter(p => p.status === 'pending' && !processingPages.has(p.id));
    if (pending.length === 0) return;
    const processPage = async (page: CrawlPage) => {
      setProcessingPages(prev => new Set([...prev, page.id]));
      try {
        const scrapeResult = await firecrawlApi.scrape(page.url, { formats: ['markdown'] });
        const markdown = scrapeResult?.data?.markdown || (scrapeResult as any)?.markdown || '';
        const title = scrapeResult?.data?.metadata?.title || (scrapeResult as any)?.metadata?.title || page.url;

        await supabase.from('crawl_pages').update({
          raw_content: markdown || null,
          title,
          status: markdown ? 'scraped' : 'error',
        }).eq('id', page.id);

        // Update local pages state directly
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, raw_content: markdown || null, title, status: markdown ? 'scraped' : 'error' } : p));

        // Generate outline independently
        if (markdown) {
          try {
            const outlineResult = await aiApi.generateOutline(markdown, title, page.url);
            if (outlineResult.success && outlineResult.outline) {
              await supabase.from('crawl_pages').update({ ai_outline: outlineResult.outline }).eq('id', page.id);
              setPages(prev => prev.map(p => p.id === page.id ? { ...p, ai_outline: outlineResult.outline } : p));
            }
          } catch (e) { console.error('Outline generation failed for:', page.url, e); }
        }
      } catch (error) {
        console.error('Error processing page:', page.url, error);
        await supabase.from('crawl_pages').update({ status: 'error' }).eq('id', page.id);
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: 'error' } : p));
      }
    };
    pending.slice(0, 3).forEach(processPage);
  }, [pages, processingPages]);

  // Mark session complete
  useEffect(() => {
    if (!session || session.status !== 'crawling') return;
    const allDone = pages.length > 0 && pages.every(p => p.status !== 'pending');
    if (allDone) {
      supabase.from('crawl_sessions').update({ status: 'completed' }).eq('id', session.id).then(() => updateSession({ status: 'completed' } as any));
    }
  }, [pages, session]);

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
      apollo: () => { setApolloData(null); setApolloTeamData(null); setApolloLoading(false); apolloAutoTriggered.current = false; apolloTeamAutoTriggered.current = false; supabase.from('crawl_sessions').update({ apollo_team_data: null } as any).eq('id', session!.id).then(); },
      ssllabs: () => { setSsllabsFailed(false); setSsllabsLoading(false); ssllabsPollingRef.current = false; },
      httpstatus: () => { setHttpstatusFailed(false); setHttpstatusLoading(false); httpstatusTriggeredRef.current = false; },
      w3c: () => { setW3cFailed(false); setW3cLoading(false); w3cTriggeredRef.current = false; },
      schema: () => { setSchemaFailed(false); setSchemaLoading(false); schemaTriggeredRef.current = false; },
      readable: () => { setReadableFailed(false); setReadableLoading(false); readableTriggeredRef.current = false; },
      yellowlab: () => { setYellowlabFailed(false); setYellowlabLoading(false); yellowlabPollingRef.current = false; },
      'link-checker': () => { setLinkcheckFailed(false); setLinkcheckLoading(false); linkcheckRunningRef.current = false; },
      'nav-structure': () => { setNavFailed(false); setNavLoading(false); navTriggeredRef.current = false; },
      'content-types': () => { setContentTypesFailed(false); setContentTypesLoading(false); contentTypesTriggeredRef.current = false; },
      'sitemap': () => { setSitemapFailed(false); setSitemapLoading(false); sitemapTriggeredRef.current = false; },
      'templates': () => { setTemplatesRerunning(false); templatesRerunFnRef.current?.(); },
      'page-tags': () => { setAutoTagging(false); autoTagTriedRef.current = false; },
      'forms': () => {
        setFormsFailed(false); setFormsLoading(false); formsAutoRunRef.current = false;
        formsRerunFnRef.current?.();
        // Also clear forms_tiers
        supabase.from('crawl_sessions').update({ forms_tiers: null } as any).eq('id', session!.id).then();
      },
      'ga4': () => { setGa4Failed(false); setGa4Loading(false); ga4TriggeredRef.current = false; },
      'search-console': () => { setGscFailed(false); setGscLoading(false); gscTriggeredRef.current = false; },
    };
    resetMap[key]?.();
    // Refresh session so useEffect picks up null data
    updateSession({ [dbColumn]: null } as any);
  }, [session]);

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
    { key: 'ga4', dbColumn: 'ga4_data' },
    { key: 'search-console', dbColumn: 'search_console_data' },
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
    setBuiltwithFailed(false); setBuiltwithLoading(false); builtwithTriggeredRef.current = false;
    setSemrushFailed(false); setSemrushLoading(false); semrushTriggeredRef.current = false;
    setPsiFailed(false); setPsiLoading(false); psiTriggeredRef.current = false;
    setWappalyzerFailed(false); setWappalyzerLoading(false); wappalyzerTriggeredRef.current = false;
    setDetectzestackFailed(false); setDetectzestackLoading(false); detectzestackTriggeredRef.current = false;
    setGtmetrixFailed(false); setRunningGtmetrix(false); gtmetrixTriggeredRef.current = false;
    setCarbonFailed(false); setCarbonLoading(false); carbonTriggeredRef.current = false;
    setCruxFailed(false); setCruxNoData(false); setCruxLoading(false); cruxTriggeredRef.current = false;
    setWaveFailed(false); setWaveLoading(false); waveTriggeredRef.current = false;
    setObservatoryFailed(false); setObservatoryLoading(false); observatoryTriggeredRef.current = false;
    setOceanFailed(false); setOceanLoading(false); oceanTriggeredRef.current = false;
    setSsllabsFailed(false); setSsllabsLoading(false); ssllabsPollingRef.current = false;
    setHttpstatusFailed(false); setHttpstatusLoading(false); httpstatusTriggeredRef.current = false;
    setW3cFailed(false); setW3cLoading(false); w3cTriggeredRef.current = false;
    setSchemaFailed(false); setSchemaLoading(false); schemaTriggeredRef.current = false;
    setReadableFailed(false); setReadableLoading(false); readableTriggeredRef.current = false;
    setYellowlabFailed(false); setYellowlabLoading(false); yellowlabPollingRef.current = false;
    setLinkcheckFailed(false); setLinkcheckLoading(false); linkcheckRunningRef.current = false;
    setAvomaFailed(false); setAvomaLoading(false); avomaTriggeredRef.current = false;
    setHubspotFailed(false); setHubspotLoading(false); hubspotTriggeredRef.current = false;
    setNavFailed(false); setNavLoading(false); navTriggeredRef.current = false;
    setSitemapFailed(false); setSitemapLoading(false); sitemapTriggeredRef.current = false;
    setContentTypesFailed(false); setContentTypesLoading(false); contentTypesTriggeredRef.current = false;
    setTechAnalysisFailed(false); setTechAnalysisLoading(false); setTechAnalysisData(null);
    setGa4Failed(false); setGa4Loading(false); ga4TriggeredRef.current = false;
    setGscFailed(false); setGscLoading(false); gscTriggeredRef.current = false;
    formsAutoRunRef.current = false; autoTagTriedRef.current = false;
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
    gtmetrixTriggeredRef.current = false;
    updateSession({ gtmetrix_grade: null, gtmetrix_scores: null, gtmetrix_test_id: null } as any);
  }, [session]);

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
    apollo: apolloLoading,
    forms: formsLoading, templates: templatesRerunning,
    'tech-analysis': techAnalysisLoading, 'page-tags': autoTagging,
    ga4: ga4Loading, 'search-console': gscLoading,
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
    { key: 'ssllabs', label: 'SSL Labs', loading: ssllabsLoading, failed: ssllabsFailed, data: session.ssllabs_data, paused: isIntegrationPaused('ssllabs'), manual: true },
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
    { key: 'ga4', label: 'Google Analytics', loading: ga4Loading, failed: ga4Failed, data: (session as any).ga4_data, paused: isIntegrationPaused('ga4') },
    { key: 'search-console', label: 'Search Console', loading: gscLoading, failed: gscFailed, data: (session as any).search_console_data, paused: isIntegrationPaused('search-console') },
  ].map(s => ({
    key: s.key,
    label: s.label,
    status: s.paused ? 'paused' as const
      : s.data ? 'done' as const
      : s.failed ? 'failed' as const
      : s.loading ? 'loading' as const
      : (s as any).manual ? 'paused' as const
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
          onClick={async () => {
            setIntegrationDurations(d => { const next = { ...d }; delete next[key]; return next; });
            if (key === 'gtmetrix') { rerunGtmetrix(); }
            else if (key === 'ssllabs') {
              await supabase.from('crawl_sessions').update({ ssllabs_data: null } as any).eq('id', session!.id);
              ssllabsPollingRef.current = false;
              setSsllabsFailed(false);
              updateSession({ ssllabs_data: null } as any);
              runSslLabsScan();
            }
            else { rerunIntegration(key, dbColumn); }
          }}
          title="Run again"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    );
  };

  /** Build external report URL for an integration, if one exists */
  const getReportUrl = (key: string): string | undefined => {
    if (!session) return undefined;
    const domain = session.domain;
    const baseUrl = session.base_url;
    switch (key) {
      case 'gtmetrix': return session.gtmetrix_test_id ? `https://gtmetrix.com/reports/${session.gtmetrix_test_id}` : undefined;
      case 'builtwith': return domain ? `https://builtwith.com/${domain}` : undefined;
      case 'semrush': return domain ? `https://www.semrush.com/analytics/overview/?q=${domain}` : undefined;
      case 'psi': return baseUrl ? `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(baseUrl)}` : undefined;
      case 'crux': return baseUrl ? `https://lookerstudio.google.com/reporting/bbc5698d-57bb-4969-9e07-68810b889e09/page/keDQB?params=%7B%22origin%22:%22${encodeURIComponent(baseUrl)}%22%7D` : undefined;
      case 'wave': return session.wave_data?.waveUrl || (baseUrl ? `https://wave.webaim.org/report#/${encodeURIComponent(baseUrl)}` : undefined);
      case 'observatory': return domain ? `https://developer.mozilla.org/en-US/observatory/analyze?host=${domain}` : undefined;
      case 'ssllabs': return domain ? `https://www.ssllabs.com/ssltest/analyze.html?d=${domain}` : undefined;
      case 'yellowlab': return (session as any).yellowlab_data?.runId ? `https://yellowlab.tools/result/${(session as any).yellowlab_data.runId}` : undefined;
      case 'w3c': return baseUrl ? `https://validator.w3.org/nu/?doc=${encodeURIComponent(baseUrl)}` : undefined;
      case 'carbon': return domain ? `https://www.websitecarbon.com/website/${domain}/` : undefined;
      case 'wappalyzer': return domain ? `https://www.wappalyzer.com/lookup/${domain}/` : undefined;
      case 'schema': return baseUrl ? `https://search.google.com/test/rich-results?url=${encodeURIComponent(baseUrl)}` : undefined;
      case 'readable': return baseUrl ? `https://readable.com/text/?url=${encodeURIComponent(baseUrl)}` : undefined;
      default: return undefined;
    }
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
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, ai_outline: result.outline } : p));
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

  const tabTriggerStyle = (value: string) =>
    activeTab === value
      ? { borderBottomColor: 'transparent', marginBottom: '-1px', paddingBottom: 'calc(0.625rem + 1px)', borderBottom: 'none', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
      : undefined;
  const tabTriggerClass = "relative text-base font-medium px-5 py-2.5 rounded-t-md !rounded-b-none border-2 border-transparent bg-transparent text-muted-foreground transition-all !shadow-none !ring-0 data-[state=active]:border-foreground data-[state=active]:bg-background data-[state=active]:text-foreground";
  const showProspecting = shouldShowIntegration('avoma', !!(session as any)?.avoma_data, showAllIntegrations) || shouldShowIntegration('hubspot', !!(session as any)?.hubspot_data, showAllIntegrations) || shouldShowIntegration('ocean', !!session?.ocean_data, showAllIntegrations) || shouldShowIntegration('apollo', !!session?.apollo_data, showAllIntegrations);

  const tabTriggers = (
    <>
      <TabsTrigger value="raw-data" style={tabTriggerStyle('raw-data')} className={tabTriggerClass}>
        <Globe className="h-4 w-4 mr-2" />Site Analysis
      </TabsTrigger>
      {showProspecting && (
        <TabsTrigger value="prospecting" style={tabTriggerStyle('prospecting')} className={tabTriggerClass}>
          <UserPlus className="h-4 w-4 mr-2" />Prospecting
        </TabsTrigger>
      )}
      <TabsTrigger value="prompts" style={tabTriggerStyle('prompts')} className={tabTriggerClass}>
        <FileQuestion className="h-4 w-4 mr-2" />Prompts
      </TabsTrigger>
      <TabsTrigger value="knowledge" style={tabTriggerStyle('knowledge')} className={tabTriggerClass}>
        <BookOpen className="h-4 w-4 mr-2" />Knowledge
      </TabsTrigger>
      <TabsTrigger value="chat" style={tabTriggerStyle('chat')} className={tabTriggerClass}>
        <MessageCircle className="h-4 w-4 mr-2" />Chat
      </TabsTrigger>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Domain + crawl info — compact single row */}
      <div className="max-w-6xl mx-auto px-6 pt-5 pb-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-foreground leading-none">
            {session?.domain?.replace(/^www\./i, '')}
          </h1>
          {session?.created_at && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums shrink-0">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="font-semibold">Created:</span> {format(new Date(session.created_at), 'M/d/yyyy')}
              </span>
              {session?.updated_at && session.updated_at !== session.created_at && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  <span className="font-semibold">Updated:</span> {format(new Date(session.updated_at), 'M/d/yyyy')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global integration progress bar */}
      {session && !isSharedView && <GlobalProgressBar steps={integrationSteps} onStop={handleStopAnalysis} stopped={analysisStopped} />}

      <main className={`max-w-6xl mx-auto px-6 pt-2 pb-8 space-y-6 w-full`}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Sticky tab bar - shown when scrolling up and past the original */}
          <div
            className={`fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-foreground/10 shadow-sm transition-transform duration-300 ease-out ${stickyTabVisible ? 'translate-y-0' : '-translate-y-full'}`}
            style={{ pointerEvents: stickyTabVisible ? 'auto' : 'none' }}
          >
              <div className="max-w-6xl mx-auto px-6 pt-5">
                <div className="relative flex items-end">
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground z-0" />
                  <TabsList className="relative h-auto bg-transparent p-0 rounded-none mb-0 gap-0 z-10">
                    {tabTriggers}
                  </TabsList>
                </div>
              </div>
            </div>
          <div ref={tabBarRef} className="relative flex items-end justify-between">
            {/* Horizontal rule drawn BEHIND the tabs so active tab covers it */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground z-0" />
            <TabsList className="relative h-auto bg-transparent p-0 rounded-none mb-0 gap-0 z-10">
              {tabTriggers}
            </TabsList>

            {/* Unified actions dropdown */}
            <div className="flex items-center gap-2 pb-2 no-print">
              {activeTab === 'raw-data' && !isSharedView && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 px-2 text-muted-foreground">
                      Actions
                      <ChevronDown className="h-3.5 w-3.5" />
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
              {activeTab === 'prospecting' && !isSharedView && (
                <DropdownMenu open={prospectSettingsOpen} onOpenChange={setProspectSettingsOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-muted-foreground">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 p-3 space-y-3" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Company Domain</label>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const val = prospectDomainInput.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || null;
                        if (session) {
                          await supabase.from('crawl_sessions').update({ prospect_domain: val } as any).eq('id', session.id);
                          setSession({ ...session, prospect_domain: val });
                        }
                        if (val) toast.success(`Domain set to ${val}`);
                        else toast.success('Domain reset to site domain');
                      }}>
                        <div className="flex gap-1.5">
                          <Input
                            value={prospectDomainInput}
                            onChange={(e) => setProspectDomainInput(e.target.value)}
                            placeholder={session?.domain || 'company.com'}
                            className="h-8 text-xs flex-1"
                          />
                          <Button type="submit" size="sm" variant="outline" className="h-8 px-2.5 text-xs">Save</Button>
                        </div>
                      </form>
                      <p className="text-[10px] text-muted-foreground">Override domain for HubSpot, Gmail, Avoma, etc.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Lookback Period</label>
                      <select
                        value={lookbackDays}
                        onChange={async (e) => {
                          const val = parseInt(e.target.value, 10);
                          setLookbackDays(val);
                          if (session) {
                            await supabase.from('crawl_sessions').update({ lookback_days: val } as any).eq('id', session.id);
                            toast.success(`Lookback set to ${val === 0 ? 'all time' : `${val} days`}`);
                          }
                        }}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                        <option value={180}>Last 6 months</option>
                        <option value={365}>Last 1 year</option>
                        <option value={0}>All time</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground">Filters Gmail threads and Avoma calls by date</p>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {activeTab === 'prompts' && !isSharedView && session?.deep_research_data?.report && (
                <Button variant="outline" size="sm" onClick={() => downloadReportPdf(session.deep_research_data.report, 'Deep Research Report', session.domain)}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Deep Research PDF
                </Button>
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

          <TabsContent value="raw-data" className="mt-8 space-y-8" forceMount={activeTab === 'raw-data' ? true : undefined}>
            {activeTab === 'raw-data' && !tabReady ? <TabSkeleton variant="cards" /> : activeTab !== 'raw-data' ? null : <div className="animate-fade-in space-y-8">

        {/* Score Overview */}
        {overallScore && <ScoreOverview overallScore={overallScore} />}

        {/* ══════ 🔗 URL Analysis ══════ */}
        {(
          (session && shouldShowIntegration('sitemap', !!session.sitemap_data, showAllIntegrations, isSharedView)) ||
          (session && shouldShowIntegration('url-discovery', !!session.discovered_urls, showAllIntegrations, isSharedView)) ||
          shouldShowIntegration('httpstatus', !!session?.httpstatus_data, showAllIntegrations, isSharedView) ||
          shouldShowIntegration('link-checker', !!session?.linkcheck_data || effectiveDiscoveredUrls.length > 0, showAllIntegrations, isSharedView)
        ) && (
          <CollapsibleSection title="URL Analysis" collapsed={isSectionCollapsed("section-url-analysis") ?? false} onToggle={(c) => toggleSection("section-url-analysis", c)} {...catGrade("section-url-analysis")}>
            <SortedIntegrationList className="space-y-6">
              {session && shouldShowIntegration('sitemap', !!session.sitemap_data, showAllIntegrations, isSharedView) && (
                <SectionCard collapsed={allCollapsed} sectionId="sitemap" {...intGrade("sitemap")} persistedCollapsed={isSectionCollapsed("sitemap")} onCollapseChange={toggleSection} title="XML Sitemaps" icon={<MapIcon className="h-5 w-5 text-foreground" />} loading={sitemapLoading && !session.sitemap_data} loadingText="Parsing XML sitemaps..." error={sitemapFailed} errorText={integrationErrors.sitemap} headerExtra={<div className="flex items-center gap-1.5">{rerunButton('sitemap', 'sitemap_data', sitemapLoading)}{session.sitemap_data && innerExpandToggle(sitemapInnerExpand, setSitemapInnerExpand)}</div>} paused={isIntegrationPaused('sitemap') && !session.sitemap_data} onTogglePause={() => handleTogglePause('sitemap')}>
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
                    updateSession({ discovered_urls: urls, linkcheck_data: null } as any);
                  }}
                />
              )}

              {shouldShowIntegration('httpstatus', !!session?.httpstatus_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="httpstatus" {...intGrade("httpstatus")} persistedCollapsed={isSectionCollapsed("httpstatus")} onCollapseChange={toggleSection} title="httpstatus.io — Redirects & HTTP Status" icon={<Link className="h-5 w-5 text-foreground" />} loading={httpstatusLoading && !session?.httpstatus_data} loadingText="Checking HTTP redirect chain..." error={httpstatusFailed} errorText={integrationErrors.httpstatus} headerExtra={rerunButton('httpstatus', 'httpstatus_data', httpstatusLoading)} paused={isIntegrationPaused('httpstatus') && !session?.httpstatus_data} onTogglePause={() => handleTogglePause('httpstatus')}>
                {session?.httpstatus_data ? <HttpStatusCard data={session.httpstatus_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('link-checker', !!session?.linkcheck_data || effectiveDiscoveredUrls.length > 0, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="link-checker" {...intGrade("link-checker")} persistedCollapsed={isSectionCollapsed("link-checker")} onCollapseChange={toggleSection} title="Broken Link Checker" icon={<LinkIcon className="h-5 w-5 text-foreground" />} loading={linkcheckLoading && !session?.linkcheck_data} loadingText={linkcheckProgress ? `Checking URLs for broken links... ${linkcheckProgress.checked} of ${linkcheckProgress.total} checked` : `Checking ${effectiveDiscoveredUrls.length} URLs for broken links...`} error={linkcheckFailed} errorText={integrationErrors['link-checker']} headerExtra={rerunButton('link-checker', 'linkcheck_data', linkcheckLoading)} paused={isIntegrationPaused('link-checker') && !session?.linkcheck_data} onTogglePause={() => handleTogglePause('link-checker')}>
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
          <CollapsibleSection title="Content Analysis" collapsed={isSectionCollapsed("section-content-analysis") ?? false} onToggle={(c) => toggleSection("section-content-analysis", c)} {...catGrade("section-content-analysis")}>
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
                  updateSession({ content_types_data: updated } as any);
                }} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('nav-structure', !!(session as any)?.nav_structure, showAllIntegrations) && (
              <SectionCard collapsed={allCollapsed} sectionId="nav-structure" {...intGrade("nav-structure")} persistedCollapsed={isSectionCollapsed("nav-structure")} onCollapseChange={toggleSection} title="Site Navigation" icon={<Navigation className="h-5 w-5 text-foreground" />} loading={navLoading && !(session as any)?.nav_structure} loadingText="Extracting navigation structure from header..." error={navFailed} errorText={integrationErrors['nav-structure']} headerExtra={<div className="flex items-center gap-1.5">{!isSharedView && (session as any)?.nav_structure && <><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navRef.current?.copyMarkdown()} title="Copy as Markdown"><Copy className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navRef.current?.copyRichText()} title="Copy as Rich Text"><FileText className="h-3.5 w-3.5" /></Button></>}{rerunButton('nav-structure', 'nav_structure', navLoading)}{(session as any)?.nav_structure && innerExpandToggle(navInnerExpand, setNavInnerExpand)}</div>} paused={isIntegrationPaused('nav-structure') && !(session as any)?.nav_structure} onTogglePause={() => handleTogglePause('nav-structure')}>
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
              <SectionCard collapsed={allCollapsed} sectionId="readable" {...intGrade("readable")} persistedCollapsed={isSectionCollapsed("readable")} onCollapseChange={toggleSection} title="Readable.com — Readability Analysis" icon={<FileText className="h-5 w-5 text-foreground" />} loading={readableLoading && !(session as any)?.readable_data} loadingText="Scoring content readability..." error={readableFailed} errorText={integrationErrors.readable} headerExtra={rerunButton('readable', 'readable_data', readableLoading)} reportUrl={getReportUrl('readable')} paused={isIntegrationPaused('readable') && !(session as any)?.readable_data} onTogglePause={() => handleTogglePause('readable')}>
                {(session as any)?.readable_data ? <ReadableCard data={(session as any).readable_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('forms', !!(session as any)?.forms_data, showAllIntegrations) && (
              <SectionCard collapsed={allCollapsed} sectionId="forms" persistedCollapsed={isSectionCollapsed("forms")} onCollapseChange={toggleSection} title="Forms Analysis (Form Recommendations)" icon={<FileText className="h-5 w-5 text-foreground" />} loading={formsLoading && !(session as any)?.forms_data} loadingText="Scraping pages and detecting forms..." error={formsFailed} errorText={integrationErrors.forms} headerExtra={rerunButton('forms', 'forms_data', formsLoading)} paused={isIntegrationPaused('forms') && !(session as any)?.forms_data} onTogglePause={() => handleTogglePause('forms')}>
                {(session as any)?.forms_data ? (
                  <FormsCard data={(session as any).forms_data} domain={(session as any).domain} savedTiers={(session as any).forms_tiers} onTiersChange={async (tiers) => { await supabase.from('crawl_sessions').update({ forms_tiers: tiers } as any).eq('id', sessionId!); updateSession({ forms_tiers: tiers } as any); }} onRerunRequest={(fn) => { formsRerunFnRef.current = fn; }} />
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
                  <TemplatesCard pageTags={(session as any).page_tags} navStructure={(session as any).nav_structure} domain={(session as any).domain} savedTiers={(session as any).template_tiers} onTiersChange={async (tiers) => { await supabase.from('crawl_sessions').update({ template_tiers: tiers as any }).eq('id', sessionId!); updateSession({ template_tiers: tiers } as any); }} onRerunRequest={(fn) => { templatesRerunFnRef.current = fn; }} />
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
          <CollapsibleSection title="Technology Detection" collapsed={isSectionCollapsed("section-tech-detection") ?? false} onToggle={(c) => toggleSection("section-tech-detection", c)} {...catGrade("section-tech-detection")}>
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
                      updateSession({ tech_analysis_data: null } as any);
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
              <SectionCard collapsed={allCollapsed} sectionId="builtwith" persistedCollapsed={isSectionCollapsed("builtwith")} onCollapseChange={toggleSection} title="BuiltWith — Technology Stack" icon={<Code className="h-5 w-5 text-foreground" />} loading={builtwithLoading && !session?.builtwith_data} loadingText="Detecting technology stack..." error={builtwithFailed} errorText={integrationErrors.builtwith} headerExtra={rerunButton('builtwith', 'builtwith_data', builtwithLoading)} reportUrl={getReportUrl('builtwith')} paused={isIntegrationPaused('builtwith') && !session?.builtwith_data} onTogglePause={() => handleTogglePause('builtwith')}>
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
              <SectionCard collapsed={allCollapsed} sectionId="wappalyzer" persistedCollapsed={isSectionCollapsed("wappalyzer")} onCollapseChange={toggleSection} title="Wappalyzer — Technology Profiling" icon={<Layers className="h-5 w-5 text-foreground" />} loading={wappalyzerLoading && !session?.wappalyzer_data} loadingText="Running Wappalyzer detection..." error={wappalyzerFailed} errorText={integrationErrors.wappalyzer} headerExtra={rerunButton('wappalyzer', 'wappalyzer_data', wappalyzerLoading)} reportUrl={getReportUrl('wappalyzer')} paused={isIntegrationPaused('wappalyzer') && !session?.wappalyzer_data} onTogglePause={() => handleTogglePause('wappalyzer')}>
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
          <CollapsibleSection title="Performance & Sustainability" collapsed={isSectionCollapsed("section-performance") ?? false} onToggle={(c) => toggleSection("section-performance", c)} {...catGrade("section-performance")}>
            <SortedIntegrationList className="space-y-6">
              {shouldShowIntegration('gtmetrix', !!session?.gtmetrix_grade, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="gtmetrix" {...intGrade("gtmetrix")} persistedCollapsed={isSectionCollapsed("gtmetrix")} onCollapseChange={toggleSection} title="GTmetrix — Performance Audit" icon={<Zap className="h-5 w-5 text-foreground" />} loading={runningGtmetrix} loadingText="Running GTmetrix performance test..." error={gtmetrixFailed} errorText={integrationErrors.gtmetrix} headerExtra={rerunButton('gtmetrix', 'gtmetrix_grade', runningGtmetrix)} reportUrl={getReportUrl('gtmetrix')} paused={isIntegrationPaused('gtmetrix') && !session?.gtmetrix_grade} onTogglePause={() => handleTogglePause('gtmetrix')}>
                <GtmetrixCard grade={session?.gtmetrix_grade || null} scores={session?.gtmetrix_scores || null} testId={session?.gtmetrix_test_id || null} isRunning={false} />
              </SectionCard>
              )}

              {shouldShowIntegration('psi', !!session?.psi_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="psi" {...intGrade("psi-performance")} persistedCollapsed={isSectionCollapsed("psi")} onCollapseChange={toggleSection} title="PageSpeed Insights — Lighthouse" icon={<Gauge className="h-5 w-5 text-foreground" />} loading={psiLoading && !session?.psi_data} loadingText="Running PageSpeed Insights (mobile + desktop)..." error={psiFailed} errorText={integrationErrors.psi} headerExtra={rerunButton('psi', 'psi_data', psiLoading)} reportUrl={getReportUrl('psi')} paused={isIntegrationPaused('psi') && !session?.psi_data} onTogglePause={() => handleTogglePause('psi')}>
                {session?.psi_data ? <PageSpeedCard data={session.psi_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('crux', !!session?.crux_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="crux" {...intGrade("crux")} persistedCollapsed={isSectionCollapsed("crux")} onCollapseChange={toggleSection} title="CrUX — Real-User Field Data" icon={<Users className="h-5 w-5 text-foreground" />} loading={cruxLoading && !session?.crux_data} loadingText="Fetching Chrome UX Report field data..." error={cruxFailed} errorText={integrationErrors.crux} headerExtra={rerunButton('crux', 'crux_data', cruxLoading)} reportUrl={getReportUrl('crux')} paused={isIntegrationPaused('crux') && !session?.crux_data} onTogglePause={() => handleTogglePause('crux')}>
                {session?.crux_data ? (
                  <CruxCard data={session.crux_data} isLoading={false} />
                ) : null}
              </SectionCard>
              )}

              {shouldShowIntegration('yellowlab', !!(session as any)?.yellowlab_data, showAllIntegrations) && (
              <SectionCard collapsed={allCollapsed} sectionId="yellowlab" {...intGrade("yellowlab")} persistedCollapsed={isSectionCollapsed("yellowlab")} onCollapseChange={toggleSection} title="Yellow Lab Tools — Front-End Quality" icon={<Gauge className="h-5 w-5 text-foreground" />} loading={yellowlabLoading && !(session as any)?.yellowlab_data} loadingText="Running Yellow Lab Tools audit (this may take 1-2 minutes)..." error={yellowlabFailed} errorText={integrationErrors.yellowlab} headerExtra={rerunButton('yellowlab', 'yellowlab_data', yellowlabLoading)} reportUrl={getReportUrl('yellowlab')} paused={isIntegrationPaused('yellowlab') && !(session as any)?.yellowlab_data} onTogglePause={() => handleTogglePause('yellowlab')}>
                {(session as any)?.yellowlab_data ? <YellowLabCard data={(session as any).yellowlab_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('carbon', !!session?.carbon_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="carbon" {...intGrade("carbon")} persistedCollapsed={isSectionCollapsed("carbon")} onCollapseChange={toggleSection} title="Website Carbon — Sustainability" icon={<Leaf className="h-5 w-5 text-foreground" />} loading={carbonLoading && !session?.carbon_data} loadingText="Measuring carbon footprint..." error={carbonFailed} errorText={integrationErrors.carbon} headerExtra={rerunButton('carbon', 'carbon_data', carbonLoading)} reportUrl={getReportUrl('carbon')} paused={isIntegrationPaused('carbon') && !session?.carbon_data} onTogglePause={() => handleTogglePause('carbon')}>
                {session?.carbon_data ? <WebsiteCarbonCard data={session.carbon_data} isLoading={false} /> : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}

        {/* ══════ 🔍 SEO & Search ══════ */}
        {(shouldShowIntegration('semrush', !!session?.semrush_data, showAllIntegrations, isSharedView) || shouldShowIntegration('schema', !!session?.schema_data, showAllIntegrations, isSharedView) || shouldShowIntegration('ga4', !!(session as any)?.ga4_data, showAllIntegrations, isSharedView) || shouldShowIntegration('search-console', !!(session as any)?.search_console_data, showAllIntegrations, isSharedView)) && (
          <CollapsibleSection title="SEO & Search" collapsed={isSectionCollapsed("section-seo") ?? false} onToggle={(c) => toggleSection("section-seo", c)} {...catGrade("section-seo")}>
            <SortedIntegrationList className="space-y-6">
              {shouldShowIntegration('semrush', !!session?.semrush_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="semrush" {...intGrade("semrush")} persistedCollapsed={isSectionCollapsed("semrush")} onCollapseChange={toggleSection} title="SEMrush — Domain Analysis" icon={<Search className="h-5 w-5 text-foreground" />} loading={semrushLoading && !session?.semrush_data} loadingText="Pulling SEMrush data..." error={semrushFailed} errorText={integrationErrors.semrush} headerExtra={rerunButton('semrush', 'semrush_data', semrushLoading)} reportUrl={getReportUrl('semrush')} paused={isIntegrationPaused('semrush') && !session?.semrush_data} onTogglePause={() => handleTogglePause('semrush')}>
                {session?.semrush_data ? <SemrushCard data={session.semrush_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('search-console', !!(session as any)?.search_console_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="search-console" {...intGrade("search-console")} persistedCollapsed={isSectionCollapsed("search-console")} onCollapseChange={toggleSection} title="Google Search Console" icon={<Search className="h-5 w-5 text-foreground" />} loading={gscLoading && !(session as any)?.search_console_data} loadingText="Fetching Search Console data..." error={gscFailed} errorText={integrationErrors['search-console']} headerExtra={rerunButton('search-console', 'search_console_data', gscLoading)} paused={isIntegrationPaused('search-console') && !(session as any)?.search_console_data} onTogglePause={() => handleTogglePause('search-console')}>
                {(session as any)?.search_console_data ? <SearchConsoleCard data={(session as any).search_console_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('ga4', !!(session as any)?.ga4_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="ga4" persistedCollapsed={isSectionCollapsed("ga4")} onCollapseChange={toggleSection} title="Google Analytics (GA4)" icon={<BarChart3 className="h-5 w-5 text-foreground" />} loading={ga4Loading && !(session as any)?.ga4_data} loadingText="Fetching GA4 analytics data..." error={ga4Failed} errorText={integrationErrors.ga4} headerExtra={rerunButton('ga4', 'ga4_data', ga4Loading)} paused={isIntegrationPaused('ga4') && !(session as any)?.ga4_data} onTogglePause={() => handleTogglePause('ga4')}>
                {(session as any)?.ga4_data ? <GA4Card data={(session as any).ga4_data} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('schema', !!session?.schema_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="schema" {...intGrade("schema")} persistedCollapsed={isSectionCollapsed("schema")} onCollapseChange={toggleSection} title="Schema.org — Structured Data & Rich Results" icon={<FileText className="h-5 w-5 text-foreground" />} loading={schemaLoading && !session?.schema_data} loadingText="Analyzing structured data markup..." error={schemaFailed} errorText={integrationErrors.schema} headerExtra={rerunButton('schema', 'schema_data', schemaLoading)} reportUrl={getReportUrl('schema')} paused={isIntegrationPaused('schema') && !session?.schema_data} onTogglePause={() => handleTogglePause('schema')}>
                {session?.schema_data ? <SchemaCard data={session.schema_data} /> : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}

        {/* ══════ 🎨 UX & Accessibility ══════ */}
        {(shouldShowIntegration('psi-accessibility', !!session?.psi_data, showAllIntegrations, isSharedView) || shouldShowIntegration('wave', !!session?.wave_data, showAllIntegrations, isSharedView) || shouldShowIntegration('w3c', !!session?.w3c_data, showAllIntegrations, isSharedView)) && (
          <CollapsibleSection title="UX & Accessibility" collapsed={isSectionCollapsed("section-ux-accessibility") ?? false} onToggle={(c) => toggleSection("section-ux-accessibility", c)} {...catGrade("section-ux-accessibility")}>
            <SortedIntegrationList className="space-y-6">
              {shouldShowIntegration('psi-accessibility', !!session?.psi_data, showAllIntegrations, isSharedView) && shouldShowIntegration('psi', !!session?.psi_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="psi-accessibility" {...intGrade("psi-accessibility")} persistedCollapsed={isSectionCollapsed("psi-accessibility")} onCollapseChange={toggleSection} title="Lighthouse — Accessibility Audit" icon={<Accessibility className="h-5 w-5 text-foreground" />} loading={psiLoading && !session?.psi_data} loadingText="Extracting accessibility audits from Lighthouse..." paused={isIntegrationPaused('psi-accessibility') && !session?.psi_data} onTogglePause={() => handleTogglePause('psi-accessibility')}>
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
              <SectionCard collapsed={allCollapsed} sectionId="wave" {...intGrade("wave")} persistedCollapsed={isSectionCollapsed("wave")} onCollapseChange={toggleSection} title="WAVE — WCAG Accessibility Scan" icon={<Eye className="h-5 w-5 text-foreground" />} loading={waveLoading && !session?.wave_data} loadingText="Running WAVE accessibility scan..." error={waveFailed} errorText={integrationErrors.wave} headerExtra={rerunButton('wave', 'wave_data', waveLoading)} reportUrl={getReportUrl('wave')} paused={isIntegrationPaused('wave') && !session?.wave_data} onTogglePause={() => handleTogglePause('wave')}>
                {session?.wave_data ? <WaveCard data={session.wave_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('w3c', !!session?.w3c_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="w3c" {...intGrade("w3c")} persistedCollapsed={isSectionCollapsed("w3c")} onCollapseChange={toggleSection} title="W3C — HTML & CSS Validation" icon={<Code className="h-5 w-5 text-foreground" />} loading={w3cLoading && !session?.w3c_data} loadingText="Running W3C HTML & CSS validation..." error={w3cFailed} errorText={integrationErrors.w3c} headerExtra={rerunButton('w3c', 'w3c_data', w3cLoading)} reportUrl={getReportUrl('w3c')} paused={isIntegrationPaused('w3c') && !session?.w3c_data} onTogglePause={() => handleTogglePause('w3c')}>
                {session?.w3c_data ? <W3CCard data={session.w3c_data} /> : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}

        {/* ══════ 🛡️ Security & Compliance ══════ */}
        {(shouldShowIntegration('observatory', !!session?.observatory_data, showAllIntegrations, isSharedView) || shouldShowIntegration('ssllabs', !!session?.ssllabs_data, showAllIntegrations, isSharedView)) && (
          <CollapsibleSection title="Security & Compliance" collapsed={isSectionCollapsed("section-security") ?? false} onToggle={(c) => toggleSection("section-security", c)} {...catGrade("section-security")}>
            <SortedIntegrationList className="space-y-6">
              {shouldShowIntegration('observatory', !!session?.observatory_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="observatory" {...intGrade("observatory")} persistedCollapsed={isSectionCollapsed("observatory")} onCollapseChange={toggleSection} title="Mozilla Observatory — Security Headers" icon={<Shield className="h-5 w-5 text-foreground" />} loading={observatoryLoading && !session?.observatory_data} loadingText="Running Mozilla Observatory security scan..." error={observatoryFailed} errorText={integrationErrors.observatory} headerExtra={rerunButton('observatory', 'observatory_data', observatoryLoading)} reportUrl={getReportUrl('observatory')} paused={isIntegrationPaused('observatory') && !session?.observatory_data} onTogglePause={() => handleTogglePause('observatory')}>
                {session?.observatory_data ? <ObservatoryCard data={session.observatory_data} isLoading={false} /> : null}
              </SectionCard>
              )}

              {shouldShowIntegration('ssllabs', !!session?.ssllabs_data, showAllIntegrations, isSharedView) && (
              <SectionCard collapsed={allCollapsed} sectionId="ssllabs" {...intGrade("ssllabs")} persistedCollapsed={isSectionCollapsed("ssllabs")} onCollapseChange={toggleSection} title="SSL Labs — TLS/SSL Assessment" icon={<Lock className="h-5 w-5 text-foreground" />} loading={ssllabsLoading && !session?.ssllabs_data} loadingText="Running SSL Labs assessment (this may take 1-3 minutes)..." error={ssllabsFailed} errorText={integrationErrors.ssllabs} headerExtra={session?.ssllabs_data ? rerunButton('ssllabs', 'ssllabs_data', ssllabsLoading) : undefined} reportUrl={getReportUrl('ssllabs')} paused={isIntegrationPaused('ssllabs') && !session?.ssllabs_data} onTogglePause={() => handleTogglePause('ssllabs')}>
                {session?.ssllabs_data ? (
                  <SslLabsCard data={session.ssllabs_data} />
                ) : !ssllabsLoading && !ssllabsFailed ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-3">SSL Labs scans can take 1-3 minutes and are frequently at capacity. Run manually when needed.</p>
                    <Button size="sm" onClick={runSslLabsScan} disabled={ssllabsLoading}>
                      <Shield className="h-4 w-4 mr-1.5" />Run SSL Scan
                    </Button>
                  </div>
                ) : null}
              </SectionCard>
              )}
            </SortedIntegrationList>
          </CollapsibleSection>
        )}
            </div>}
          </TabsContent>

          <TabsContent value="prompts" className="mt-8 space-y-6" forceMount={activeTab === 'prompts' ? true : undefined}>
            {activeTab === 'prompts' && !tabReady ? <TabSkeleton variant="cards" /> : activeTab !== 'prompts' ? null : <div className="animate-fade-in space-y-6">
            {session && (
              <PromptLibrary
                domain={session.domain}
                companyName={session.ocean_data?.companyName || session.domain}
                onRunPrompt={(template: PromptTemplate) => {
                  const isDeepResearch = template.mode === 'deep-research' || template.mode === 'observations';
                  setPendingPrompt({ text: template.prompt, deepResearch: isDeepResearch });
                  setActiveTab('chat');
                }}
              />
            )}
            </div>}
          </TabsContent>

          {(shouldShowIntegration('avoma', !!(session as any)?.avoma_data, showAllIntegrations) || shouldShowIntegration('hubspot', !!(session as any)?.hubspot_data, showAllIntegrations) || shouldShowIntegration('ocean', !!session?.ocean_data, showAllIntegrations) || shouldShowIntegration('apollo', !!session?.apollo_data, showAllIntegrations)) && (
            <TabsContent value="prospecting" className="mt-8 space-y-6" forceMount={activeTab === 'prospecting' ? true : undefined}>
              {activeTab === 'prospecting' && !tabReady ? <TabSkeleton variant="cards" /> : activeTab !== 'prospecting' ? null : <div className="animate-fade-in space-y-6">
              {shouldShowIntegration('ocean', !!session?.ocean_data, showAllIntegrations) && (
                <SectionCard collapsed={allCollapsed} sectionId="ocean" persistedCollapsed={isSectionCollapsed("ocean")} onCollapseChange={toggleSection} title="Ocean.io — Firmographics" icon={<Building2 className="h-5 w-5 text-foreground" />} loading={oceanLoading && !session?.ocean_data} loadingText="Enriching company firmographics via Ocean.io..." error={oceanFailed} errorText={integrationErrors.ocean} headerExtra={rerunButton('ocean', 'ocean_data', oceanLoading)} paused={isIntegrationPaused('ocean') && !session?.ocean_data} onTogglePause={() => handleTogglePause('ocean')}>
                  {session?.ocean_data ? <OceanCard data={session.ocean_data} /> : null}
                </SectionCard>
              )}
              {shouldShowIntegration('apollo', !!session?.apollo_data, showAllIntegrations) && (
                <SectionCard collapsed={allCollapsed} sectionId="apollo" persistedCollapsed={isSectionCollapsed("apollo")} onCollapseChange={toggleSection} title="Apollo.io — Contact Enrichment" icon={<UserPlus className="h-5 w-5 text-foreground" />} headerExtra={rerunButton('apollo', 'apollo_data', apolloLoading)} paused={isIntegrationPaused('apollo') && !session?.apollo_data} onTogglePause={() => handleTogglePause('apollo')}>
                  <ApolloCard data={apolloData} isLoading={apolloLoading} onSearch={handleApolloSearch} teamData={apolloTeamData} teamLoading={apolloTeamLoading} onTeamSearch={handleApolloTeamSearch} prospectDomain={prospectingDomain} />
                </SectionCard>
              )}
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
              <SectionCard
                sectionId="gmail" persistedCollapsed={isSectionCollapsed("gmail")} onCollapseChange={toggleSection} title="Gmail — Email Threads"
                icon={<Mail className="h-5 w-5 text-foreground" />}
                collapsed={allCollapsed}
                headerExtra={
                  <div className="flex items-center gap-1.5">
                    {gmailState.canIngest && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        disabled={gmailState.isIngesting}
                        onClick={() => gmailRef.current?.ingestAllEmails()}
                      >
                        {gmailState.isIngesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                        Ingest All Emails
                      </Button>
                    )}
                    {gmailState.lastFetched && !gmailState.isRefreshing && (
                      <span className="text-[10px] text-muted-foreground tabular-nums" title={`Last run: ${format(new Date(gmailState.lastFetched), 'MMM d, yyyy h:mm a')}`}>
                        {format(new Date(gmailState.lastFetched), 'MMM d, h:mm a')}
                      </span>
                    )}
                    {gmailState.durationSec != null && !gmailState.isRefreshing && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">({gmailState.durationSec}s)</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={gmailState.isRefreshing}
                      onClick={() => gmailRef.current?.refreshEmails()}
                      title="Refresh emails"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${gmailState.isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                }
              >
                <GmailCard
                  sessionId={sessionId}
                  ref={gmailRef}
                  domain={prospectingDomain}
                  lookbackDays={lookbackDays}
                  onStateChange={setGmailState}
                  contactEmails={
                    (session as any)?.hubspot_data?.contacts
                      ?.map((c: any) => c.email?.toLowerCase())
                      .filter(Boolean) || []
                  }
                />
              </SectionCard>
              {shouldShowIntegration('avoma', !!(session as any)?.avoma_data, showAllIntegrations) && (
                <SectionCard
                  sectionId="avoma" persistedCollapsed={isSectionCollapsed("avoma")} onCollapseChange={toggleSection} title="Avoma — Call Intelligence"
                  icon={<Phone className="h-5 w-5 text-foreground" />}
                  loading={avomaLoading && !(session as any)?.avoma_data}
                  loadingText={avomaProgress
                    ? avomaProgress.phase === 'enriching'
                      ? `Found ${avomaProgress.matchesFound} meetings — loading transcripts & insights…`
                      : `Scanning page ${avomaProgress.page} · ${avomaProgress.meetingsScanned.toLocaleString()} of ${avomaProgress.totalMeetings.toLocaleString()} meetings checked · ${avomaProgress.matchesFound} match${avomaProgress.matchesFound !== 1 ? 'es' : ''} so far`
                    : 'Searching Avoma for meetings with @domain attendees...'}
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
                      setAvomaProgress(null);
                      try {
                        const result = await avomaApi.lookupStreaming(domain, lookbackDays, (progress) => {
                          setAvomaProgress(progress);
                        });
                        if (result.success) {
                          await supabase.from('crawl_sessions').update({ avoma_data: result } as any).eq('id', session!.id);
                          clearError('avoma');
                          updateSession({ avoma_data: result } as any);
                        } else {
                          setError('avoma', result.error || 'No results');
                          const noResultData = { ...result, domain, totalMatches: 0, meetings: [] };
                          await supabase.from('crawl_sessions').update({ avoma_data: noResultData } as any).eq('id', session!.id);
                          updateSession({ avoma_data: noResultData } as any);
                        }
                      } catch (e: any) {
                        setError('avoma', e?.message || 'Search failed');
                      }
                      setAvomaLoading(false);
                      setAvomaProgress(null);
                    }}
                    onExcludedChange={async (excludedUuids) => {
                      const current = (session as any).avoma_data;
                      if (!current) return;
                      const updated = { ...current, excludedMeetings: excludedUuids };
                      await supabase.from('crawl_sessions').update({ avoma_data: updated } as any).eq('id', session!.id);
                      updateSession({ avoma_data: updated } as any);
                    }}
                  /> : null}
                </SectionCard>
              )}
              </div>}
            </TabsContent>
          )}

          <TabsContent value="knowledge" className="mt-8" forceMount={activeTab === 'knowledge' ? true : undefined}>
            {activeTab === 'knowledge' && !tabReady ? <TabSkeleton variant="knowledge" /> : activeTab !== 'knowledge' ? null : <div className="animate-fade-in">
            {session && (
              <KnowledgeTabContent
                session={session}
                scrapedPages={scrapedPages}
              />
            )}
            </div>}
          </TabsContent>

          <TabsContent value="chat" className="mt-0" forceMount={activeTab === 'chat' ? true : undefined}>
            {activeTab === 'chat' && !tabReady ? <TabSkeleton variant="chat" /> : activeTab !== 'chat' ? null : <div className="animate-fade-in">
            {session && (
              <KnowledgeChatCard
                session={session}
                pages={scrapedPages}
                selectedModel={chatModel}
                provider={chatProvider}
                reasoning={chatReasoning}
                onProviderChange={setChatProvider}
                onModelChange={setChatModel}
                onReasoningChange={setChatReasoning}
                stickyTabVisible={stickyTabVisible}
                pendingPrompt={pendingPrompt}
                onPendingPromptConsumed={() => setPendingPrompt(null)}
              />
            )}
            </div>}
          </TabsContent>
        </Tabs>
      </main>

      {/* Back to top button */}
      <BackToTopButton />
    </div>
  );
}
