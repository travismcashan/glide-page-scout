/**
 * Unified Scoring System for Site Analysis
 * 
 * Normalizes all integration outputs to 0-100 scores, rolls them up into
 * category scores, and produces an overall site grade.
 */

// ── Grade helpers ──────────────────────────────────────────────

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export function scoreToGrade(score: number): LetterGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function gradeToColor(grade: LetterGrade): string {
  switch (grade) {
    case 'A': return 'text-emerald-600 dark:text-emerald-400';
    case 'B': return 'text-blue-600 dark:text-blue-400';
    case 'C': return 'text-yellow-600 dark:text-yellow-400';
    case 'D': return 'text-orange-600 dark:text-orange-400';
    case 'F': return 'text-red-600 dark:text-red-400';
  }
}

export function gradeToBgColor(grade: LetterGrade): string {
  switch (grade) {
    case 'A': return 'bg-emerald-500/10 border-emerald-500/20';
    case 'B': return 'bg-blue-500/10 border-blue-500/20';
    case 'C': return 'bg-yellow-500/10 border-yellow-500/20';
    case 'D': return 'bg-orange-500/10 border-orange-500/20';
    case 'F': return 'bg-red-500/10 border-red-500/20';
  }
}

// ── Letter-grade-to-number mapping ─────────────────────────────

const LETTER_MAP: Record<string, number> = {
  'A+': 100, 'A': 95, 'A-': 90,
  'B+': 85, 'B': 82, 'B-': 78,
  'C+': 75, 'C': 72, 'C-': 68,
  'D+': 65, 'D': 62, 'D-': 58,
  'E': 40, 'F': 20, 'T': 10,
};

function letterToScore(letter: string | null | undefined): number | null {
  if (!letter) return null;
  return LETTER_MAP[letter.toUpperCase().trim()] ?? null;
}

// ── Integration score extractors ───────────────────────────────

export type IntegrationScore = {
  key: string;
  label: string;
  score: number;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function extractGtmetrix(session: any): number | null {
  const scores = session.gtmetrix_scores;
  if (scores?.performance != null) return clamp(scores.performance);
  return letterToScore(session.gtmetrix_grade);
}

function extractPsiPerformance(session: any): number | null {
  const psi = session.psi_data;
  if (!psi) return null;
  const mobile = psi.mobile?.lighthouseResult?.categories?.performance?.score;
  const desktop = psi.desktop?.lighthouseResult?.categories?.performance?.score;
  const scores = [mobile, desktop].filter((s) => s != null).map((s: number) => s * 100);
  return scores.length ? clamp(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
}

function extractPsiSeo(session: any): number | null {
  const psi = session.psi_data;
  if (!psi) return null;
  const mobile = psi.mobile?.lighthouseResult?.categories?.seo?.score;
  const desktop = psi.desktop?.lighthouseResult?.categories?.seo?.score;
  const scores = [mobile, desktop].filter((s) => s != null).map((s: number) => s * 100);
  return scores.length ? clamp(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
}

function extractPsiAccessibility(session: any): number | null {
  const psi = session.psi_data;
  if (!psi) return null;
  const mobile = psi.mobile?.lighthouseResult?.categories?.accessibility?.score;
  const desktop = psi.desktop?.lighthouseResult?.categories?.accessibility?.score;
  const scores = [mobile, desktop].filter((s) => s != null).map((s: number) => s * 100);
  return scores.length ? clamp(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
}

function extractPsiBestPractices(session: any): number | null {
  const psi = session.psi_data;
  if (!psi) return null;
  const mobile = psi.mobile?.lighthouseResult?.categories?.['best-practices']?.score;
  const desktop = psi.desktop?.lighthouseResult?.categories?.['best-practices']?.score;
  const scores = [mobile, desktop].filter((s) => s != null).map((s: number) => s * 100);
  return scores.length ? clamp(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
}

function extractCrux(session: any): number | null {
  const crux = session.crux_data;
  if (!crux?.record?.metrics) return null;
  const metrics = crux.record.metrics;
  const metricScores: number[] = [];
  
  for (const metric of Object.values(metrics) as any[]) {
    if (!metric?.percentiles?.p75 || !metric?.histogram) continue;
    // Use the "good" percentage from histogram
    const goodPct = metric.histogram?.[0]?.density;
    if (goodPct != null) metricScores.push(goodPct * 100);
  }
  return metricScores.length ? clamp(metricScores.reduce((a, b) => a + b, 0) / metricScores.length) : null;
}

function extractYellowLab(session: any): number | null {
  const yl = session.yellowlab_data;
  if (!yl) return null;
  if (yl.scoreProfiles?.generic?.globalScore != null) return clamp(yl.scoreProfiles.generic.globalScore);
  if (yl.globalScore != null) return clamp(yl.globalScore);
  return null;
}

function extractCarbon(session: any): number | null {
  const carbon = session.carbon_data;
  if (!carbon) return null;
  if (carbon.cleanerThan != null) return clamp(carbon.cleanerThan * 100);
  return null;
}

function extractSemrush(session: any): number | null {
  const sem = session.semrush_data;
  if (!sem) return null;
  if (sem.authority_score != null) return clamp(sem.authority_score);
  return null;
}

function extractSchema(session: any): number | null {
  const schema = session.schema_data;
  if (!schema) return null;
  const errors = (schema.errors?.length ?? 0) + (schema.invalidSchemas?.length ?? 0);
  const warnings = schema.warnings?.length ?? 0;
  if (errors === 0 && warnings === 0 && !schema.schemas?.length && !schema.jsonLd?.length) return null;
  return clamp(100 - (errors * 10) - (warnings * 3));
}

function extractWave(session: any): number | null {
  const wave = session.wave_data;
  if (!wave?.categories) return null;
  const errors = wave.categories?.error?.count ?? 0;
  const contrast = wave.categories?.contrast?.count ?? 0;
  const alerts = wave.categories?.alert?.count ?? 0;
  return clamp(100 - (errors * 5) - (contrast * 3) - (alerts * 1));
}

function extractW3c(session: any): number | null {
  const w3c = session.w3c_data;
  if (!w3c?.messages) return null;
  const errors = w3c.messages.filter((m: any) => m.type === 'error').length;
  const warnings = w3c.messages.filter((m: any) => m.type === 'info' && m.subType === 'warning').length;
  return clamp(100 - (errors * 5) - (warnings * 1));
}

function extractObservatory(session: any): number | null {
  const obs = session.observatory_data;
  if (!obs) return null;
  if (obs.grade) return letterToScore(obs.grade);
  if (obs.score != null) return clamp(obs.score);
  return null;
}

function extractSslLabs(session: any): number | null {
  const ssl = session.ssllabs_data;
  if (!ssl) return null;
  const grade = ssl.endpoints?.[0]?.grade || ssl.grade;
  return letterToScore(grade);
}

function extractReadable(session: any): number | null {
  const readable = session.readable_data;
  if (!readable) return null;
  // Flesch reading ease: 0-100, higher = easier to read
  if (readable.fleschReadingEase != null) return clamp(readable.fleschReadingEase);
  if (readable.score != null) return clamp(readable.score);
  // grade_level: lower is simpler. Map 1-16 to 100-0
  if (readable.grade_level != null) return clamp(100 - ((readable.grade_level - 1) / 15) * 100);
  return null;
}

function extractHttpStatus(session: any): number | null {
  const hs = session.httpstatus_data;
  if (!hs || !Array.isArray(hs) || hs.length === 0) return null;
  const ok = hs.filter((r: any) => r.statusCode >= 200 && r.statusCode < 300).length;
  return clamp((ok / hs.length) * 100);
}

function extractBrokenLinks(session: any): number | null {
  const lc = session.linkcheck_data;
  if (!lc) return null;
  const results = lc.results || lc;
  if (!Array.isArray(results) || results.length === 0) return null;
  const broken = results.filter((r: any) => r.status === 'broken' || (r.statusCode && r.statusCode >= 400)).length;
  return clamp(((results.length - broken) / results.length) * 100);
}

// ── XML Sitemap scoring ────────────────────────────────────────

function extractSitemap(session: any): number | null {
  const sm = session.sitemap_data;
  if (!sm || !sm.found) return null;

  const stats = sm.stats;
  const groups: any[] = sm.groups || [];
  if (!stats || stats.totalUrls === 0) return 0;

  let score = 0;

  // 1. Sitemap exists (20 pts)
  score += 20;

  // 2. URL coverage vs discovered URLs (25 pts)
  const discoveredUrls = session.discovered_urls;
  const discoveredCount = Array.isArray(discoveredUrls) ? discoveredUrls.length : 0;
  if (discoveredCount > 0) {
    const coverageRatio = Math.min(1, stats.totalUrls / discoveredCount);
    score += Math.round(coverageRatio * 25);
  } else {
    // No discovered URLs to compare — give benefit of doubt
    score += 20;
  }

  // 3. Sitemap index structure (15 pts)
  if (groups.length > 2) {
    score += 15; // Well-organized sitemap index
  } else if (groups.length === 2) {
    score += 10;
  } else {
    score += 8; // Single flat sitemap
  }

  // 4. Content type segmentation (15 pts)
  const contentTypeHints = sm.contentTypeHints || [];
  if (contentTypeHints.length >= 3) {
    score += 15;
  } else if (contentTypeHints.length >= 1) {
    score += 8;
  } else {
    score += 3;
  }

  // 5. URL count health — no sitemap should exceed 50k (10 pts)
  const hasOversized = groups.some((g: any) => g.urls?.length > 50000);
  const hasEmpty = groups.some((g: any) => !g.urls?.length);
  if (!hasOversized && !hasEmpty) {
    score += 10;
  } else if (hasEmpty) {
    score += 5;
  }

  // 6. No orphan/dead URLs — cross-ref with linkcheck (15 pts)
  const lc = session.linkcheck_data;
  if (lc) {
    const results = lc.results || lc;
    if (Array.isArray(results) && results.length > 0) {
      const broken = results.filter((r: any) => r.status === 'broken' || (r.statusCode && r.statusCode >= 400)).length;
      score += Math.round(Math.max(0, 1 - broken / results.length) * 15);
    } else {
      score += 12;
    }
  } else {
    score += 12; // No link check data — don't penalize
  }

  return clamp(score);
}

// ── URL Health scoring (broken links + redirects) ──────────────

function extractUrlHealth(session: any): number | null {
  const lc = session.linkcheck_data;
  if (!lc) return null;
  const results = lc.results || lc;
  if (!Array.isArray(results) || results.length === 0) return null;

  const total = results.length;
  const broken = results.filter((r: any) => r.status === 'broken' || (r.statusCode && r.statusCode >= 400)).length;
  const redirects = results.filter((r: any) => r.statusCode && r.statusCode >= 300 && r.statusCode < 400).length;
  const ok = results.filter((r: any) => r.statusCode && r.statusCode >= 200 && r.statusCode < 300).length;

  let score = 0;

  // 1. Broken links (40 pts) — each broken link costs 4 pts
  score += Math.max(0, 40 - broken * 4);

  // 2. Redirect ratio (25 pts)
  const redirectPct = redirects / total;
  score += Math.max(0, Math.round(25 - redirectPct * 25));

  // 3. Clean hit rate (20 pts)
  score += Math.round((ok / total) * 20);

  // 4. Coverage checked vs discovered (15 pts)
  const discoveredUrls = session.discovered_urls;
  const discoveredCount = Array.isArray(discoveredUrls) ? discoveredUrls.length : 0;
  if (discoveredCount > 0) {
    score += Math.round(Math.min(1, total / discoveredCount) * 15);
  } else {
    score += 10;
  }

  return clamp(score);
}

// ── HTTP Status scoring ────────────────────────────────────────

function extractHttpStatusDetailed(session: any): number | null {
  const hs = session.httpstatus_data;
  if (!hs) return null;

  // httpstatus_data is a single URL check result with hops array
  const hops: any[] = hs.hops || [];
  if (hops.length === 0) return null;

  const finalStatusCode = hs.finalStatusCode || hops[hops.length - 1]?.statusCode || 0;
  const redirectCount = hs.redirectCount ?? (hops.length - 1);

  let score = 0;

  // 1. Final status is 2xx (35 pts)
  if (finalStatusCode >= 200 && finalStatusCode < 300) {
    score += 35;
  } else if (finalStatusCode >= 300 && finalStatusCode < 400) {
    score += 15; // Ends on redirect — not great
  }
  // 5xx or 4xx = 0 pts

  // 2. No 5xx in chain (25 pts)
  const has5xx = hops.some((h: any) => h.statusCode >= 500);
  if (!has5xx) score += 25;

  // 3. No 4xx in chain (20 pts)
  const has4xx = hops.some((h: any) => h.statusCode >= 400 && h.statusCode < 500);
  if (!has4xx) score += 20;

  // 4. Redirect efficiency (10 pts) — single hop = 10, 2 hops = 7, 3+ = 2
  if (redirectCount === 0) {
    score += 10;
  } else if (redirectCount === 1) {
    score += 7;
  } else if (redirectCount === 2) {
    score += 4;
  } else {
    score += 1;
  }

  // 5. Response time health (10 pts) — based on first byte timing
  const finalHop = hops[hops.length - 1];
  const ttfb = finalHop?.timings?.firstByte ?? finalHop?.latency;
  if (ttfb != null) {
    if (ttfb < 200) score += 10;
    else if (ttfb < 500) score += 7;
    else if (ttfb < 1000) score += 4;
    else score += 1;
  } else {
    score += 5; // No timing data — neutral
  }

  return clamp(score);
}

// ── Site Navigation scoring ────────────────────────────────────

function extractNavigation(session: any): number | null {
  const nav = session.nav_structure;
  if (!nav) return null;

  // Combine all nav sections
  const primary: any[] = nav.primary || nav.items || [];
  const secondary: any[] = nav.secondary || [];
  const footer: any[] = nav.footer || [];

  if (primary.length === 0 && secondary.length === 0 && footer.length === 0) return null;

  // Helper: compute max depth of a nav tree
  function maxDepth(items: any[], depth = 1): number {
    let max = depth;
    for (const item of items) {
      if (item.children?.length) {
        max = Math.max(max, maxDepth(item.children, depth + 1));
      }
    }
    return max;
  }

  // Helper: count all links
  function countLinks(items: any[]): number {
    let count = 0;
    for (const item of items) {
      if (item.url) count++;
      if (item.children?.length) count += countLinks(item.children);
    }
    return count;
  }

  // Helper: count items with children
  function countWithChildren(items: any[]): number {
    return items.filter((i: any) => i.children?.length).length;
  }

  // Helper: collect all labels
  function collectLabels(items: any[]): string[] {
    const labels: string[] = [];
    for (const item of items) {
      if (item.label) labels.push(item.label);
      if (item.children?.length) labels.push(...collectLabels(item.children));
    }
    return labels;
  }

  const topLevel = primary.length;
  const depth = maxDepth(primary);
  const totalLinks = countLinks(primary) + countLinks(secondary) + countLinks(footer);
  const allLabels = collectLabels(primary);

  let score = 0;

  // 1. Depth balance (20 pts)
  if (depth >= 2 && depth <= 3) score += 20;
  else if (depth === 1) score += 12;
  else if (depth === 4) score += 10;
  else score += 5;

  // 2. Breadth balance (20 pts) — top-level item count
  if (topLevel >= 4 && topLevel <= 8) score += 20;
  else if (topLevel === 3 || (topLevel >= 9 && topLevel <= 10)) score += 15;
  else if (topLevel === 2 || (topLevel >= 11 && topLevel <= 12)) score += 8;
  else score += 3;

  // 3. Total link count (15 pts)
  if (totalLinks >= 10 && totalLinks <= 50) score += 15;
  else if (totalLinks >= 51 && totalLinks <= 80) score += 10;
  else if (totalLinks >= 81 && totalLinks <= 120) score += 6;
  else if (totalLinks > 120) score += 2;
  else score += 3; // < 5

  // 4. Hierarchy coverage (15 pts)
  if (topLevel > 0) {
    const withChildren = countWithChildren(primary);
    score += Math.round((withChildren / topLevel) * 15);
  }

  // 5. Label quality (15 pts)
  if (allLabels.length > 0) {
    const avgLen = allLabels.reduce((s, l) => s + l.length, 0) / allLabels.length;
    const uniqueLabels = new Set(allLabels.map(l => l.toLowerCase()));
    const dupeRatio = 1 - uniqueLabels.size / allLabels.length;

    let labelScore = 15;
    if (avgLen < 2 || avgLen > 40) labelScore = 5;
    labelScore -= Math.round(dupeRatio * 8); // Penalize duplicates
    score += Math.max(0, labelScore);
  }

  // 6. Key pages present (15 pts) — 3 pts each
  const labelStr = allLabels.map(l => l.toLowerCase()).join(' ');
  const keyPages = [
    /about/i, /contact/i, /service|product|solution/i, /blog|resource|news|insight/i, /home|^$/i,
  ];
  for (const pattern of keyPages) {
    if (pattern.test(labelStr)) score += 3;
  }

  return clamp(score);
}

function extractTechCoverage(session: any): number | null {
  let points = 0;
  let checks = 0;

  const allTechs: string[] = [];
  
  // Gather tech names from all detection sources
  const bw = session.builtwith_data;
  if (bw?.technologies) {
    bw.technologies.forEach((t: any) => allTechs.push(t.name?.toLowerCase() || ''));
  }
  const wap = session.wappalyzer_data;
  if (wap?.technologies) {
    wap.technologies.forEach((t: any) => allTechs.push(t.name?.toLowerCase() || ''));
  }
  
  if (allTechs.length === 0) return null;

  const techStr = allTechs.join(' ');
  
  // Check for key infrastructure categories
  const categories = [
    { name: 'analytics', keywords: ['analytics', 'google analytics', 'gtm', 'tag manager', 'hotjar', 'mixpanel', 'segment'] },
    { name: 'cdn', keywords: ['cdn', 'cloudflare', 'cloudfront', 'fastly', 'akamai', 'vercel'] },
    { name: 'cms', keywords: ['wordpress', 'drupal', 'webflow', 'contentful', 'sanity', 'strapi', 'hubspot cms'] },
    { name: 'security', keywords: ['ssl', 'hsts', 'waf', 'security', 'recaptcha', 'cloudflare'] },
    { name: 'performance', keywords: ['lazy', 'minif', 'compress', 'cache', 'http/2', 'http/3', 'brotli', 'gzip'] },
    { name: 'marketing', keywords: ['hubspot', 'marketo', 'mailchimp', 'intercom', 'drift', 'crisp'] },
  ];

  for (const cat of categories) {
    checks++;
    if (cat.keywords.some((kw) => techStr.includes(kw))) points++;
  }

  return checks > 0 ? clamp((points / checks) * 100) : null;
}

// ── Category definitions ───────────────────────────────────────

export type CategoryKey = 'performance' | 'seo' | 'accessibility' | 'security' | 'content' | 'technology' | 'url-analysis' | 'navigation';

export type CategoryScore = {
  key: CategoryKey;
  label: string;
  score: number;
  grade: LetterGrade;
  weight: number;
  integrations: IntegrationScore[];
};

export type OverallScore = {
  score: number;
  grade: LetterGrade;
  categories: CategoryScore[];
};

type IntegrationDef = {
  key: string;
  label: string;
  extract: (session: any) => number | null;
};

const CATEGORY_DEFS: { key: CategoryKey; label: string; weight: number; integrations: IntegrationDef[] }[] = [
  {
    key: 'performance',
    label: 'Performance',
    weight: 25,
    integrations: [
      { key: 'gtmetrix', label: 'GTmetrix', extract: extractGtmetrix },
      { key: 'psi-performance', label: 'PageSpeed Performance', extract: extractPsiPerformance },
      { key: 'psi-best-practices', label: 'Best Practices', extract: extractPsiBestPractices },
      { key: 'crux', label: 'CrUX', extract: extractCrux },
      { key: 'yellowlab', label: 'YellowLab', extract: extractYellowLab },
      { key: 'carbon', label: 'Website Carbon', extract: extractCarbon },
    ],
  },
  {
    key: 'seo',
    label: 'SEO & Search',
    weight: 18,
    integrations: [
      { key: 'semrush', label: 'SEMrush', extract: extractSemrush },
      { key: 'psi-seo', label: 'PageSpeed SEO', extract: extractPsiSeo },
      { key: 'schema', label: 'Schema.org', extract: extractSchema },
      { key: 'sitemap', label: 'XML Sitemap', extract: extractSitemap },
    ],
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    weight: 18,
    integrations: [
      { key: 'psi-accessibility', label: 'Lighthouse', extract: extractPsiAccessibility },
      { key: 'wave', label: 'WAVE', extract: extractWave },
      { key: 'w3c', label: 'W3C', extract: extractW3c },
    ],
  },
  {
    key: 'security',
    label: 'Security',
    weight: 14,
    integrations: [
      { key: 'observatory', label: 'Observatory', extract: extractObservatory },
      { key: 'ssllabs', label: 'SSL Labs', extract: extractSslLabs },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    weight: 12,
    integrations: [
      { key: 'readable', label: 'Readability', extract: extractReadable },
    ],
  },
  {
    key: 'url-analysis',
    label: 'URL Health',
    weight: 8,
    integrations: [
      { key: 'httpstatus', label: 'HTTP Status', extract: extractHttpStatusDetailed },
      { key: 'link-checker', label: 'Broken Links', extract: extractBrokenLinks },
      { key: 'url-health', label: 'URL Health', extract: extractUrlHealth },
    ],
  },
  {
    key: 'navigation',
    label: 'Navigation',
    weight: 5,
    integrations: [
      { key: 'nav-structure', label: 'Site Navigation', extract: extractNavigation },
    ],
  },
  {
    key: 'technology',
    label: 'Technology',
    weight: 5,
    integrations: [
      { key: 'tech-coverage', label: 'Tech Coverage', extract: extractTechCoverage },
    ],
  },
];

// ── Main computation ───────────────────────────────────────────

export function computeOverallScore(session: any): OverallScore | null {
  if (!session) return null;

  const categories: CategoryScore[] = [];

  for (const catDef of CATEGORY_DEFS) {
    const integrations: IntegrationScore[] = [];

    for (const intDef of catDef.integrations) {
      const score = intDef.extract(session);
      if (score != null) {
        integrations.push({ key: intDef.key, label: intDef.label, score });
      }
    }

    if (integrations.length > 0) {
      const avg = integrations.reduce((sum, i) => sum + i.score, 0) / integrations.length;
      categories.push({
        key: catDef.key,
        label: catDef.label,
        score: Math.round(avg),
        grade: scoreToGrade(avg),
        weight: catDef.weight,
        integrations,
      });
    }
  }

  if (categories.length === 0) return null;

  // Weighted average with redistributed weights for missing categories
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = categories.reduce((sum, c) => sum + c.score * (c.weight / totalWeight), 0);
  const overall = Math.round(weightedSum);

  return {
    score: overall,
    grade: scoreToGrade(overall),
    categories,
  };
}

/** Get score for a specific integration key */
export function getIntegrationScore(session: any, integrationKey: string): number | null {
  for (const catDef of CATEGORY_DEFS) {
    for (const intDef of catDef.integrations) {
      if (intDef.key === integrationKey) {
        return intDef.extract(session);
      }
    }
  }
  return null;
}

/** Get the category score for a given section key */
export function getCategoryScore(overall: OverallScore | null, categoryKey: CategoryKey): CategoryScore | null {
  if (!overall) return null;
  return overall.categories.find(c => c.key === categoryKey) ?? null;
}

/** Map section IDs from ResultsPage to category keys */
export const SECTION_TO_CATEGORY: Record<string, CategoryKey> = {
  'section-url-analysis': 'url-analysis',
  'section-performance': 'performance',
  'section-seo': 'seo',
  'section-ux-accessibility': 'accessibility',
  'section-security': 'security',
  'section-content-analysis': 'content',
  'section-tech-detection': 'technology',
  'section-navigation': 'navigation',
};
