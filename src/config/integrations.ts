/**
 * Integration Registry (frontend)
 *
 * Mirrors the canonical registry at supabase/functions/_shared/integration-registry.ts
 * Same data, minus server-only fields (fn, column).
 *
 * Used by: SectionCard (cost badges), ConnectionsPage (toggle list), HistoryPage (counts)
 */

export type IntegrationCost = 'free' | 'freemium' | 'paid';
export type IntegrationLane = 'audit' | 'intel' | 'knowledge' | 'premium';

export interface IntegrationMeta {
  key: string;
  label: string;
  batch: 1 | 2 | 3;
  cost: IntegrationCost;
  lane: IntegrationLane;
  auto: boolean;
  category: string;
  description: string;
}

export const INTEGRATION_REGISTRY: IntegrationMeta[] = [
  // ── Performance ──
  { key: 'psi', label: 'PageSpeed Insights', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Performance', description: 'Google Lighthouse audit for performance, SEO, accessibility, and best practices' },
  { key: 'gtmetrix', label: 'GTmetrix', batch: 1, cost: 'paid', lane: 'audit', auto: true, category: 'Performance', description: 'Comprehensive performance audit with Web Vitals and page speed metrics' },
  { key: 'crux', label: 'CrUX', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Performance', description: 'Real user performance data from Chrome browsers (Core Web Vitals)' },
  { key: 'yellowlab', label: 'Yellow Lab Tools', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Performance', description: 'Code-level quality analysis detecting bad practices and bloat' },
  { key: 'carbon', label: 'Website Carbon', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Performance', description: 'Environmental impact measurement — page weight and carbon emissions' },

  // ── SEO & Search ──
  { key: 'semrush', label: 'SEMrush', batch: 1, cost: 'paid', lane: 'audit', auto: true, category: 'SEO', description: 'Domain authority, organic traffic estimates, and keyword rankings' },
  { key: 'schema', label: 'Schema.org', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'SEO', description: 'Structured data validation for rich search results (JSON-LD, microdata)' },
  { key: 'sitemap', label: 'XML Sitemaps', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'SEO', description: 'XML sitemap analysis — URL coverage, structure, and content segmentation' },

  // ── Accessibility ──
  { key: 'wave', label: 'WAVE', batch: 1, cost: 'freemium', lane: 'audit', auto: true, category: 'Accessibility', description: 'Accessibility errors, contrast issues, and ARIA problems (WebAIM)' },
  { key: 'w3c', label: 'W3C Validation', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Accessibility', description: 'HTML and CSS validation against W3C web standards' },

  // ── Security ──
  { key: 'observatory', label: 'Mozilla Observatory', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Security', description: 'Security header analysis — HSTS, CSP, X-Frame-Options, and more (Mozilla)' },

  // ── Content & UX ──
  { key: 'nav-structure', label: 'Site Navigation', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Content & UX', description: 'Site navigation depth, breadth, hierarchy, and key page coverage' },
  { key: 'readable', label: 'Readability', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Content & UX', description: 'Content readability — Flesch score, grade level, and sentence complexity' },
  { key: 'content-types', label: 'Content Types', batch: 2, cost: 'free', lane: 'audit', auto: true, category: 'Content & UX', description: 'Content classification — pages, posts, custom types, and structure' },
  { key: 'forms', label: 'Forms Analysis', batch: 2, cost: 'free', lane: 'audit', auto: true, category: 'Content & UX', description: 'Form detection — types, platforms, captcha, and conversion readiness' },

  // ── URL Health ──
  { key: 'httpstatus', label: 'HTTP Status', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'URL Health', description: 'Homepage HTTP status, redirect chain, and response time (TTFB)' },
  { key: 'link-checker', label: 'Link Checker', batch: 2, cost: 'free', lane: 'audit', auto: true, category: 'URL Health', description: 'Site-wide link health — broken links, redirects, and server errors' },

  // ── Premium (manual/OAuth) ──
  { key: 'ssllabs', label: 'SSL Labs', batch: 1, cost: 'free', lane: 'premium', auto: false, category: 'Security', description: 'SSL/TLS certificate grade, protocol support, and cipher strength' },
  { key: 'ga4', label: 'Google Analytics (GA4)', batch: 1, cost: 'free', lane: 'premium', auto: false, category: 'SEO', description: 'User engagement metrics — bounce rate, session duration, and traffic sources' },
  { key: 'search-console', label: 'Google Search Console', batch: 1, cost: 'free', lane: 'premium', auto: false, category: 'SEO', description: 'Google Search performance — clicks, impressions, and indexing status' },

  // ── Technology Detection (intel) ──
  { key: 'builtwith', label: 'BuiltWith', batch: 1, cost: 'paid', lane: 'intel', auto: true, category: 'Technology', description: 'Technology stack detection — CMS, frameworks, analytics, and plugins' },
  { key: 'detectzestack', label: 'DetectZeStack', batch: 1, cost: 'freemium', lane: 'intel', auto: true, category: 'Technology', description: 'Alternative tech detection for JavaScript and CSS frameworks' },
  { key: 'tech-analysis', label: 'Tech Analysis', batch: 2, cost: 'free', lane: 'intel', auto: true, category: 'Technology', description: 'AI-synthesized technology analysis with platform assessment' },

  // ── Enrichment & Prospecting (intel) ──
  { key: 'apollo', label: 'Apollo', batch: 1, cost: 'paid', lane: 'intel', auto: true, category: 'Enrichment', description: 'Company contact data from Apollo.io' },
  { key: 'apollo-team', label: 'Apollo Team', batch: 3, cost: 'paid', lane: 'intel', auto: true, category: 'Enrichment', description: 'Team member discovery via Apollo.io' },
  { key: 'ocean', label: 'Ocean.io', batch: 1, cost: 'paid', lane: 'intel', auto: true, category: 'Enrichment', description: 'Company intelligence and firmographics from Ocean.io' },
  { key: 'hubspot', label: 'HubSpot', batch: 1, cost: 'free', lane: 'intel', auto: true, category: 'Enrichment', description: 'CRM data from HubSpot' },
  { key: 'avoma', label: 'Avoma', batch: 1, cost: 'free', lane: 'intel', auto: true, category: 'Intelligence', description: 'Meeting transcripts and notes from Avoma' },

  // ── Knowledge Capture ──
  { key: 'firecrawl-map', label: 'URL Discovery', batch: 1, cost: 'paid', lane: 'knowledge', auto: true, category: 'URL Analysis', description: 'Full site URL discovery via recursive crawling' },
  { key: 'page-tags', label: 'Page Tags', batch: 3, cost: 'free', lane: 'knowledge', auto: true, category: 'Design Analysis', description: 'AI-powered page classification by template type and content category' },
  { key: 'screenshots', label: 'Screenshots', batch: 1, cost: 'free', lane: 'knowledge', auto: false, category: 'Design Analysis', description: 'Visual capture of site pages for reference and analysis' },
  { key: 'content', label: 'Page Content', batch: 1, cost: 'free', lane: 'knowledge', auto: false, category: 'Content Analysis', description: 'Markdown extraction of individual page content' },
  { key: 'content-audit', label: 'Content Audit', batch: 1, cost: 'free', lane: 'knowledge', auto: true, category: 'Content Analysis', description: 'Template tier analysis and redesign scope estimation' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const _map = new Map(INTEGRATION_REGISTRY.map(i => [i.key, i]));

export function getIntegrationMeta(key: string): IntegrationMeta | undefined {
  return _map.get(key);
}

export function getIntegrationCost(key: string): IntegrationCost | undefined {
  return _map.get(key)?.cost;
}

export function getIntegrationDescription(key: string): string | undefined {
  return _map.get(key)?.description;
}

/** Total auto-running integrations (for progress / status resolution) */
export const AUTO_INTEGRATION_COUNT = INTEGRATION_REGISTRY.filter(i => i.auto).length;

/** Unique categories for ConnectionsPage grouping */
export const INTEGRATION_CATEGORIES = [...new Set(INTEGRATION_REGISTRY.map(i => i.category))];

// ── Crawl Profiles ───────────────────────────────────────────────────────────

export type CrawlProfile = 'free' | 'standard' | 'full' | 'custom';

export const CRAWL_PROFILES: { id: CrawlProfile; label: string; description: string }[] = [
  { id: 'free', label: 'Free Only', description: 'No paid API calls — 16+ integrations at zero cost' },
  { id: 'standard', label: 'Standard', description: 'Free + freemium APIs (WAVE, DetectZeStack)' },
  { id: 'full', label: 'Full', description: 'All integrations including paid APIs' },
  { id: 'custom', label: 'Custom', description: 'Choose individual integrations' },
];

export function getProfileIntegrations(profile: CrawlProfile): string[] {
  if (profile === 'full') return INTEGRATION_REGISTRY.filter(i => i.auto).map(i => i.key);
  if (profile === 'custom') return [];
  return INTEGRATION_REGISTRY
    .filter(i => {
      if (!i.auto) return false;
      if (profile === 'free') return i.cost === 'free';
      if (profile === 'standard') return i.cost === 'free' || i.cost === 'freemium';
      return true;
    })
    .map(i => i.key);
}

export function getSkippedIntegrations(profile: CrawlProfile): IntegrationMeta[] {
  if (profile === 'full' || profile === 'custom') return [];
  return INTEGRATION_REGISTRY.filter(i => {
    if (!i.auto) return false;
    if (profile === 'free') return i.cost !== 'free';
    if (profile === 'standard') return i.cost === 'paid';
    return false;
  });
}
