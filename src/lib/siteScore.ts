/**
 * SUPER CRAWL v1.0 — Unified Site Health Scoring System
 *
 * 6 weighted health categories with authority-weighted integrations.
 * Produces strengths/gaps analysis alongside numeric scores.
 * Technology category removed (descriptive, not prescriptive).
 * Business intelligence integrations excluded from scoring.
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

// ── Helpers ────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ── Types ──────────────────────────────────────────────────────

export type IntegrationScore = {
  key: string;
  label: string;
  score: number;
};

export type ScoreSignal = {
  key: string;
  label: string;
  score: number;
  type: 'strength' | 'gap' | 'neutral';
  summary: string;
};

export type CategoryKey = 'performance' | 'seo' | 'accessibility' | 'security' | 'content-ux' | 'url-health';

export type CategoryScore = {
  key: CategoryKey;
  label: string;
  score: number;
  grade: LetterGrade;
  weight: number;
  integrations: IntegrationScore[];
  strengths: ScoreSignal[];
  gaps: ScoreSignal[];
};

export type OverallScore = {
  score: number;
  grade: LetterGrade;
  categories: CategoryScore[];
  topStrengths: ScoreSignal[];
  topGaps: ScoreSignal[];
  version: string;
};

type IntegrationDef = {
  key: string;
  label: string;
  weight: number;
  extract: (session: any) => number | null;
  summarize: (session: any, score: number) => string;
};

// ── Integration score extractors ───────────────────────────────

function extractGtmetrix(session: any): number | null {
  const scores = session.gtmetrix_scores;
  if (scores?.performance != null) return clamp(scores.performance);
  return letterToScore(session.gtmetrix_grade);
}

function extractPsiCategory(session: any, category: string): number | null {
  const psi = session.psi_data;
  if (!psi) return null;
  const mobileRaw = psi.mobile?.lighthouseResult?.categories?.[category]?.score;
  const desktopRaw = psi.desktop?.lighthouseResult?.categories?.[category]?.score;
  const mobilePre = psi.mobile?.categories?.[category];
  const desktopPre = psi.desktop?.categories?.[category];

  const scores: number[] = [];
  if (mobileRaw != null) scores.push(mobileRaw * 100);
  else if (typeof mobilePre === 'number') scores.push(mobilePre);
  if (desktopRaw != null) scores.push(desktopRaw * 100);
  else if (typeof desktopPre === 'number') scores.push(desktopPre);

  return scores.length ? clamp(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}

function extractPsiPerformance(session: any): number | null {
  return extractPsiCategory(session, 'performance');
}

function extractPsiSeo(session: any): number | null {
  return extractPsiCategory(session, 'seo');
}

function extractPsiAccessibility(session: any): number | null {
  return extractPsiCategory(session, 'accessibility');
}

function extractPsiBestPractices(session: any): number | null {
  return extractPsiCategory(session, 'bestPractices') ?? extractPsiCategory(session, 'best-practices');
}

function extractCrux(session: any): number | null {
  const crux = session.crux_data;
  if (!crux?.record?.metrics) return null;
  const metrics = crux.record.metrics;
  const metricScores: number[] = [];

  for (const metric of Object.values(metrics) as any[]) {
    if (!metric?.percentiles?.p75 || !metric?.histogram) continue;
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
  if (!wave) return null;
  const errors = wave.categories?.error?.count ?? wave.summary?.errors ?? 0;
  const contrast = wave.categories?.contrast?.count ?? wave.summary?.contrast ?? 0;
  const alerts = wave.categories?.alert?.count ?? wave.summary?.alerts ?? 0;
  if (errors === 0 && contrast === 0 && alerts === 0 && !wave.categories && !wave.summary) return null;
  return clamp(100 - (errors * 5) - (contrast * 3) - (alerts * 1));
}

function extractW3c(session: any): number | null {
  const w3c = session.w3c_data;
  if (!w3c) return null;
  if (w3c.messages) {
    const errors = w3c.messages.filter((m: any) => m.type === 'error').length;
    const warnings = w3c.messages.filter((m: any) => m.type === 'info' && m.subType === 'warning').length;
    return clamp(100 - (errors * 5) - (warnings * 1));
  }
  const htmlErrors = w3c.html?.errors?.length ?? 0;
  const htmlWarnings = w3c.html?.warnings?.length ?? 0;
  const cssErrors = w3c.css?.errors?.length ?? 0;
  if (htmlErrors === 0 && htmlWarnings === 0 && cssErrors === 0 && !w3c.html && !w3c.css) return null;
  return clamp(100 - ((htmlErrors + cssErrors) * 5) - (htmlWarnings * 1));
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
  if (readable.fleschReadingEase != null) return clamp(readable.fleschReadingEase);
  if (readable.score != null) return clamp(readable.score);
  if (readable.grade_level != null) return clamp(100 - ((readable.grade_level - 1) / 15) * 100);
  return null;
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
    score += 20;
  }

  // 3. Sitemap index structure (15 pts)
  if (groups.length > 2) {
    score += 15;
  } else if (groups.length === 2) {
    score += 10;
  } else {
    score += 8;
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

  // 5. URL count health (10 pts)
  const hasOversized = groups.some((g: any) => g.urls?.length > 50000);
  const hasEmpty = groups.some((g: any) => !g.urls?.length);
  if (!hasOversized && !hasEmpty) {
    score += 10;
  } else if (hasEmpty) {
    score += 5;
  }

  // 6. URL health bonus (15 pts)
  score += 12;

  return clamp(score);
}

// ── HTTP Status scoring ────────────────────────────────────────

function extractHttpStatusDetailed(session: any): number | null {
  const hs = session.httpstatus_data;
  if (!hs) return null;

  const hops: any[] = hs.hops || [];
  if (hops.length === 0) return null;

  const finalStatusCode = hs.finalStatusCode || hops[hops.length - 1]?.statusCode || 0;
  const redirectCount = hs.redirectCount ?? (hops.length - 1);

  let score = 0;

  // 1. Final status is 2xx (35 pts)
  if (finalStatusCode >= 200 && finalStatusCode < 300) {
    score += 35;
  } else if (finalStatusCode >= 300 && finalStatusCode < 400) {
    score += 15;
  }

  // 2. No 5xx in chain (25 pts)
  const has5xx = hops.some((h: any) => h.statusCode >= 500);
  if (!has5xx) score += 25;

  // 3. No 4xx in chain (20 pts)
  const has4xx = hops.some((h: any) => h.statusCode >= 400 && h.statusCode < 500);
  if (!has4xx) score += 20;

  // 4. Redirect efficiency (10 pts)
  if (redirectCount === 0) {
    score += 10;
  } else if (redirectCount === 1) {
    score += 7;
  } else if (redirectCount === 2) {
    score += 4;
  } else {
    score += 1;
  }

  // 5. Response time health (10 pts)
  const finalHop = hops[hops.length - 1];
  const ttfb = finalHop?.timings?.firstByte ?? finalHop?.latency;
  if (ttfb != null) {
    if (ttfb < 200) score += 10;
    else if (ttfb < 500) score += 7;
    else if (ttfb < 1000) score += 4;
    else score += 1;
  } else {
    score += 5;
  }

  return clamp(score);
}

// ── Site Navigation scoring ────────────────────────────────────

function extractNavigation(session: any): number | null {
  const nav = session.nav_structure;
  if (!nav) return null;

  const primary: any[] = nav.primary || nav.items || [];
  const secondary: any[] = nav.secondary || [];
  const footer: any[] = nav.footer || [];

  if (primary.length === 0 && secondary.length === 0 && footer.length === 0) return null;

  function maxDepth(items: any[], depth = 1): number {
    let max = depth;
    for (const item of items) {
      if (item.children?.length) {
        max = Math.max(max, maxDepth(item.children, depth + 1));
      }
    }
    return max;
  }

  function countLinks(items: any[]): number {
    let count = 0;
    for (const item of items) {
      if (item.url) count++;
      if (item.children?.length) count += countLinks(item.children);
    }
    return count;
  }

  function countWithChildren(items: any[]): number {
    return items.filter((i: any) => i.children?.length).length;
  }

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

  // 2. Breadth balance (20 pts)
  if (topLevel >= 4 && topLevel <= 8) score += 20;
  else if (topLevel === 3 || (topLevel >= 9 && topLevel <= 10)) score += 15;
  else if (topLevel === 2 || (topLevel >= 11 && topLevel <= 12)) score += 8;
  else score += 3;

  // 3. Total link count (15 pts)
  if (totalLinks >= 10 && totalLinks <= 50) score += 15;
  else if (totalLinks >= 51 && totalLinks <= 80) score += 10;
  else if (totalLinks >= 81 && totalLinks <= 120) score += 6;
  else if (totalLinks > 120) score += 2;
  else score += 3;

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
    labelScore -= Math.round(dupeRatio * 8);
    score += Math.max(0, labelScore);
  }

  // 6. Key pages present (15 pts)
  const labelStr = allLabels.map(l => l.toLowerCase()).join(' ');
  const keyPages = [
    /about/i, /contact/i, /service|product|solution/i, /blog|resource|news|insight/i, /home|^$/i,
  ];
  for (const pattern of keyPages) {
    if (pattern.test(labelStr)) score += 3;
  }

  return clamp(score);
}

// ── Link Checker scoring (NEW) ─────────────────────────────────

function extractLinkChecker(session: any): number | null {
  const lc = session.linkcheck_data;
  if (!lc?.summary || !lc.summary.total) return null;
  const { total, ok, redirects, clientErrors, serverErrors, failures } = lc.summary;
  const healthy = (ok || 0) + (redirects || 0);
  const healthyRatio = healthy / total;
  const errorPenalty = (((clientErrors || 0) * 3) + ((serverErrors || 0) * 5) + ((failures || 0) * 2)) / total;
  return clamp(healthyRatio * 100 - errorPenalty * 10);
}

// ── Forms scoring (NEW) ───────────────────────────────────────

function extractForms(session: any): number | null {
  const fd = session.forms_data;
  if (!fd) return null;
  const forms = fd.forms || [];
  const summary = fd.summary || {};
  const uniqueForms = summary.uniqueForms ?? forms.length;

  if (uniqueForms === 0) return 30; // No forms = gap, not failure

  let score = 0;

  // Has forms at all (25 pts)
  score += 25;

  // Form coverage ratio (20 pts)
  const pagesScraped = summary.pagesScraped || 1;
  const pagesWithForms = summary.pagesWithForms || 0;
  if (pagesScraped > 0) {
    const coverageRatio = Math.min(pagesWithForms / pagesScraped, 0.5) / 0.5;
    score += Math.round(coverageRatio * 20);
  }

  // Uses a recognized platform (20 pts)
  const platforms = summary.platforms || {};
  const platformCount = Object.keys(platforms).filter(p => p !== 'Native' && p !== 'native').length;
  if (platformCount > 0) score += 20;
  else score += 5;

  // Has captcha (10 pts)
  const hasCaptcha = forms.some((f: any) => f.hasCaptcha);
  if (hasCaptcha) score += 10;

  // Diversity of form types (15 pts)
  const formTypes = summary.formTypes || {};
  const typeCount = Object.keys(formTypes).length;
  score += Math.min(typeCount, 3) * 5;

  // Contact form exists (10 pts)
  const hasContact = forms.some((f: any) =>
    /contact|inquiry|get.in.touch/i.test(f.formType || '') || /contact/i.test(f.description || '')
  );
  if (hasContact) score += 10;

  return clamp(score);
}

// ── Content Types scoring (NEW) ────────────────────────────────

function extractContentTypes(session: any): number | null {
  const ct = session.content_types_data;
  if (!ct) return null;

  const summary: any[] = ct.summary || [];
  const classified: any[] = ct.classified || [];
  if (summary.length === 0 && classified.length === 0) return null;

  const types = summary.length > 0 ? summary : [];
  const totalUrls = types.reduce((sum: number, t: any) => sum + (t.count || 0), 0) || classified.length;

  let score = 0;

  // Has multiple content types (30 pts)
  if (types.length >= 4) score += 30;
  else if (types.length >= 2) score += 20;
  else if (types.length >= 1) score += 10;
  else score += 5;

  // Has blog/post type content (20 pts)
  const hasPosts = types.some((t: any) => t.baseType === 'Post' || /post|blog|article/i.test(t.name || ''));
  if (hasPosts) score += 20;

  // Has structured/custom post types (20 pts)
  const hasCPT = types.some((t: any) => t.baseType === 'CPT' || /case.stud|portfolio|testimonial|team/i.test(t.name || ''));
  if (hasCPT) score += 20;

  // Content volume (20 pts)
  if (totalUrls >= 50) score += 20;
  else if (totalUrls >= 20) score += 15;
  else if (totalUrls >= 10) score += 10;
  else score += 5;

  // Classification confidence (10 pts)
  if (classified.length > 0) {
    const highConf = classified.filter((c: any) => c.confidence === 'high' || (c.confidence_score && c.confidence_score > 0.8)).length;
    score += Math.round((highConf / classified.length) * 10);
  } else {
    score += 5;
  }

  return clamp(score);
}

// ── Sitemap Coverage scoring (NEW) ─────────────────────────────

function extractSitemapCoverage(session: any): number | null {
  const sm = session.sitemap_data;
  const discovered = session.discovered_urls;
  if (!sm?.found || !Array.isArray(discovered) || !discovered.length) return null;

  const sitemapCount = sm.stats?.totalUrls || 0;
  if (sitemapCount === 0) return 20;

  const coverageRatio = sitemapCount / discovered.length;
  // Ideal: 80-120% coverage
  if (coverageRatio >= 0.8 && coverageRatio <= 1.2) return clamp(90 + (coverageRatio - 0.8) * 25);
  if (coverageRatio >= 0.5) return clamp(60 + (coverageRatio - 0.5) * 100);
  return clamp(coverageRatio * 120);
}

// ── GA4 scoring ────────────────────────────────────────────────

function extractGa4(session: any): number | null {
  const ga4 = session.ga4_data;
  if (!ga4) return null;

  let score = 0;
  let factors = 0;

  if (ga4.engagementRate != null) {
    score += clamp(ga4.engagementRate * 100);
    factors++;
  }

  if (ga4.bounceRate != null) {
    score += clamp((1 - ga4.bounceRate) * 100);
    factors++;
  }

  if (ga4.sessionsPerUser != null) {
    score += clamp(Math.min(ga4.sessionsPerUser / 5, 1) * 100);
    factors++;
  }

  if (ga4.avgSessionDuration != null) {
    score += clamp(Math.min(ga4.avgSessionDuration / 180, 1) * 100);
    factors++;
  }

  return factors > 0 ? clamp(score / factors) : null;
}

// ── Search Console scoring ─────────────────────────────────────

function extractSearchConsole(session: any): number | null {
  const gsc = session.search_console_data;
  if (!gsc) return null;

  let score = 0;
  let factors = 0;

  if (gsc.ctr != null) {
    score += clamp(Math.min(gsc.ctr / 0.08, 1) * 100);
    factors++;
  }

  if (gsc.position != null) {
    score += clamp(Math.max(0, (1 - (gsc.position - 1) / 49)) * 100);
    factors++;
  }

  if (gsc.indexedPages != null && gsc.totalPages != null && gsc.totalPages > 0) {
    score += clamp((gsc.indexedPages / gsc.totalPages) * 100);
    factors++;
  }

  if (gsc.impressions != null && gsc.impressions > 0) {
    score += clamp(Math.min(Math.log10(gsc.impressions) / 4, 1) * 100);
    factors++;
  }

  return factors > 0 ? clamp(score / factors) : null;
}

// ── Summarize helpers ──────────────────────────────────────────

function summarizeByScore(label: string, score: number): string {
  if (score >= 90) return `${label} score of ${score} — excellent`;
  if (score >= 80) return `${label} score of ${score} — good`;
  if (score >= 70) return `${label} score of ${score} — needs improvement`;
  if (score >= 60) return `${label} score of ${score} — below average`;
  return `${label} score of ${score} — poor`;
}

// ── Category definitions ───────────────────────────────────────

export const CATEGORY_DEFS: { key: CategoryKey; label: string; weight: number; integrations: IntegrationDef[] }[] = [
  {
    key: 'performance',
    label: 'Performance',
    weight: 25,
    integrations: [
      { key: 'gtmetrix', label: 'GTmetrix', weight: 30, extract: extractGtmetrix,
        summarize: (s, sc) => summarizeByScore('GTmetrix performance', sc) },
      { key: 'psi-performance', label: 'PageSpeed', weight: 30, extract: extractPsiPerformance,
        summarize: (s, sc) => summarizeByScore('Lighthouse performance', sc) },
      { key: 'crux', label: 'CrUX', weight: 20, extract: extractCrux,
        summarize: (s, sc) => sc >= 75 ? `${sc}% of real users have good Core Web Vitals` : `Only ${sc}% of real users have good Core Web Vitals` },
      { key: 'yellowlab', label: 'YellowLab', weight: 10, extract: extractYellowLab,
        summarize: (s, sc) => summarizeByScore('Code quality', sc) },
      { key: 'psi-best-practices', label: 'Best Practices', weight: 5, extract: extractPsiBestPractices,
        summarize: (s, sc) => summarizeByScore('Best practices', sc) },
      { key: 'carbon', label: 'Website Carbon', weight: 5, extract: extractCarbon,
        summarize: (s, sc) => `Cleaner than ${sc}% of websites tested` },
    ],
  },
  {
    key: 'seo',
    label: 'SEO & Search',
    weight: 22,
    integrations: [
      { key: 'psi-seo', label: 'Lighthouse SEO', weight: 30, extract: extractPsiSeo,
        summarize: (s, sc) => summarizeByScore('On-page SEO', sc) },
      { key: 'semrush', label: 'SEMrush', weight: 25, extract: extractSemrush,
        summarize: (s, sc) => `Domain authority score of ${sc}` },
      { key: 'search-console', label: 'Search Console', weight: 20, extract: extractSearchConsole,
        summarize: (s, sc) => summarizeByScore('Search performance', sc) },
      { key: 'schema', label: 'Schema.org', weight: 15, extract: extractSchema,
        summarize: (s, sc) => {
          const errors = (s.schema_data?.errors?.length ?? 0) + (s.schema_data?.invalidSchemas?.length ?? 0);
          return errors === 0 ? 'Clean structured data with no errors' : `${errors} structured data error${errors > 1 ? 's' : ''} detected`;
        }},
      { key: 'sitemap', label: 'XML Sitemap', weight: 10, extract: extractSitemap,
        summarize: (s, sc) => s.sitemap_data?.found ? `XML sitemap found with ${s.sitemap_data?.stats?.totalUrls || 0} URLs` : 'No XML sitemap found' },
    ],
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    weight: 15,
    integrations: [
      { key: 'psi-accessibility', label: 'Lighthouse', weight: 40, extract: extractPsiAccessibility,
        summarize: (s, sc) => summarizeByScore('Lighthouse accessibility', sc) },
      { key: 'wave', label: 'WAVE', weight: 40, extract: extractWave,
        summarize: (s, sc) => {
          const errors = s.wave_data?.categories?.error?.count ?? s.wave_data?.summary?.errors ?? 0;
          return errors === 0 ? 'No WAVE accessibility errors detected' : `${errors} accessibility error${errors > 1 ? 's' : ''} detected by WAVE`;
        }},
      { key: 'w3c', label: 'W3C', weight: 20, extract: extractW3c,
        summarize: (s, sc) => summarizeByScore('W3C validation', sc) },
    ],
  },
  {
    key: 'security',
    label: 'Security',
    weight: 13,
    integrations: [
      { key: 'observatory', label: 'Observatory', weight: 55, extract: extractObservatory,
        summarize: (s, sc) => {
          const grade = s.observatory_data?.grade || scoreToGrade(sc);
          return `Mozilla Observatory grade: ${grade}`;
        }},
      { key: 'ssllabs', label: 'SSL Labs', weight: 45, extract: extractSslLabs,
        summarize: (s, sc) => {
          const grade = s.ssllabs_data?.endpoints?.[0]?.grade || s.ssllabs_data?.grade || scoreToGrade(sc);
          return `SSL/TLS grade: ${grade}`;
        }},
    ],
  },
  {
    key: 'content-ux',
    label: 'Content & UX',
    weight: 15,
    integrations: [
      { key: 'navigation', label: 'Navigation', weight: 25, extract: extractNavigation,
        summarize: (s, sc) => {
          const nav = s.nav_structure;
          const topLevel = (nav?.primary || nav?.items || []).length;
          return sc >= 75 ? `Well-structured navigation with ${topLevel} top-level items` : `Navigation structure needs improvement (${topLevel} top-level items)`;
        }},
      { key: 'readable', label: 'Readability', weight: 20, extract: extractReadable,
        summarize: (s, sc) => sc >= 60 ? `Content is readable (Flesch score: ${sc})` : `Content readability is low (Flesch score: ${sc})` },
      { key: 'forms', label: 'Forms', weight: 20, extract: extractForms,
        summarize: (s, sc) => {
          const count = s.forms_data?.summary?.uniqueForms ?? s.forms_data?.forms?.length ?? 0;
          return count === 0 ? 'No forms detected — consider adding contact or lead capture' : `${count} form${count > 1 ? 's' : ''} detected across the site`;
        }},
      { key: 'content-types', label: 'Content Types', weight: 20, extract: extractContentTypes,
        summarize: (s, sc) => {
          const types = s.content_types_data?.summary?.length ?? 0;
          return types >= 3 ? `${types} content types — good content diversity` : types > 0 ? `${types} content type${types > 1 ? 's' : ''} — limited diversity` : 'Content type classification unavailable';
        }},
      { key: 'ga4', label: 'GA4 Engagement', weight: 15, extract: extractGa4,
        summarize: (s, sc) => summarizeByScore('User engagement', sc) },
    ],
  },
  {
    key: 'url-health',
    label: 'URL Health',
    weight: 10,
    integrations: [
      { key: 'link-checker', label: 'Link Checker', weight: 60, extract: extractLinkChecker,
        summarize: (s, sc) => {
          const lc = s.linkcheck_data?.summary;
          if (!lc) return 'Link check data unavailable';
          const broken = (lc.clientErrors || 0) + (lc.serverErrors || 0) + (lc.failures || 0);
          return broken === 0 ? `All ${lc.total} links are healthy` : `${broken} broken link${broken > 1 ? 's' : ''} out of ${lc.total} checked`;
        }},
      { key: 'httpstatus', label: 'HTTP Status', weight: 25, extract: extractHttpStatusDetailed,
        summarize: (s, sc) => {
          const hs = s.httpstatus_data;
          const redirects = hs?.redirectCount ?? 0;
          return redirects === 0 ? 'Direct access with no redirects' : `${redirects} redirect${redirects > 1 ? 's' : ''} in chain`;
        }},
      { key: 'sitemap-coverage', label: 'Sitemap Coverage', weight: 15, extract: extractSitemapCoverage,
        summarize: (s, sc) => {
          const sm = s.sitemap_data?.stats?.totalUrls || 0;
          const disc = Array.isArray(s.discovered_urls) ? s.discovered_urls.length : 0;
          return disc > 0 ? `Sitemap covers ${Math.round((sm / disc) * 100)}% of discovered URLs` : 'Sitemap coverage check unavailable';
        }},
    ],
  },
];

// ── Main computation ───────────────────────────────────────────

function classifySignal(key: string, label: string, score: number, summary: string): ScoreSignal {
  return {
    key, label, score, summary,
    type: score >= 80 ? 'strength' : score <= 50 ? 'gap' : 'neutral',
  };
}

export function computeOverallScore(session: any): OverallScore | null {
  if (!session) return null;

  const categories: CategoryScore[] = [];

  for (const catDef of CATEGORY_DEFS) {
    const integrations: IntegrationScore[] = [];
    const strengths: ScoreSignal[] = [];
    const gaps: ScoreSignal[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const intDef of catDef.integrations) {
      const score = intDef.extract(session);
      if (score != null) {
        integrations.push({ key: intDef.key, label: intDef.label, score });
        weightedSum += score * intDef.weight;
        totalWeight += intDef.weight;

        const summary = intDef.summarize(session, score);
        const signal = classifySignal(intDef.key, intDef.label, score, summary);
        if (signal.type === 'strength') strengths.push(signal);
        else if (signal.type === 'gap') gaps.push(signal);
      }
    }

    if (integrations.length > 0) {
      const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;
      categories.push({
        key: catDef.key,
        label: catDef.label,
        score: Math.round(avg),
        grade: scoreToGrade(avg),
        weight: catDef.weight,
        integrations,
        strengths: strengths.sort((a, b) => b.score - a.score),
        gaps: gaps.sort((a, b) => a.score - b.score),
      });
    }
  }

  if (categories.length === 0) return null;

  // Weighted average with redistributed weights for missing categories
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = categories.reduce((sum, c) => sum + c.score * (c.weight / totalWeight), 0);
  const overall = Math.round(weightedSum);

  // Aggregate top signals
  const allStrengths = categories.flatMap(c => c.strengths).sort((a, b) => b.score - a.score);
  const allGaps = categories.flatMap(c => c.gaps).sort((a, b) => a.score - b.score);

  return {
    score: overall,
    grade: scoreToGrade(overall),
    categories,
    topStrengths: allStrengths.slice(0, 5),
    topGaps: allGaps.slice(0, 5),
    version: '1.0',
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
  'section-url-analysis': 'url-health',
  'section-performance': 'performance',
  'section-seo': 'seo',
  'section-ux-accessibility': 'accessibility',
  'section-security': 'security',
  'section-content-analysis': 'content-ux',
  // 'section-tech-detection' — no longer scored (descriptive only)
  // 'section-design-analysis' — never scored
};
