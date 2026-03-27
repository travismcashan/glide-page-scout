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
  { name: 'PageSpeed Insights', desc: 'Core Web Vitals and Lighthouse performance scores for mobile & desktop.', icon: Gauge },
  { name: 'BuiltWith', desc: 'Detect every technology, CMS, analytics tool, and framework on a site.', icon: Code },
  { name: 'SEMrush', desc: 'Domain authority, organic keywords, backlink profile, and traffic estimates.', icon: BarChart3 },
  { name: 'SSL Labs', desc: 'Full TLS/SSL certificate grading and security configuration audit.', icon: Lock },
  { name: 'WAVE', desc: 'Accessibility evaluation with WCAG compliance checking and error counts.', icon: Accessibility },
  { name: 'Observatory', desc: 'Mozilla security headers analysis — CSP, HSTS, X-Frame and more.', icon: Shield },
  { name: 'Website Carbon', desc: 'Estimate the carbon footprint and environmental impact of any webpage.', icon: Leaf },
  { name: 'W3C Validator', desc: 'HTML markup validation against W3C standards for clean, semantic code.', icon: FileText },
  { name: 'CrUX', desc: 'Real-user Chrome UX Report data — LCP, FID, CLS from actual visitors.', icon: Eye },
  { name: 'Apollo', desc: 'Enrich contacts with job titles, company size, funding, and email addresses.', icon: Users },
  { name: 'Nav Extractor', desc: 'Automatically map site navigation structure and information architecture.', icon: Navigation },
  { name: 'AI Research', desc: 'RAG-powered deep research across all crawl data with source citations.', icon: Brain },
  { name: 'Schema Validator', desc: 'Validate JSON-LD structured data and rich snippet eligibility.', icon: Layers },
  { name: 'Broken Links', desc: 'Crawl every internal and external link to find 404s and redirect chains.', icon: Link2 },
  { name: 'Gmail Lookup', desc: 'Search your inbox for prior conversations with the prospect domain.', icon: Mail },
  { name: 'HTTP Status', desc: 'Check response codes, redirects, and server headers for any URL.', icon: Globe },
];

const ROTATING_WORDS = ['Research', 'Analyze', 'Prospect', 'Chat', 'Discover'];

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

  // Pick 4 random integrations on mount
  const featuredIntegrations = useMemo(() => {
    const shuffled = [...INTEGRATIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  }, []);

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
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              {firstName ? (
                <>Hello, {firstName}.</>
              ) : (
                <>Hello.</>
              )}
            </h1>
            <div className="flex items-end gap-3 text-4xl sm:text-5xl font-bold tracking-tight leading-none text-muted-foreground">
              <span className="leading-none">Let's</span>
              <span className="relative inline-flex h-[1.15em] w-[5.5em] items-end overflow-hidden align-baseline leading-none">
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

          {/* ── Integration showcase cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {featuredIntegrations.map((integration) => (
              <div
                key={integration.name}
                className="group relative rounded-xl border border-border bg-card p-4 flex flex-col justify-between min-h-[140px] transition-colors hover:border-primary/20 hover:bg-primary/[0.02]"
              >
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 pr-1">
                  {integration.desc}
                </p>
                <div className="flex items-end justify-between mt-3">
                  <span className="text-[11px] font-semibold text-foreground/70 tracking-tight">
                    {integration.name}
                  </span>
                  <integration.icon className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/50 transition-colors" />
                </div>
              </div>
            ))}
          </div>

          {/* ── Search bar ── */}
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 p-2 rounded-2xl border border-border bg-card shadow-lg shadow-primary/5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter a URL to analyze…"
                  className="pl-10 h-12 text-base border-0 bg-transparent shadow-none focus-visible:ring-0"
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
                    className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
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
