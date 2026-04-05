/**
 * SUPER CRAWL Integration Registry
 *
 * Central source of truth for all crawl integrations:
 * cost (free/freemium/paid), lane (audit/intel/knowledge/premium),
 * auto (runs in pipeline), and description.
 */

export type IntegrationCost = 'free' | 'freemium' | 'paid';
export type IntegrationLane = 'audit' | 'intel' | 'knowledge' | 'premium';

export type IntegrationMeta = {
  key: string;
  label: string;
  cost: IntegrationCost;
  lane: IntegrationLane;
  auto: boolean;
  description: string;
};

export const INTEGRATION_REGISTRY: IntegrationMeta[] = [
  // ── Lane 1: Site Audit (auto, scoring) ──────────────────────

  // Performance
  { key: 'psi', label: 'PageSpeed Insights', cost: 'free', lane: 'audit', auto: true,
    description: 'Google Lighthouse audit for performance, SEO, accessibility, and best practices' },
  { key: 'gtmetrix', label: 'GTmetrix', cost: 'paid', lane: 'audit', auto: true,
    description: 'Comprehensive performance audit with Web Vitals and page speed metrics' },
  { key: 'crux', label: 'CrUX', cost: 'free', lane: 'audit', auto: true,
    description: 'Real user performance data from Chrome browsers (Core Web Vitals)' },
  { key: 'yellowlab', label: 'Yellow Lab Tools', cost: 'free', lane: 'audit', auto: true,
    description: 'Code-level quality analysis detecting bad practices and bloat' },
  { key: 'carbon', label: 'Website Carbon', cost: 'free', lane: 'audit', auto: true,
    description: 'Environmental impact measurement — page weight and carbon emissions' },

  // SEO & Search
  { key: 'semrush', label: 'SEMrush', cost: 'paid', lane: 'audit', auto: true,
    description: 'Domain authority, organic traffic estimates, and keyword rankings' },
  { key: 'schema', label: 'Schema.org', cost: 'free', lane: 'audit', auto: true,
    description: 'Structured data validation for rich search results (JSON-LD, microdata)' },
  { key: 'sitemap', label: 'XML Sitemaps', cost: 'free', lane: 'audit', auto: true,
    description: 'XML sitemap analysis — URL coverage, structure, and content segmentation' },

  // Accessibility
  { key: 'wave', label: 'WAVE', cost: 'freemium', lane: 'audit', auto: true,
    description: 'Accessibility errors, contrast issues, and ARIA problems (WebAIM)' },
  { key: 'w3c', label: 'W3C Validation', cost: 'free', lane: 'audit', auto: true,
    description: 'HTML and CSS validation against W3C web standards' },

  // Security
  { key: 'observatory', label: 'Mozilla Observatory', cost: 'free', lane: 'audit', auto: true,
    description: 'Security header analysis — HSTS, CSP, X-Frame-Options, and more (Mozilla)' },

  // Content & UX
  { key: 'nav-structure', label: 'Site Navigation', cost: 'free', lane: 'audit', auto: true,
    description: 'Site navigation depth, breadth, hierarchy, and key page coverage' },
  { key: 'readable', label: 'Readability', cost: 'free', lane: 'audit', auto: true,
    description: 'Content readability — Flesch score, grade level, and sentence complexity' },
  { key: 'content-types', label: 'Content Types', cost: 'free', lane: 'audit', auto: true,
    description: 'Content classification — pages, posts, custom types, and structure' },
  { key: 'forms', label: 'Forms Analysis', cost: 'free', lane: 'audit', auto: true,
    description: 'Form detection — types, platforms, captcha, and conversion readiness' },

  // URL Health
  { key: 'httpstatus', label: 'HTTP Status', cost: 'free', lane: 'audit', auto: true,
    description: 'Homepage HTTP status, redirect chain, and response time (TTFB)' },
  { key: 'link-checker', label: 'Link Checker', cost: 'free', lane: 'audit', auto: true,
    description: 'Site-wide link health — broken links, redirects, and server errors' },

  // ── Lane 1 Premium (manual/OAuth, still scores) ─────────────

  { key: 'ssllabs', label: 'SSL Labs', cost: 'free', lane: 'premium', auto: false,
    description: 'SSL/TLS certificate grade, protocol support, and cipher strength' },
  { key: 'ga4', label: 'Google Analytics (GA4)', cost: 'free', lane: 'premium', auto: false,
    description: 'User engagement metrics — bounce rate, session duration, and traffic sources' },
  { key: 'search-console', label: 'Google Search Console', cost: 'free', lane: 'premium', auto: false,
    description: 'Google Search performance — clicks, impressions, and indexing status' },

  // ── Lane 2: Strategic Intel (unscored) ──────────────────────

  { key: 'builtwith', label: 'BuiltWith', cost: 'paid', lane: 'intel', auto: true,
    description: 'Technology stack detection — CMS, frameworks, analytics, and plugins' },
  { key: 'detectzestack', label: 'DetectZeStack', cost: 'freemium', lane: 'intel', auto: true,
    description: 'Alternative tech detection for JavaScript and CSS frameworks' },
  { key: 'tech-analysis', label: 'Tech Analysis', cost: 'free', lane: 'intel', auto: true,
    description: 'AI-synthesized technology analysis with platform assessment' },
  { key: 'apollo', label: 'Apollo', cost: 'paid', lane: 'intel', auto: true,
    description: 'Company contact data from Apollo.io' },
  { key: 'apollo-team', label: 'Apollo Team', cost: 'paid', lane: 'intel', auto: true,
    description: 'Team member discovery via Apollo.io' },
  { key: 'ocean', label: 'Ocean.io', cost: 'paid', lane: 'intel', auto: true,
    description: 'Company intelligence and firmographics from Ocean.io' },
  { key: 'hubspot', label: 'HubSpot', cost: 'free', lane: 'intel', auto: true,
    description: 'CRM data from HubSpot' },
  { key: 'avoma', label: 'Avoma', cost: 'free', lane: 'intel', auto: true,
    description: 'Meeting transcripts and notes from Avoma' },

  // ── Lane 3: Knowledge Capture (unscored) ────────────────────

  { key: 'firecrawl-map', label: 'URL Discovery', cost: 'paid', lane: 'knowledge', auto: true,
    description: 'Full site URL discovery via recursive crawling' },
  { key: 'page-tags', label: 'Page Tags', cost: 'free', lane: 'knowledge', auto: true,
    description: 'AI-powered page classification by template type and content category' },
  { key: 'screenshots', label: 'Screenshots', cost: 'free', lane: 'knowledge', auto: false,
    description: 'Visual capture of site pages for reference and analysis' },
  { key: 'content', label: 'Page Content', cost: 'free', lane: 'knowledge', auto: false,
    description: 'Markdown extraction of individual page content' },
  { key: 'content-audit', label: 'Content Audit', cost: 'free', lane: 'knowledge', auto: true,
    description: 'Template tier analysis and redesign scope estimation' },
];

// ── Helpers ────────────────────────────────────────────────────

const registryMap = new Map(INTEGRATION_REGISTRY.map(i => [i.key, i]));

export function getIntegrationMeta(key: string): IntegrationMeta | undefined {
  return registryMap.get(key);
}

export function getIntegrationCost(key: string): IntegrationCost | undefined {
  return registryMap.get(key)?.cost;
}

export function getIntegrationLane(key: string): IntegrationLane | undefined {
  return registryMap.get(key)?.lane;
}

export function getIntegrationDescription(key: string): string | undefined {
  return registryMap.get(key)?.description;
}

// ── Crawl Profiles ─────────────────────────────────────────────

export type CrawlProfile = 'free' | 'standard' | 'full' | 'custom';

export const CRAWL_PROFILES: { id: CrawlProfile; label: string; description: string }[] = [
  { id: 'free', label: 'Free Only', description: 'No paid API calls — 16+ integrations at zero cost' },
  { id: 'standard', label: 'Standard', description: 'Free + freemium APIs (WAVE, DetectZeStack)' },
  { id: 'full', label: 'Full', description: 'All integrations including paid APIs' },
  { id: 'custom', label: 'Custom', description: 'Choose individual integrations' },
];

/** Get integration keys that should run for a given profile */
export function getProfileIntegrations(profile: CrawlProfile): string[] {
  if (profile === 'full') return INTEGRATION_REGISTRY.filter(i => i.auto).map(i => i.key);
  if (profile === 'custom') return []; // handled by per-integration toggles

  return INTEGRATION_REGISTRY
    .filter(i => {
      if (!i.auto) return false;
      if (profile === 'free') return i.cost === 'free';
      if (profile === 'standard') return i.cost === 'free' || i.cost === 'freemium';
      return true;
    })
    .map(i => i.key);
}

/** Get integrations that would be skipped for a given profile */
export function getSkippedIntegrations(profile: CrawlProfile): IntegrationMeta[] {
  if (profile === 'full' || profile === 'custom') return [];

  return INTEGRATION_REGISTRY.filter(i => {
    if (!i.auto) return false;
    if (profile === 'free') return i.cost !== 'free';
    if (profile === 'standard') return i.cost === 'paid';
    return false;
  });
}
