/**
 * Canonical Integration Registry (server-side)
 *
 * Single source of truth for all crawl integration metadata.
 * Phase files import batch lists from here. crawl-start imports the full list.
 * buildBody functions stay in their respective phase files (they reference runtime variables).
 *
 * Frontend mirror: src/config/integrations.ts (same data, no fn/column fields)
 */

export type IntegrationCost = 'free' | 'freemium' | 'paid';
export type IntegrationLane = 'audit' | 'intel' | 'knowledge' | 'premium';

export interface IntegrationDef {
  key: string;
  label: string;
  fn: string;           // edge function name
  column: string;       // crawl_sessions column
  batch: 1 | 2 | 3;
  waitFor?: string;     // column dependency (batch 2/3)
  cost: IntegrationCost;
  lane: IntegrationLane;
  auto: boolean;        // runs in crawl pipeline
  category: string;     // UI grouping
  description: string;
}

// ── The Registry ─────────────────────────────────────────────────────────────

export const INTEGRATION_REGISTRY: IntegrationDef[] = [
  // ── Performance ──
  { key: 'psi', label: 'PageSpeed Insights', fn: 'pagespeed-insights', column: 'psi_data', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Performance', description: 'Google Lighthouse audit for performance, SEO, accessibility, and best practices' },
  { key: 'gtmetrix', label: 'GTmetrix', fn: 'gtmetrix-test', column: 'gtmetrix_scores', batch: 1, cost: 'paid', lane: 'audit', auto: true, category: 'Performance', description: 'Comprehensive performance audit with Web Vitals and page speed metrics' },
  { key: 'crux', label: 'CrUX', fn: 'crux-lookup', column: 'crux_data', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Performance', description: 'Real user performance data from Chrome browsers (Core Web Vitals)' },
  { key: 'yellowlab', label: 'Yellow Lab Tools', fn: 'yellowlab-scan', column: 'yellowlab_data', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Performance', description: 'Code-level quality analysis detecting bad practices and bloat' },
  { key: 'carbon', label: 'Website Carbon', fn: 'website-carbon', column: 'carbon_data', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Performance', description: 'Environmental impact measurement — page weight and carbon emissions' },

  // ── SEO & Search ──
  { key: 'semrush', label: 'SEMrush', fn: 'semrush-domain', column: 'semrush_data', batch: 1, cost: 'paid', lane: 'audit', auto: true, category: 'SEO', description: 'Domain authority, organic traffic estimates, and keyword rankings' },
  { key: 'schema', label: 'Schema.org', fn: 'schema-validate', column: 'schema_data', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'SEO', description: 'Structured data validation for rich search results (JSON-LD, microdata)' },
  { key: 'sitemap', label: 'XML Sitemaps', fn: 'sitemap-parse', column: 'sitemap_data', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'SEO', description: 'XML sitemap analysis — URL coverage, structure, and content segmentation' },

  // ── Accessibility ──
  { key: 'wave', label: 'WAVE', fn: 'wave-lookup', column: 'wave_data', batch: 1, cost: 'freemium', lane: 'audit', auto: true, category: 'Accessibility', description: 'Accessibility errors, contrast issues, and ARIA problems (WebAIM)' },
  { key: 'w3c', label: 'W3C Validation', fn: 'w3c-validate', column: 'w3c_data', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Accessibility', description: 'HTML and CSS validation against W3C web standards' },

  // ── Security ──
  { key: 'observatory', label: 'Mozilla Observatory', fn: 'observatory-scan', column: 'observatory_data', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Security', description: 'Security header analysis — HSTS, CSP, X-Frame-Options, and more (Mozilla)' },

  // ── Content & UX ──
  { key: 'nav-structure', label: 'Site Navigation', fn: 'nav-extract', column: 'nav_structure', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Content & UX', description: 'Site navigation depth, breadth, hierarchy, and key page coverage' },
  { key: 'readable', label: 'Readability', fn: 'readable-score', column: 'readable_data', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'Content & UX', description: 'Content readability — Flesch score, grade level, and sentence complexity' },
  { key: 'content-types', label: 'Content Types', fn: 'content-types', column: 'content_types_data', batch: 2, cost: 'free', lane: 'audit', auto: true, category: 'Content & UX', description: 'Content classification — pages, posts, custom types, and structure' },
  { key: 'forms', label: 'Forms Analysis', fn: 'forms-detect', column: 'forms_data', batch: 2, cost: 'free', lane: 'audit', auto: true, category: 'Content & UX', description: 'Form detection — types, platforms, captcha, and conversion readiness' },

  // ── URL Health ──
  { key: 'httpstatus', label: 'HTTP Status', fn: 'httpstatus-check', column: 'httpstatus_data', batch: 1, cost: 'free', lane: 'audit', auto: true, category: 'URL Health', description: 'Homepage HTTP status, redirect chain, and response time (TTFB)' },
  { key: 'link-checker', label: 'Link Checker', fn: 'link-checker', column: 'linkcheck_data', batch: 2, cost: 'free', lane: 'audit', auto: true, category: 'URL Health', description: 'Site-wide link health — broken links, redirects, and server errors' },

  // ── Premium (manual/OAuth, still scores) ──
  { key: 'ssllabs', label: 'SSL Labs', fn: 'ssllabs-scan', column: 'ssllabs_data', batch: 1, cost: 'free', lane: 'premium', auto: false, category: 'Security', description: 'SSL/TLS certificate grade, protocol support, and cipher strength' },
  { key: 'ga4', label: 'Google Analytics (GA4)', fn: 'ga4-fetch', column: 'ga4_data', batch: 1, cost: 'free', lane: 'premium', auto: false, category: 'SEO', description: 'User engagement metrics — bounce rate, session duration, and traffic sources' },
  { key: 'search-console', label: 'Google Search Console', fn: 'search-console-fetch', column: 'search_console_data', batch: 1, cost: 'free', lane: 'premium', auto: false, category: 'SEO', description: 'Google Search performance — clicks, impressions, and indexing status' },

  // ── Technology Detection (intel) ──
  { key: 'builtwith', label: 'BuiltWith', fn: 'builtwith-lookup', column: 'builtwith_data', batch: 1, cost: 'paid', lane: 'intel', auto: true, category: 'Technology', description: 'Technology stack detection — CMS, frameworks, analytics, and plugins' },
  { key: 'detectzestack', label: 'DetectZeStack', fn: 'detectzestack-lookup', column: 'detectzestack_data', batch: 1, cost: 'freemium', lane: 'intel', auto: true, category: 'Technology', description: 'Alternative tech detection for JavaScript and CSS frameworks' },
  { key: 'tech-analysis', label: 'Tech Analysis', fn: 'tech-analysis', column: 'tech_analysis_data', batch: 2, waitFor: 'builtwith_data', cost: 'free', lane: 'intel', auto: true, category: 'Technology', description: 'AI-synthesized technology analysis with platform assessment' },

  // ── Enrichment & Prospecting (intel) ──
  { key: 'apollo', label: 'Apollo', fn: 'apollo-enrich', column: 'apollo_data', batch: 1, cost: 'paid', lane: 'intel', auto: true, category: 'Enrichment', description: 'Company contact data from Apollo.io' },
  { key: 'apollo-team', label: 'Apollo Team', fn: 'apollo-team-search', column: 'apollo_team_data', batch: 3, waitFor: 'apollo_data', cost: 'paid', lane: 'intel', auto: true, category: 'Enrichment', description: 'Team member discovery via Apollo.io' },
  { key: 'ocean', label: 'Ocean.io', fn: 'ocean-enrich', column: 'ocean_data', batch: 1, cost: 'paid', lane: 'intel', auto: true, category: 'Enrichment', description: 'Company intelligence and firmographics from Ocean.io' },
  { key: 'hubspot', label: 'HubSpot', fn: 'hubspot-lookup', column: 'hubspot_data', batch: 1, cost: 'free', lane: 'intel', auto: true, category: 'Enrichment', description: 'CRM data from HubSpot' },
  { key: 'avoma', label: 'Avoma', fn: 'avoma-lookup', column: 'avoma_data', batch: 1, cost: 'free', lane: 'intel', auto: true, category: 'Intelligence', description: 'Meeting transcripts and notes from Avoma' },

  // ── Knowledge Capture ──
  { key: 'firecrawl-map', label: 'URL Discovery', fn: 'firecrawl-map', column: 'discovered_urls', batch: 1, cost: 'paid', lane: 'knowledge', auto: true, category: 'URL Analysis', description: 'Full site URL discovery via recursive crawling' },
  { key: 'page-tags', label: 'Page Tags', fn: 'page-tag-orchestrate', column: 'page_tags', batch: 3, waitFor: 'content_types_data', cost: 'free', lane: 'knowledge', auto: true, category: 'Design Analysis', description: 'AI-powered page classification by template type and content category' },
  { key: 'screenshots', label: 'Screenshots', fn: 'screenshots', column: 'screenshots_data', batch: 1, cost: 'free', lane: 'knowledge', auto: false, category: 'Design Analysis', description: 'Visual capture of site pages for reference and analysis' },
  { key: 'content', label: 'Page Content', fn: 'content-scrape', column: 'content_data', batch: 1, cost: 'free', lane: 'knowledge', auto: false, category: 'Content Analysis', description: 'Markdown extraction of individual page content' },
  { key: 'content-audit', label: 'Content Audit', fn: 'content-audit', column: 'content_audit_data', batch: 1, cost: 'free', lane: 'knowledge', auto: true, category: 'Content Analysis', description: 'Template tier analysis and redesign scope estimation' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const _map = new Map(INTEGRATION_REGISTRY.map(i => [i.key, i]));

export function getIntegration(key: string): IntegrationDef | undefined {
  return _map.get(key);
}

/** Get all integrations for a given batch (1, 2, or 3) */
export function getBatchIntegrations(batch: 1 | 2 | 3): IntegrationDef[] {
  return INTEGRATION_REGISTRY.filter(i => i.batch === batch && i.auto);
}

/** Get all auto-running integrations */
export function getAutoIntegrations(): IntegrationDef[] {
  return INTEGRATION_REGISTRY.filter(i => i.auto);
}

/** Total count of auto-running integrations (for progress/status) */
export const AUTO_INTEGRATION_COUNT = INTEGRATION_REGISTRY.filter(i => i.auto).length;
