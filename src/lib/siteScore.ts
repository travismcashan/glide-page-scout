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

export type CategoryKey = 'performance' | 'seo' | 'accessibility' | 'security' | 'content' | 'technology';

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
    weight: 20,
    integrations: [
      { key: 'semrush', label: 'SEMrush', extract: extractSemrush },
      { key: 'psi-seo', label: 'PageSpeed SEO', extract: extractPsiSeo },
      { key: 'schema', label: 'Schema.org', extract: extractSchema },
    ],
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    weight: 20,
    integrations: [
      { key: 'psi-accessibility', label: 'Lighthouse', extract: extractPsiAccessibility },
      { key: 'wave', label: 'WAVE', extract: extractWave },
      { key: 'w3c', label: 'W3C', extract: extractW3c },
    ],
  },
  {
    key: 'security',
    label: 'Security',
    weight: 15,
    integrations: [
      { key: 'observatory', label: 'Observatory', extract: extractObservatory },
      { key: 'ssllabs', label: 'SSL Labs', extract: extractSslLabs },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    weight: 15,
    integrations: [
      { key: 'readable', label: 'Readability', extract: extractReadable },
      { key: 'httpstatus', label: 'HTTP Status', extract: extractHttpStatus },
      { key: 'link-checker', label: 'Broken Links', extract: extractBrokenLinks },
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
  'section-performance': 'performance',
  'section-seo': 'seo',
  'section-ux-accessibility': 'accessibility',
  'section-security': 'security',
  'section-content-analysis': 'content',
  'section-tech-detection': 'technology',
};
