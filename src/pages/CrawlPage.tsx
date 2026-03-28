import { useState, useEffect, useMemo } from 'react';
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
import AppHeader from '@/components/AppHeader';
import { format } from 'date-fns';
import { getRecentViews, type RecentView } from '@/lib/recentViews';

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

export default function CrawlPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [url, setUrl] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [wordIndex, setWordIndex] = useState(0);

  // Rotating word animation
  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(i => (i + 1) % ROTATING_WORDS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  // Paginated carousel: 4 tiles per page
  const TILES_PER_PAGE = 4;
  const totalPages = Math.ceil(INTEGRATIONS.length / TILES_PER_PAGE);
  const [carouselPage, setCarouselPage] = useState(0);

  const visibleTiles = INTEGRATIONS.slice(
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
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      <main className="flex-1 flex flex-col items-center px-6 pt-16 pb-24">
        <div className="max-w-3xl w-full space-y-12">
          {/* ── Greeting + rotating tagline ── */}
          <div className="space-y-0">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
              {firstName ? (
                <>Hello, {firstName}.</>
              ) : (
                <>Hello.</>
              )}
            </h1>
            <div className="flex items-end gap-3 text-4xl sm:text-5xl font-bold tracking-tight leading-none text-muted-foreground">
              <span className="leading-none">Let's</span>
              <span className="relative inline-flex h-[1.35em] w-[5.5em] items-end overflow-hidden align-baseline leading-none">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={wordIndex}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -30, opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className="absolute left-0 bottom-0 leading-none text-primary font-medium"
                  >
                    {ROTATING_WORDS[wordIndex]}.
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>
          </div>

          {/* ── Search bar ── */}
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-card shadow-lg shadow-primary/5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter a URL to analyze…"
                  className="pl-10 h-11 text-base border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={isStarting}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={isStarting || !url.trim()}
                className="rounded-xl px-6 gap-2"
              >
                {isStarting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</>
                ) : (
                  <>Analyze<ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </form>

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
                    className="w-full flex items-center justify-between gap-4 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
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

          {/* ── What can you do? ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                What Can You Do?
              </h2>
              <div className="flex items-center gap-1.5">
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
                    className="group aspect-square rounded-xl border border-border bg-card p-4 flex flex-col justify-between transition-colors hover:border-primary/20 hover:bg-primary/[0.03]"
                  >
                    <integration.icon className="h-6 w-6 text-primary/70 group-hover:text-primary transition-colors" />
                    <span className="text-base font-medium leading-snug text-foreground/80">
                      {integration.label}
                    </span>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
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
