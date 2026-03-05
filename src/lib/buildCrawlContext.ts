/**
 * Shared utility: build a curated, token-efficient context string
 * from session integrations + scraped pages for AI tools
 * (Deep Research, Observations & Insights).
 *
 * Priority order:
 *  1. Avoma transcripts (full — most valuable signal)
 *  2. Scraped page content (outlines preferred)
 *  3. High-signal integrations (key metrics only)
 *  4. Medium/low-signal integrations (compact summaries)
 */

type SessionData = {
  domain: string;
  base_url: string;
  avoma_data?: any;
  ocean_data?: any;
  semrush_data?: any;
  psi_data?: any;
  crux_data?: any;
  builtwith_data?: any;
  wappalyzer_data?: any;
  wave_data?: any;
  observatory_data?: any;
  ssllabs_data?: any;
  httpstatus_data?: any;
  linkcheck_data?: any;
  w3c_data?: any;
  schema_data?: any;
  readable_data?: any;
  carbon_data?: any;
  yellowlab_data?: any;
  gtmetrix_grade?: string | null;
  gtmetrix_scores?: any;
  [key: string]: any;
};

type PageData = {
  url: string;
  title: string | null;
  ai_outline: string | null;
  raw_content: string | null;
  screenshot_url?: string | null;
};

// ── Per-integration extractors ──────────────────────────────────

function extractAvoma(data: any): string | null {
  if (!data) return null;
  const meetings = data.meetings || [];
  if (!meetings.length) return null;

  const lines: string[] = [`Found ${data.totalMatches || meetings.length} meetings with domain participants.\n`];

  for (const m of meetings) {
    lines.push(`### Meeting: ${m.subject || 'Untitled'}`);
    lines.push(`Date: ${m.startTime || 'unknown'} | Duration: ${m.duration || '?'} min`);
    if (m.attendees?.length) {
      lines.push(`Attendees: ${m.attendees.map((a: any) => a.name || a.email).join(', ')}`);
    }
    // Full transcript — this is the highest-value data
    if (m.transcript?.sentences?.length) {
      lines.push('\n**Full Transcript:**');
      for (const s of m.transcript.sentences) {
        lines.push(`[${s.speakerName || 'Speaker'}]: ${s.text}`);
      }
    }
    if (m.insights) {
      lines.push(`\n**AI Notes/Insights:** ${JSON.stringify(m.insights)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function extractOcean(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.companyName) parts.push(`Company: ${data.companyName}`);
  if (data.primaryCountry) parts.push(`HQ: ${data.primaryCountry}`);
  if (data.companySize) parts.push(`Size: ${data.companySize}`);
  if (data.industries?.length) parts.push(`Industries: ${data.industries.join(', ')}`);
  if (data.yearFounded) parts.push(`Founded: ${data.yearFounded}`);
  if (data.revenue) parts.push(`Revenue: ${data.revenue}`);
  if (data.description) parts.push(`Description: ${data.description}`);
  if (data.linkedinUrl) parts.push(`LinkedIn: ${data.linkedinUrl}`);
  if (data.technologies?.length) parts.push(`Tech stack: ${data.technologies.slice(0, 20).join(', ')}`);
  return parts.length ? parts.join('\n') : null;
}

function extractSemrush(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.overview?.length) {
    const o = data.overview[0];
    if (o.Or) parts.push(`Organic keywords: ${o.Or}`);
    if (o.Ot) parts.push(`Organic traffic: ${o.Ot}`);
    if (o.Oc) parts.push(`Organic traffic cost: $${o.Oc}`);
    if (o.Ad) parts.push(`Paid keywords: ${o.Ad}`);
    if (o.At) parts.push(`Paid traffic: ${o.At}`);
    if (o.Ac) parts.push(`Paid traffic cost: $${o.Ac}`);
  }
  if (data.organicKeywords?.length) {
    parts.push(`\nTop organic keywords (${Math.min(data.organicKeywords.length, 20)} shown):`);
    for (const kw of data.organicKeywords.slice(0, 20)) {
      parts.push(`  "${kw.Ph}" — pos ${kw.Po}, vol ${kw.Nq}, traffic ${kw.Tr}`);
    }
  }
  if (data.backlinks) {
    const b = data.backlinks;
    if (b.total) parts.push(`\nBacklinks: ${b.total} total, ${b.domains_num || '?'} referring domains`);
  }
  return parts.length ? parts.join('\n') : null;
}

function extractPageSpeed(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  for (const strategy of ['mobile', 'desktop'] as const) {
    const d = data[strategy];
    if (!d) continue;
    const cat = d.categories || {};
    const scores: string[] = [];
    if (cat.performance?.score != null) scores.push(`Perf: ${Math.round(cat.performance.score * 100)}`);
    if (cat.accessibility?.score != null) scores.push(`A11y: ${Math.round(cat.accessibility.score * 100)}`);
    if (cat['best-practices']?.score != null) scores.push(`BP: ${Math.round(cat['best-practices'].score * 100)}`);
    if (cat.seo?.score != null) scores.push(`SEO: ${Math.round(cat.seo.score * 100)}`);
    if (scores.length) parts.push(`${strategy}: ${scores.join(', ')}`);

    // Key web vitals from audits
    const audits = d.audits || {};
    const vitals: string[] = [];
    for (const key of ['largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'first-contentful-paint', 'speed-index', 'interactive']) {
      const a = audits[key];
      if (a?.displayValue) vitals.push(`${a.title || key}: ${a.displayValue}`);
    }
    if (vitals.length) parts.push(`  Vitals: ${vitals.join(' | ')}`);
  }
  return parts.length ? parts.join('\n') : null;
}

function extractCrux(data: any): string | null {
  if (!data || data.noData) return null;
  const parts: string[] = [];
  for (const ff of ['overall', 'phone', 'desktop'] as const) {
    const d = data[ff];
    if (!d?.metrics) continue;
    const metrics: string[] = [];
    for (const [k, v] of Object.entries(d.metrics) as [string, any][]) {
      if (v?.percentiles?.p75 != null) metrics.push(`${k}: p75=${v.percentiles.p75}`);
    }
    if (metrics.length) parts.push(`${ff}: ${metrics.join(', ')}`);
  }
  return parts.length ? parts.join('\n') : null;
}

function extractWave(data: any): string | null {
  if (!data?.summary) return null;
  const s = data.summary;
  return `Errors: ${s.errors}, Alerts: ${s.alerts}, Contrast: ${s.contrast}, ARIA: ${s.aria}, Structure: ${s.structure}, Features: ${s.features}`;
}

function extractObservatory(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.grade) parts.push(`Grade: ${data.grade} (Score: ${data.score || '?'})`);
  if (data.tests) {
    const failed = Object.entries(data.tests)
      .filter(([, v]: [string, any]) => v.pass === false)
      .map(([k]: [string, any]) => k);
    if (failed.length) parts.push(`Failed tests: ${failed.join(', ')}`);
  }
  return parts.length ? parts.join('\n') : null;
}

function extractSslLabs(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.grade) parts.push(`Grade: ${data.grade}`);
  if (data.endpoints?.length) {
    for (const ep of data.endpoints.slice(0, 3)) {
      parts.push(`Endpoint ${ep.ipAddress || '?'}: grade ${ep.grade || '?'}`);
    }
  }
  return parts.length ? parts.join('\n') : null;
}

function extractBuiltWith(data: any): string | null {
  if (!data?.grouped) return null;
  const parts: string[] = [];
  for (const [cat, techs] of Object.entries(data.grouped) as [string, any[]][]) {
    parts.push(`${cat}: ${techs.map((t: any) => t.name).join(', ')}`);
  }
  return parts.length ? parts.join('\n') : null;
}

function extractWappalyzer(data: any): string | null {
  if (!data?.grouped) return null;
  const parts: string[] = [];
  for (const [cat, techs] of Object.entries(data.grouped) as [string, any[]][]) {
    parts.push(`${cat}: ${techs.map((t: any) => t.name || t).join(', ')}`);
  }
  return parts.length ? parts.join('\n') : null;
}

function extractHttpStatus(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.finalStatusCode) parts.push(`Final status: ${data.finalStatusCode}`);
  if (data.redirectCount) parts.push(`Redirects: ${data.redirectCount}`);
  if (data.hops?.length) {
    parts.push(`Chain: ${data.hops.map((h: any) => `${h.statusCode} ${h.url}`).join(' → ')}`);
  }
  return parts.length ? parts.join('\n') : null;
}

function extractLinkCheck(data: any): string | null {
  if (!data?.summary) return null;
  const s = data.summary;
  let out = `Total: ${s.total}, OK: ${s.ok}, Redirects: ${s.redirects}, Client errors: ${s.clientErrors}, Server errors: ${s.serverErrors}`;
  if (data.results?.length) {
    const broken = data.results.filter((r: any) => r.statusCode >= 400 || r.error);
    if (broken.length) {
      out += `\nBroken: ${broken.slice(0, 15).map((r: any) => `${r.url} (${r.statusCode || r.error})`).join(', ')}`;
    }
  }
  return out;
}

function extractW3c(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.html) {
    const h = data.html;
    parts.push(`HTML: ${h.errors?.length || 0} errors, ${h.warnings?.length || 0} warnings`);
  }
  if (data.css) {
    const c = data.css;
    parts.push(`CSS: ${c.errors?.length || 0} errors, ${c.warnings?.length || 0} warnings`);
  }
  return parts.length ? parts.join('\n') : null;
}

function extractSchema(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.summary) parts.push(`Types found: ${JSON.stringify(data.summary)}`);
  if (data.errors?.length) parts.push(`Errors: ${data.errors.length}`);
  if (data.warnings?.length) parts.push(`Warnings: ${data.warnings.length}`);
  return parts.length ? parts.join('\n') : null;
}

function extractReadable(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.readabilityScore != null) parts.push(`Score: ${data.readabilityScore}`);
  if (data.gradeLevel != null) parts.push(`Grade level: ${data.gradeLevel}`);
  if (data.rating) parts.push(`Rating: ${data.rating}`);
  if (data.wordCount) parts.push(`Words: ${data.wordCount}`);
  return parts.length ? parts.join(', ') : null;
}

function extractCarbon(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.rating) parts.push(`Rating: ${data.rating}`);
  if (data.green != null) parts.push(`Green hosting: ${data.green ? 'Yes' : 'No'}`);
  if (data.cleanerThan != null) parts.push(`Cleaner than ${Math.round(data.cleanerThan * 100)}% of sites`);
  if (data.bytes) parts.push(`Page size: ${(data.bytes / 1024).toFixed(0)} KB`);
  return parts.length ? parts.join(', ') : null;
}

function extractYellowLab(data: any): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.globalScore != null) parts.push(`Global score: ${data.globalScore}/100`);
  if (data.categories) {
    for (const [k, v] of Object.entries(data.categories) as [string, any][]) {
      parts.push(`${v.label || k}: ${v.score}/100`);
    }
  }
  return parts.length ? parts.join('\n') : null;
}

function extractGtmetrix(grade?: string | null, scores?: any): string | null {
  if (!grade && !scores) return null;
  const parts: string[] = [];
  if (grade) parts.push(`Grade: ${grade}`);
  if (scores) {
    for (const [k, v] of Object.entries(scores)) {
      parts.push(`${k}: ${v}`);
    }
  }
  return parts.length ? parts.join(', ') : null;
}

// ── Main builder ────────────────────────────────────────────────

export function buildCrawlContext(session: SessionData, pages?: PageData[]): string {
  const sections: string[] = [];
  sections.push(`# Website Audit Data: ${session.domain}\nURL: ${session.base_url}\n`);
  sections.push(`IMPORTANT: The data below comes from specific named integration tools. When referencing findings, always cite the integration by name (e.g. "According to the SEMrush Domain Analysis…", "The WAVE Accessibility scan found…"). Treat each section as a distinct, authoritative source.\n`);

  const addSection = (label: string, content: string | null) => {
    if (content) sections.push(`## [Source: ${label}]\n${content}`);
  };

  // ── PRIORITY 1: Full Avoma transcripts (most valuable) ──
  addSection('Avoma Call Transcripts & Meetings', extractAvoma(session.avoma_data));

  // ── PRIORITY 2: Scraped page content ──
  if (pages?.length) {
    const pageLines: string[] = [];
    for (const p of pages) {
      pageLines.push(`### ${p.title || p.url}\nURL: ${p.url}`);
      if (p.screenshot_url) {
        pageLines.push(`Screenshot: ${p.screenshot_url}`);
      }
      if (p.ai_outline) {
        pageLines.push(p.ai_outline);
      } else if (p.raw_content) {
        pageLines.push(p.raw_content.substring(0, 3000));
      }
      pageLines.push('');
    }
    addSection('Scraped Page Content', pageLines.join('\n'));
  }

  // ── PRIORITY 3: High-signal integrations (key metrics) ──
  addSection('Ocean.io Firmographics', extractOcean(session.ocean_data));
  addSection('SEMrush Domain Analysis', extractSemrush(session.semrush_data));
  addSection('PageSpeed Insights (Lighthouse)', extractPageSpeed(session.psi_data));
  addSection('Chrome UX Report (CrUX)', extractCrux(session.crux_data));

  // ── PRIORITY 4: Medium-signal (compact summaries) ──
  addSection('BuiltWith Technology Stack', extractBuiltWith(session.builtwith_data));
  addSection('Wappalyzer Technology Profiling', extractWappalyzer(session.wappalyzer_data));
  addSection('WAVE Accessibility Scan', extractWave(session.wave_data));
  addSection('Mozilla Observatory Security Headers', extractObservatory(session.observatory_data));
  addSection('SSL Labs TLS/SSL Assessment', extractSslLabs(session.ssllabs_data));
  addSection('GTmetrix Performance Report', extractGtmetrix(session.gtmetrix_grade, session.gtmetrix_scores));

  // ── PRIORITY 5: Low-signal (one-liner summaries) ──
  addSection('httpstatus.io Redirect Chain', extractHttpStatus(session.httpstatus_data));
  addSection('Broken Link Checker', extractLinkCheck(session.linkcheck_data));
  addSection('W3C HTML/CSS Validator', extractW3c(session.w3c_data));
  addSection('Schema.org Structured Data', extractSchema(session.schema_data));
  addSection('Readable.com Readability Score', extractReadable(session.readable_data));
  addSection('Website Carbon Sustainability', extractCarbon(session.carbon_data));
  addSection('Yellow Lab Tools Front-End Quality', extractYellowLab(session.yellowlab_data));

  return sections.join('\n\n');
}
