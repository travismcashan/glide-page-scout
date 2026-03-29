import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Globe, Loader2, ArrowRight, Search, Clock,
  Gauge, Code, Shield, Leaf, Eye, Lock, Link2,
  FileText, BarChart3, Brain, Layers, Users,
  Navigation, Accessibility, Mail, ExternalLink,
  ChevronLeft, ChevronRight, Zap, ScanSearch,
  PieChart, Server, Paintbrush, GitCompare,
  Activity, Smartphone,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { buildSitePath } from '@/lib/sessionSlug';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import AppHeader from '@/components/AppHeader';
import { format } from 'date-fns';
import { getRecentViews, type RecentView } from '@/lib/recentViews';
import useEmblaCarousel from 'embla-carousel-react';
import { useIsMobile } from '@/hooks/use-mobile';

/* ── Integration showcase data ── */
const INTEGRATIONS = [
  { label: 'Uncover performance bottlenecks', icon: Gauge },
  { label: 'Detect every technology on a site', icon: Code },
  { label: 'Analyze domain authority & traffic', icon: BarChart3 },
  { label: 'Audit SSL & security headers', icon: Shield },
  { label: 'Check accessibility compliance', icon: Accessibility },
  { label: 'Measure environmental impact', icon: Leaf },
  { label: 'Validate markup & structured data', icon: FileText },
  { label: 'See real-user experience metrics', icon: Eye },
  { label: 'Enrich contacts & companies', icon: Users },
  { label: 'Map site navigation structure', icon: Navigation },
  { label: 'Deep-research with AI citations', icon: Brain },
  { label: 'Find broken links & redirects', icon: Link2 },
  { label: 'Search prior prospect emails', icon: Mail },
  { label: 'Check HTTP status & headers', icon: Globe },
  { label: 'Scan for security vulnerabilities', icon: Lock },
  { label: 'Classify content types with AI', icon: Layers },
  { label: 'Benchmark site speed over time', icon: Activity },
  { label: 'Audit mobile responsiveness', icon: Smartphone },
  { label: 'Analyze visual design quality', icon: Paintbrush },
  { label: 'Compare competitor tech stacks', icon: GitCompare },
  { label: 'Monitor server response times', icon: Server },
  { label: 'Track SEO ranking changes', icon: PieChart },
  { label: 'Test page load optimizations', icon: Zap },
  { label: 'Audit site search experience', icon: ScanSearch },
];

const ROTATING_PHRASES = [
  'Ready, set,',
  'What should we',
  'Pick a site,',
  'Go ahead and',
];

const ROTATING_WORDS = [
  'Research', 'Analyze', 'Prospect', 'Discover', 'Explore',
  'Investigate', 'Uncover', 'Decode', 'Benchmark', 'Evaluate',
  'Audit', 'Inspect', 'Optimize', 'Diagnose', 'Profile',
  'Dissect', 'Examine', 'Illuminate', 'Quantify', 'Validate',
  'Map', 'Score', 'Scan', 'Reveal', 'Compare',
  'Assess', 'Monitor', 'Track', 'Measure', 'Survey',
  'Detect', 'Classify', 'Extract', 'Enrich', 'Verify',
  'Catalog', 'Index', 'Rank', 'Grade', 'Review',
  'Probe', 'Navigate', 'Chart', 'Outline', 'Pinpoint',
  'Decipher', 'Interpret', 'Synthesize', 'Strategize', 'Prioritize',
];

const GREETINGS_BY_TIME: Record<string, string[]> = {
  morning: [
    'Good morning', 'Rise and shine', 'Morning',
    'Top of the morning', 'Bright and early', 'Hey there, early bird',
  ],
  afternoon: [
    'Good afternoon', 'Hey there', 'Afternoon',
    'Hope your day is going well', 'Back at it', 'Welcome back',
  ],
  evening: [
    'Good evening', 'Evening', 'Hey there',
    'Welcome back', 'Winding down', 'Back at it',
  ],
  latenight: [
    'Burning the midnight oil', 'Still going strong', 'Hey there, night owl',
    'Welcome back', 'Up late',
  ],
};

function getGreeting(): string {
  const hour = new Date().getHours();
  const bucket = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 22 ? 'evening' : 'latenight';
  const pool = GREETINGS_BY_TIME[bucket];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function CrawlPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [url, setUrl] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const phrase = useMemo(() => ROTATING_PHRASES[Math.floor(Math.random() * ROTATING_PHRASES.length)], []);
  const greeting = useMemo(() => getGreeting(), []);
  const shuffledIntegrations = useMemo(() => [...INTEGRATIONS].sort(() => Math.random() - 0.5), []);

  // Rotating word animation
  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(i => (i + 1) % ROTATING_WORDS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const isMobile = useIsMobile();
  const TILES_PER_PAGE = isMobile ? 4 : 4;
  const totalPages = Math.ceil(shuffledIntegrations.length / TILES_PER_PAGE);
  const [carouselPage, setCarouselPage] = useState(0);

  // Embla for mobile swipe
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'start' });

  const onEmblaSelect = useCallback(() => {
    if (!emblaApi) return;
    setCarouselPage(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onEmblaSelect);
    return () => { emblaApi.off('select', onEmblaSelect); };
  }, [emblaApi, onEmblaSelect]);

  // Sync desktop page changes to embla
  useEffect(() => {
    if (emblaApi && isMobile) {
      emblaApi.scrollTo(carouselPage);
    }
  }, [carouselPage, emblaApi, isMobile]);

  // Build pages of tiles
  const tilePages = useMemo(() => {
    const pages: typeof INTEGRATIONS[] = [];
    for (let i = 0; i < shuffledIntegrations.length; i += TILES_PER_PAGE) {
      pages.push(shuffledIntegrations.slice(i, i + TILES_PER_PAGE));
    }
    return pages;
  }, [shuffledIntegrations, TILES_PER_PAGE]);

  const visibleTiles = shuffledIntegrations.slice(
    carouselPage * TILES_PER_PAGE,
    carouselPage * TILES_PER_PAGE + TILES_PER_PAGE
  );

  // Load recently viewed from localStorage
  useEffect(() => {
    setRecentViews(getRecentViews().slice(0, 5));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsStarting(true);
    try {
      const formattedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
      const domain = new URL(formattedUrl).hostname;

      const { data: session, error } = await supabase
        .from('crawl_sessions')
        .insert({ domain, base_url: formattedUrl, status: 'analyzing' } as any)
        .select()
        .single();

      if (error) throw error;

      // Fire server-side orchestrator (fire-and-forget)
      supabase.functions.invoke('crawl-start', {
        body: { session_id: session.id },
      }).catch(err => console.error('crawl-start invoke error:', err));

      const { count } = await supabase
        .from('crawl_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('domain', domain);
      const needsTimestamp = (count ?? 0) > 1;
      navigate(buildSitePath(domain, session.created_at, needsTimestamp));
    } catch (error) {
      console.error(error);
      toast.error('Failed to start analysis');
      setIsStarting(false);
    }
  };

  const firstName = profile?.display_name?.split(' ')[0] || null;

  // Compute multiDomain map for recent views
  const multiDomains = useMemo(() => {
    const counts = new Map<string, number>();
    recentViews.forEach(s => counts.set(s.domain, (counts.get(s.domain) ?? 0) + 1));
    return counts;
  }, [recentViews]);

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Subtle ambient gradient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
      <AppHeader />

      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24">
        <div className="max-w-3xl w-full space-y-8 sm:space-y-12">
          {/* ── Greeting + rotating tagline ── */}
          <div className="space-y-[-0.15em]">
            <h1 className="text-2xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
              {firstName ? (
                <>{greeting}, {firstName}.</>
              ) : (
                <>{greeting}.</>
              )}
            </h1>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-0 text-2xl sm:text-5xl font-bold tracking-tight leading-none">
              <span className="leading-none text-foreground">{phrase}</span>
              <span className="relative inline-flex h-[1.35em] w-[5.5em] sm:w-[7em] items-end overflow-hidden align-baseline leading-none" style={{ background: 'transparent' }}>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={wordIndex}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -30, opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className="absolute left-0 bottom-0 leading-none font-medium"
                  >
                    <span
                      className="rainbow-text"
                      style={{ animationDelay: `${-(Math.random() * 8).toFixed(2)}s` }}
                    >
                      {ROTATING_WORDS[wordIndex]}.
                    </span>
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>
          </div>

          {/* ── Search bar ── */}
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 h-14 sm:h-[4.5rem] rounded-2xl bg-card border border-border/40 shadow-xl shadow-primary/[0.08] hover:shadow-2xl hover:shadow-primary/[0.12] hover:border-primary/25 transition-all duration-500">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter a URL…"
                  className="pl-9 sm:pl-12 h-full text-base sm:text-xl border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={isStarting}
                />
              </div>
              <Button
                type="submit"
                disabled={isStarting || !url.trim()}
                className="rounded-xl px-3 sm:px-6 gap-1.5 sm:gap-2 h-9 sm:h-11 text-sm sm:text-base shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all shrink-0"
              >
                {isStarting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">Analyzing…</span></>
                ) : (
                  <><span className="hidden sm:inline">Analyze</span><ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </form>

          {/* ── What can you do? ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                What Can You Do?
              </h2>
              {/* Desktop: arrow buttons */}
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground/60 tabular-nums mr-1">
                  {carouselPage + 1}/{totalPages}
                </span>
                <button
                  onClick={() => setCarouselPage(p => p - 1)}
                  disabled={carouselPage === 0}
                  className="h-7 w-7 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setCarouselPage(p => p + 1)}
                  disabled={carouselPage >= totalPages - 1}
                  className="h-7 w-7 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Mobile: swipeable carousel with dots */}
            <div className="sm:hidden">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex">
                  {tilePages.map((page, pageIdx) => (
                    <div key={pageIdx} className="flex-[0_0_100%] min-w-0">
                      <div className="grid grid-cols-2 gap-3">
                        {page.map((integration) => (
                          <div
                            key={integration.label}
                            className="aspect-square rounded-xl border border-border/50 bg-card p-4 flex flex-col justify-between pointer-events-none select-none"
                          >
                            <integration.icon className="h-8 w-8 text-primary/60" />
                            <span className="text-sm font-medium leading-snug text-foreground/80">
                              {integration.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Dot indicators */}
              <div className="flex justify-center gap-1.5 mt-4">
                {tilePages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => emblaApi?.scrollTo(idx)}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      idx === carouselPage
                        ? 'w-6 bg-primary'
                        : 'w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Desktop: animated grid */}
            <div className="hidden sm:block">
              <AnimatePresence mode="wait">
                <motion.div
                  key={carouselPage}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="grid grid-cols-4 gap-3"
                >
                  {visibleTiles.map((integration) => (
                    <div
                      key={integration.label}
                      className="aspect-square rounded-xl border border-border/50 bg-card p-4 flex flex-col justify-between pointer-events-none select-none"
                    >
                      <integration.icon className="h-12 w-12 text-primary/60" />
                      <span className="text-base font-medium leading-snug text-foreground/80">
                        {integration.label}
                      </span>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ── Recently viewed ── */}
          {recentViews.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recently Viewed
              </h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {recentViews.map((s) => (
                  <button
                    key={s.sessionId}
                    onClick={() => navigate(buildSitePath(s.domain, s.createdAt, (multiDomains.get(s.domain) ?? 0) > 1))}
                    className="w-full flex items-center justify-between gap-4 px-4 h-12 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Globe className="h-4 w-4 shrink-0 text-primary/60" />
                      <span className="text-sm font-medium truncate">{s.domain}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(s.createdAt), 'MMM d, yyyy')}
                      </span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="pb-6 text-center">
        <p className="text-xs text-muted-foreground/50">
          AI-generated results are based on available data and may not always be 100% accurate.
        </p>
      </footer>
    </div>
  );
}
