import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, X, Clock, Loader2, CreditCard } from 'lucide-react';
import { getPausedIntegrations, toggleIntegrationPause, loadPausedIntegrations } from '@/lib/integrationState';
import { supabase } from '@/integrations/supabase/client';

type Status = 'active' | 'coming-soon';
type HealthStatus = 'unknown' | 'checking' | 'ok' | 'down';
type HealthMap = Record<string, { ok: boolean; latencyMs: number; detail?: string }>;

type Integration = {
  name: string;
  id: string;
  description: string;
  secretKey: string;
  configured: boolean;
  category: 'architecture' | 'analysis' | 'technology' | 'performance' | 'seo' | 'content' | 'ux' | 'security' | 'intelligence' | 'enrichment';
  status: Status;
  hasCredits?: boolean;
};

const integrations: Integration[] = [
  // ── 🔗 URL Analysis ──
  { name: 'XML Sitemaps', id: 'sitemap', description: 'Parse and analyze XML sitemaps — discover all indexed URLs, nested sitemap structures, and lastmod dates', secretKey: '', configured: true, category: 'architecture', status: 'active' },
  { name: 'URL Discovery', id: 'url-discovery', description: 'Firecrawl-powered sitemap mapping — discovers all pages on a domain', secretKey: '', configured: true, category: 'architecture', status: 'active' },
  { name: 'httpstatus.io', id: 'httpstatus', description: 'HTTP redirect chain analysis — follow every hop, see status codes, latency, TLS validity, and page metadata', secretKey: 'HTTPSTATUS_API_KEY', configured: true, category: 'architecture', status: 'active' },
  { name: 'Broken Link Checker', id: 'link-checker', description: 'HEAD-request scan of all discovered URLs — flags broken links, redirects, and server errors. Free, no API key.', secretKey: '', configured: true, category: 'architecture', status: 'active' },

  // ── 📊 Content Analysis ──
  { name: 'Navigation Structure', id: 'nav-structure', description: 'AI-powered extraction of the primary header navigation — builds a hierarchical sitemap from the actual menu structure, not a full crawl', secretKey: '', configured: true, category: 'analysis', status: 'active' },
  { name: 'Content Types', id: 'content-types', description: 'Classifies all discovered URLs into content types (Blog, Product, Case Study, etc.) using URL patterns, Schema.org, meta tags, CSS classes, and AI', secretKey: '', configured: true, category: 'analysis', status: 'active' },
  
  { name: 'Content Scraping', id: 'content', description: 'Extract markdown content from all business-relevant pages', secretKey: '', configured: true, category: 'analysis', status: 'active' },
  { name: 'Readable.com', id: 'readable', description: 'Content readability scoring — Flesch-Kincaid, Gunning Fog, SMOG, Coleman-Liau, keyword density, and grade-level analysis', secretKey: 'READABLE_API_KEY', configured: true, category: 'analysis', status: 'active' },

  // ── 🎨 Design Analysis ──
  { name: 'Page Templates', id: 'auto-tag-pages', description: 'AI-powered template classification — assigns Custom, Template, or Toolkit badges to every URL based on industry-aware layout detection', secretKey: '', configured: true, category: 'content', status: 'active' },
  { name: 'Screenshots', id: 'screenshots', description: 'Capture full-page screenshots of key template pages (5–15 unique layouts)', secretKey: '', configured: true, category: 'content', status: 'active' },
  

  // ── 🔧 Technology Detection ──
  { name: 'BuiltWith', id: 'builtwith', description: 'Technology stack detection with historical data', secretKey: 'BUILTWITH_API_KEY', configured: true, category: 'technology', status: 'active', hasCredits: true },
  { name: 'Wappalyzer', id: 'wappalyzer', description: 'Real-time technology profiling with version detection', secretKey: 'WAPPALYZER_API_KEY', configured: true, category: 'technology', status: 'active' },

  // ── ⚡ Performance & Sustainability ──
  { name: 'GTmetrix', id: 'gtmetrix', description: 'Lighthouse performance audits and Web Vitals', secretKey: 'GTMETRIX_API_KEY', configured: true, category: 'performance', status: 'active' },
  { name: 'Google PageSpeed Insights', id: 'psi', description: 'Mobile & desktop Lighthouse scores and Core Web Vitals', secretKey: 'GOOGLE_PSI_API_KEY', configured: true, category: 'performance', status: 'active' },
  { name: 'Chrome UX Report (CrUX)', id: 'crux', description: 'Real-user field data — 28-day rolling Core Web Vitals from Chrome browsers', secretKey: 'GOOGLE_PSI_API_KEY', configured: true, category: 'performance', status: 'active' },
  { name: 'Yellow Lab Tools', id: 'yellowlab', description: 'Front-end quality audit — page weight, DOM complexity, JavaScript, CSS, fonts, and server config scoring. Free, no API key.', secretKey: '', configured: true, category: 'performance', status: 'active' },
  { name: 'Website Carbon API', id: 'carbon', description: 'CO₂ footprint per page load — free, no API key required', secretKey: '', configured: true, category: 'performance', status: 'active' },

  // ── 🔍 SEO & Search ──
  { name: 'SEMrush', id: 'semrush', description: 'Domain overview, organic keywords, and backlinks', secretKey: 'SEMRUSH_API_KEY', configured: true, category: 'seo', status: 'active' },
  { name: 'Schema.org Validator', id: 'schema', description: 'Structured data analysis (JSON-LD, Microdata, RDFa) — detects schema types, validates required fields, and checks Google rich results eligibility. Free, no API key.', secretKey: '', configured: true, category: 'seo', status: 'active' },
  { name: 'Ahrefs', id: 'ahrefs', description: 'Deep backlink profiles and internal link architecture analysis — see if a site\'s information architecture matches its business goals', secretKey: '', configured: false, category: 'seo', status: 'coming-soon' },

  // ── 🎨 UX & Accessibility ──
  { name: 'Lighthouse Accessibility', id: 'psi-accessibility', description: 'Accessibility score and pass/fail audits extracted from Lighthouse (uses existing PSI data)', secretKey: 'GOOGLE_PSI_API_KEY', configured: true, category: 'ux', status: 'active' },
  { name: 'WAVE (WebAIM)', id: 'wave', description: 'WCAG accessibility audit — errors, contrast issues, ARIA, and structural analysis', secretKey: 'WAVE_API_KEY', configured: true, category: 'ux', status: 'active' },
  { name: 'W3C Validator', id: 'w3c', description: 'HTML markup and CSS stylesheet validation against W3C web standards — errors, warnings, line numbers. Free, no API key needed.', secretKey: '', configured: true, category: 'ux', status: 'active' },
  { name: 'Applitools Eyes', id: 'applitools', description: 'Visual AI that critiques layout structure, detects visual gravity issues, and catches layout shifts that pass code checks but look wrong to humans', secretKey: '', configured: false, category: 'ux', status: 'coming-soon' },
  { name: 'Axe-core (Deque)', id: 'axe', description: 'Industry-standard WCAG accessibility audits with structured JSON reports and exact code-fix suggestions for every violation', secretKey: '', configured: false, category: 'ux', status: 'coming-soon' },

  // ── 🛡️ Security & Compliance ──
  { name: 'Mozilla Observatory', id: 'observatory', description: 'Security header analysis — CSP, HSTS, X-Frame-Options, and more. Free, no API key needed.', secretKey: '', configured: true, category: 'security', status: 'active' },
  { name: 'SSL Labs', id: 'ssllabs', description: 'Deep SSL/TLS assessment — certificate chain, protocol support, vulnerability scanning (Heartbleed, POODLE, etc.), and overall grade', secretKey: 'SSLLABS_EMAIL', configured: true, category: 'security', status: 'active' },
  { name: 'URLScan.io', id: 'urlscan', description: 'Sandbox every outbound request a site makes to expose 3rd-party tracker bloat and data leakage to questionable domains', secretKey: '', configured: false, category: 'security', status: 'coming-soon' },
  { name: 'URLScan.io', id: 'urlscan', description: 'Sandbox every outbound request a site makes to expose 3rd-party tracker bloat and data leakage to questionable domains', secretKey: '', configured: false, category: 'security', status: 'coming-soon' },

  // ── 📊 Competitive Intelligence ──
  { name: 'Observations & Insights', id: 'observations', description: 'AI-generated analysis of key findings — patterns, opportunities, and recommendations synthesized from all collected data', secretKey: '', configured: true, category: 'intelligence', status: 'active' },
  { name: 'Gemini Deep Research', id: 'deep-research', description: 'Autonomous multi-step research agent — competitive analysis, market research, and detailed reports powered by Gemini 3.1 Pro (~$2-5/task)', secretKey: 'GEMINI_API_KEY', configured: true, category: 'intelligence', status: 'active' },
  { name: 'Avoma', id: 'avoma', description: 'Call intelligence — match meetings and transcripts where attendee email matches the crawled domain', secretKey: 'AVOMA_API_KEY', configured: true, category: 'intelligence', status: 'active' },
  { name: 'Similarweb', id: 'similarweb', description: 'Estimated traffic volume, bounce rates, and referral sources — the reality check for keyword data', secretKey: '', configured: false, category: 'intelligence', status: 'coming-soon' },
  { name: 'Hunter.io', id: 'hunter', description: 'Find the people behind a site — technical leads, marketing managers — and build a persona of the team you\'re competing against', secretKey: '', configured: false, category: 'intelligence', status: 'coming-soon' },

  // ── 🧲 Enrichment & Prospecting ──
  { name: 'Ocean.io', id: 'ocean', description: 'Company firmographics — industry, size, revenue, technologies, and lookalike search', secretKey: 'OCEAN_IO_API_KEY', configured: true, category: 'enrichment', status: 'active' },
  { name: 'Apollo.io', id: 'apollo', description: 'Contact enrichment — LinkedIn profiles, job titles, phone numbers, employment history from 275M+ contacts', secretKey: 'APOLLO_API_KEY', configured: true, category: 'enrichment', status: 'active' },
  { name: 'Clay', id: 'clay', description: 'Waterfall enrichment across 150+ data providers with native AI that categorizes companies into specific niches, not just generic industries', secretKey: '', configured: false, category: 'enrichment', status: 'coming-soon' },
  { name: 'Crunchbase', id: 'crunchbase', description: 'Funding rounds, acquisitions, and leadership changes — companies that just raised a Series B are 10x more likely to need a site overhaul', secretKey: '', configured: false, category: 'enrichment', status: 'coming-soon' },
];


const categoryLabels: Record<string, string> = {
  architecture: '🔗 URL Analysis',
  analysis: '📊 Content Analysis',
  content: '🎨 Design Analysis',
  technology: '🔧 Technology Detection',
  performance: '⚡ Performance & Sustainability',
  seo: '🔍 SEO & Search',
  ux: '🎨 UX & Accessibility',
  security: '🛡️ Security & Compliance',
  intelligence: '📊 Competitive Intelligence',
  enrichment: '🧲 Enrichment & Prospecting',
};

const categoryOrder = ['architecture', 'analysis', 'content', 'technology', 'performance', 'seo', 'ux', 'security', 'intelligence', 'enrichment'];

type CreditInfo = { available?: string; used?: string; remaining?: string };

function CreditsDisplay({ integrationId }: { integrationId: string }) {
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = async () => {
    setLoading(true);
    setError(null);
    try {
      if (integrationId === 'builtwith') {
        const { data, error: fnError } = await supabase.functions.invoke('builtwith-lookup', {
          body: { action: 'whoami' },
        });
        if (fnError) throw fnError;
        if (data?.credits) {
          setCredits({
            available: String(data.credits.purchased ?? '?'),
            used: String(data.credits.used ?? '?'),
            remaining: String(data.credits.remaining ?? '?'),
          });
          if (data.account) setAccount(data.account);
        } else {
          setError('No credit info returned');
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch credits');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Checking credits...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
        <CreditCard className="h-3 w-3" />
        <span>Credits unavailable</span>
        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={fetchCredits}>Retry</Button>
      </div>
    );
  }

  if (!credits) return null;

  const remaining = credits.remaining ? parseInt(credits.remaining) : null;
  const available = credits.available ? parseInt(credits.available) : null;
  const pct = remaining != null && available != null && available > 0 ? (remaining / available) * 100 : null;

  return (
    <div className="mt-2 space-y-1.5">
      {account?.plan_type && (
        <div className="text-[10px] text-muted-foreground">
          Plan: <strong className="text-foreground">{account.plan_type}</strong>
          {account.plan_expiry && <> · Expires: {account.plan_expiry}</>}
        </div>
      )}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CreditCard className="h-3 w-3 shrink-0" />
        <span><strong className="text-foreground">{credits.remaining ?? '?'}</strong> / {credits.available ?? '?'} credits remaining</span>
        {credits.used && <span className="text-muted-foreground">({credits.used} used)</span>}
      </div>
      {pct != null && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct > 20 ? 'bg-primary' : pct > 5 ? 'bg-yellow-500' : 'bg-destructive'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const [pausedSet, setPausedSet] = useState(() => getPausedIntegrations());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  useEffect(() => {
    loadPausedIntegrations().then(setPausedSet);
  }, []);

  const handleToggle = async (id: string) => {
    await toggleIntegrationPause(id);
    setPausedSet(getPausedIntegrations());
  };

  const activeIntegrations = integrations.filter(i => i.status === 'active');
  const wishlistIntegrations = integrations.filter(i => i.status === 'coming-soon');

  const grouped = categoryOrder.map(cat => ({
    category: cat,
    label: categoryLabels[cat],
    items: activeIntegrations.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0);

  const activeCount = activeIntegrations.filter(i => !pausedSet.has(i.id)).length;
  const pausedCount = activeIntegrations.filter(i => pausedSet.has(i.id)).length;
  const allOn = pausedCount === 0;

  const handleToggleAll = async (turnOn: boolean) => {
    setBulkLoading(turnOn ? 'enable-all' : 'disable-all');
    try {
      const targets = activeIntegrations.filter(i => turnOn ? pausedSet.has(i.id) : !pausedSet.has(i.id));
      for (const t of targets) await toggleIntegrationPause(t.id);
      setPausedSet(getPausedIntegrations());
    } finally { setBulkLoading(null); }
  };

  const handleToggleCategory = async (items: Integration[], turnOn: boolean, category: string) => {
    setBulkLoading(category);
    try {
      const targets = items.filter(i => turnOn ? pausedSet.has(i.id) : !pausedSet.has(i.id));
      for (const t of targets) await toggleIntegrationPause(t.id);
      setPausedSet(getPausedIntegrations());
    } finally { setBulkLoading(null); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Integrations</h1>
            <p className="text-xs text-muted-foreground">
              {activeCount} active{pausedCount > 0 && <> · {pausedCount} paused</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleToggleAll(true)} disabled={allOn || !!bulkLoading} className="text-xs">
              {bulkLoading === 'enable-all' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Enable All
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleToggleAll(false)} disabled={pausedCount === activeIntegrations.length || !!bulkLoading} className="text-xs">
              {bulkLoading === 'disable-all' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Disable All
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {grouped.map(({ category, label, items }) => {
          const catActiveCount = items.filter(i => !pausedSet.has(i.id)).length;
          const catAllOn = catActiveCount === items.length;
          return (
          <div key={category}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">{label}</h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] h-6 px-2 text-muted-foreground"
                onClick={() => handleToggleCategory(items, !catAllOn, category)}
                disabled={!!bulkLoading}
              >
                {bulkLoading === category && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {catAllOn ? 'Disable section' : 'Enable section'}
              </Button>
            </div>
            <div className="space-y-0 divide-y divide-border rounded-lg border border-border overflow-hidden">
              {items.map((integration) => {
                const isPaused = pausedSet.has(integration.id);
                return (
                  <div key={integration.id} className="px-4 py-3 flex items-center justify-between gap-3 bg-card">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{integration.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
                      {integration.hasCredits && !isPaused && (
                        <CreditsDisplay integrationId={integration.id} />
                      )}
                    </div>
                    <Switch
                      checked={!isPaused}
                      onCheckedChange={() => handleToggle(integration.id)}
                      className={`shrink-0 ${!isPaused ? 'data-[state=checked]:bg-green-500' : 'data-[state=unchecked]:bg-red-400'}`}
                    />
                  </div>
                );
            </div>
          </div>
        )})}

        {/* Wishlist / Coming Soon */}
        {wishlistIntegrations.length > 0 && (
          <div className="mt-12 pt-8 border-t border-dashed border-border">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">Wishlist</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Integrations we're considering — reach out if you'd like to prioritize one.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {wishlistIntegrations.map((integration) => (
                <div key={integration.id} className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                  <p className="font-medium text-sm text-muted-foreground">{integration.name}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{integration.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
