/**
 * One-line descriptions for each integration card.
 * Displayed below the card title to explain what the integration measures.
 */
export const CARD_DESCRIPTIONS: Record<string, string> = {
  // Performance
  'gtmetrix': 'Comprehensive performance audit with Web Vitals and page speed metrics',
  'psi': 'Google Lighthouse audit for performance, SEO, accessibility, and best practices',
  'crux': 'Real user performance data from Chrome browsers (Core Web Vitals)',
  'yellowlab': 'Code-level quality analysis detecting bad practices and bloat',
  'carbon': 'Environmental impact measurement — page weight and carbon emissions',

  // SEO & Search
  'semrush': 'Domain authority, organic traffic estimates, and keyword rankings',
  'search-console': 'Google Search performance — clicks, impressions, and indexing status',
  'ga4': 'User engagement metrics — bounce rate, session duration, and traffic sources',
  'schema': 'Structured data validation for rich search results (JSON-LD, microdata)',
  'sitemap': 'XML sitemap analysis — URL coverage, structure, and content segmentation',

  // Accessibility
  'psi-accessibility': 'Lighthouse accessibility audit against WCAG guidelines',
  'wave': 'Accessibility errors, contrast issues, and ARIA problems (WebAIM)',
  'w3c': 'HTML and CSS validation against W3C web standards',

  // Security
  'observatory': 'Security header analysis — HSTS, CSP, X-Frame-Options, and more (Mozilla)',
  'ssllabs': 'SSL/TLS certificate grade, protocol support, and cipher strength',

  // Content & UX
  'nav-structure': 'Site navigation depth, breadth, hierarchy, and key page coverage',
  'readable': 'Content readability — Flesch score, grade level, and sentence complexity',
  'forms': 'Form detection — types, platforms, captcha, and conversion readiness',
  'content-types': 'Content classification — pages, posts, custom types, and structure',

  // URL Health
  'link-checker': 'Site-wide link health — broken links, redirects, and server errors',
  'httpstatus': 'Homepage HTTP status, redirect chain, and response time (TTFB)',

  // Technology (unscored)
  'builtwith': 'Technology stack detection — CMS, frameworks, analytics, and plugins',
  'detectzestack': 'Alternative tech detection for JavaScript and CSS frameworks',
  'tech-analysis': 'AI-synthesized technology analysis with platform assessment',

  // Content (unscored cards)
  'page-tags': 'AI-powered page classification by template type and content category',
  'firecrawl-map': 'Full site URL discovery via recursive crawling',

  // Business intelligence (not site health)
  'apollo': 'Company contact data from Apollo.io',
  'ocean': 'Company intelligence and firmographics from Ocean.io',
  'hubspot': 'CRM data from HubSpot',
  'avoma': 'Meeting transcripts and notes from Avoma',
};
