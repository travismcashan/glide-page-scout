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
  apollo_data?: any;
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
  const excluded = new Set(data.excludedMeetings || []);
  const meetings = (data.meetings || []).filter((m: any) => !excluded.has(m.uuid));
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

function extractApollo(data: any): string | null {
  if (!data || !data.found) return null;
  const parts: string[] = [];
  // Person
  if (data.name) parts.push(`Contact: ${data.name}`);
  if (data.title) parts.push(`Title: ${data.title}`);
  if (data.headline && data.headline !== data.title) parts.push(`Headline: ${data.headline}`);
  if (data.email) parts.push(`Email: ${data.email} (${data.emailStatus || 'unknown'})`);
  if (data.phone) parts.push(`Phone: ${data.phone}`);
  if (data.linkedinUrl) parts.push(`LinkedIn: ${data.linkedinUrl}`);
  if (data.twitterUrl) parts.push(`Twitter: ${data.twitterUrl}`);
  if (data.timeZone) parts.push(`Timezone: ${data.timeZone}`);
  const loc = [data.city, data.state, data.country].filter(Boolean).join(', ');
  if (loc) parts.push(`Location: ${loc}`);
  if (data.seniority) parts.push(`Seniority: ${data.seniority}`);
  if (data.departments?.length) parts.push(`Departments: ${data.departments.join(', ')}`);
  if (data.subdepartments?.length) parts.push(`Subdepartments: ${data.subdepartments.join(', ')}`);
  if (data.functions?.length) parts.push(`Functions: ${data.functions.join(', ')}`);
  if (data.isLikelyToEngage != null) parts.push(`Likely to engage: ${data.isLikelyToEngage ? 'Yes' : 'No'}`);
  // Organization
  if (data.organizationName) {
    parts.push(`\nCompany: ${data.organizationName}`);
    if (data.organizationDomain) parts.push(`Domain: ${data.organizationDomain}`);
    if (data.organizationIndustry) parts.push(`Industry: ${data.organizationIndustry}`);
    if (data.organizationSize) parts.push(`Employees: ${data.organizationSize}`);
    if (data.organizationFounded) parts.push(`Founded: ${data.organizationFounded}`);
    if (data.organizationRevenue) parts.push(`Revenue: ${data.organizationRevenue}`);
    if (data.organizationDescription) parts.push(`Description: ${data.organizationDescription}`);
    if (data.organizationPubliclyTradedSymbol) parts.push(`Ticker: ${data.organizationPubliclyTradedExchange ? data.organizationPubliclyTradedExchange + ':' : ''}${data.organizationPubliclyTradedSymbol}`);
    if (data.organizationHeadcountGrowth6mo != null) parts.push(`Headcount growth 6mo: ${(data.organizationHeadcountGrowth6mo * 100).toFixed(1)}%`);
    if (data.organizationHeadcountGrowth12mo != null) parts.push(`Headcount growth 12mo: ${(data.organizationHeadcountGrowth12mo * 100).toFixed(1)}%`);
    if (data.organizationHeadcountGrowth24mo != null) parts.push(`Headcount growth 24mo: ${(data.organizationHeadcountGrowth24mo * 100).toFixed(1)}%`);
    if (data.organizationAlexaRanking) parts.push(`Alexa rank: #${data.organizationAlexaRanking}`);
    const orgLoc = [data.organizationCity, data.organizationState, data.organizationCountry].filter(Boolean).join(', ');
    if (orgLoc) parts.push(`HQ: ${orgLoc}`);
    if (data.organizationTechnologies?.length) parts.push(`Technologies: ${data.organizationTechnologies.slice(0, 20).join(', ')}`);
    if (data.organizationKeywords?.length) parts.push(`Keywords: ${data.organizationKeywords.slice(0, 15).join(', ')}`);
    if (data.organizationSicCodes?.length) parts.push(`SIC: ${data.organizationSicCodes.join(', ')}`);
    if (data.organizationNaicsCodes?.length) parts.push(`NAICS: ${data.organizationNaicsCodes.join(', ')}`);
  }
  // Employment history
  if (data.employmentHistory?.length) {
    parts.push(`\nEmployment history (${data.employmentHistory.length} positions):`);
    for (const job of data.employmentHistory.slice(0, 10)) {
      const dates = [job.startDate, job.endDate || (job.current ? 'Present' : '')].filter(Boolean).join(' – ');
      parts.push(`  ${job.title} at ${job.organizationName}${dates ? ` (${dates})` : ''}`);
    }
  }
  return parts.length ? parts.join('\n') : null;
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
  sections.push(`PRIORITY: Avoma call transcripts and meeting data represent direct conversations with the client and are the HIGHEST-VALUE source of truth. Always weigh information from calls and meetings more heavily than automated crawl data. Client statements, concerns, and context from meetings should anchor all analysis and recommendations.\n`);

  const addSection = (label: string, content: string | null) => {
    if (content) sections.push(`## [Source: ${label}]\n${content}`);
  };

  // ── 🎙️ Avoma Call Transcripts (HIGHEST PRIORITY — placed first for maximum AI attention) ──
  addSection('Avoma Call Transcripts & Meetings (PRIMARY SOURCE — client conversations)', extractAvoma(session.avoma_data));

  // ── 🔧 Technology Detection ──
  addSection('BuiltWith Technology Stack', extractBuiltWith(session.builtwith_data));
  addSection('Wappalyzer Technology Profiling', extractWappalyzer(session.wappalyzer_data));

  // ── ⚡ Performance & Sustainability ──
  addSection('GTmetrix Performance Report', extractGtmetrix(session.gtmetrix_grade, session.gtmetrix_scores));
  addSection('PageSpeed Insights (Lighthouse)', extractPageSpeed(session.psi_data));
  addSection('Chrome UX Report (CrUX)', extractCrux(session.crux_data));
  addSection('Website Carbon Sustainability', extractCarbon(session.carbon_data));
  addSection('Yellow Lab Tools Front-End Quality', extractYellowLab(session.yellowlab_data));

  // ── 🔍 SEO & Search ──
  addSection('SEMrush Domain Analysis', extractSemrush(session.semrush_data));
  addSection('Schema.org Structured Data', extractSchema(session.schema_data));

  // ── 📄 Content & Scraping ──
  if (pages?.length) {
    const pageLines: string[] = [];
    const seenContentHashes = new Set<string>();

    for (const p of pages) {
      const content = p.ai_outline || (p.raw_content ? p.raw_content.substring(0, 3000) : null);
      if (!content) continue;

      const contentFingerprint = content.substring(0, 500).replace(/\s+/g, ' ').trim();
      if (seenContentHashes.has(contentFingerprint)) continue;
      seenContentHashes.add(contentFingerprint);

      pageLines.push(`### ${p.title || p.url}\nURL: ${p.url}`);
      if (p.screenshot_url) {
        pageLines.push(`Screenshot: ${p.screenshot_url}`);
      }
      pageLines.push(content);
      pageLines.push('');
    }
    if (pageLines.length) {
      addSection('Scraped Page Content', pageLines.join('\n'));
    }
  }
  addSection('Readable.com Readability Score', extractReadable(session.readable_data));

  // ── 🎨 UX & Accessibility ──
  addSection('WAVE Accessibility Scan', extractWave(session.wave_data));
  addSection('W3C HTML/CSS Validator', extractW3c(session.w3c_data));

  // ── 🛡️ Security & Compliance ──
  addSection('Mozilla Observatory Security Headers', extractObservatory(session.observatory_data));
  addSection('SSL Labs TLS/SSL Assessment', extractSslLabs(session.ssllabs_data));
  addSection('httpstatus.io Redirect Chain', extractHttpStatus(session.httpstatus_data));
  

  // ── 🗺️ Site Structure ──
  if (session.nav_structure) {
    const nav = session.nav_structure;
    const parts: string[] = [];
    if (nav.primary?.length) parts.push(`Primary nav: ${nav.primary.map((n: any) => n.label || n.text || n.url).join(', ')}`);
    if (nav.secondary?.length) parts.push(`Secondary nav: ${nav.secondary.map((n: any) => n.label || n.text || n.url).join(', ')}`);
    if (nav.footer?.length) parts.push(`Footer nav: ${nav.footer.map((n: any) => n.label || n.text || n.url).join(', ')}`);
    if (parts.length) addSection('Site Navigation Structure', parts.join('\n'));
  }

  if (session.sitemap_data) {
    const sm = session.sitemap_data;
    const parts: string[] = [];
    if (sm.totalUrls) parts.push(`Total URLs in sitemap: ${sm.totalUrls}`);
    if (sm.sitemaps?.length) parts.push(`Sitemaps found: ${sm.sitemaps.length}`);
    if (parts.length) addSection('Sitemap Analysis', parts.join('\n'));
  }

  if (session.content_types_data) {
    const ct = session.content_types_data;
    if (ct.types && typeof ct.types === 'object') {
      const lines = Object.entries(ct.types).map(([type, urls]: [string, any]) =>
        `${type}: ${Array.isArray(urls) ? urls.length : 0} pages`
      );
      if (lines.length) addSection('Content Type Classification', lines.join('\n'));
    }
  }

  if (session.forms_data) {
    const fd = session.forms_data;
    const parts: string[] = [];
    if (fd.totalForms != null) parts.push(`Total forms detected: ${fd.totalForms}`);
    if (fd.forms?.length) {
      for (const f of fd.forms.slice(0, 10)) {
        parts.push(`Form on ${f.url}: ${f.fields?.length || 0} fields, action=${f.action || 'none'}`);
      }
    }
    if (parts.length) addSection('Forms Detection', parts.join('\n'));
  }

  // ── 🧲 Enrichment & Prospecting ──
  if (session.hubspot_data) {
    const hb = session.hubspot_data;
    const parts: string[] = [];
    if (hb.contacts?.length) {
      parts.push(`HubSpot contacts found: ${hb.contacts.length}`);
      for (const c of hb.contacts.slice(0, 5)) {
        const name = [c.firstname, c.lastname].filter(Boolean).join(' ') || c.email;
        parts.push(`  ${name} — ${c.jobtitle || 'No title'} (${c.email || 'no email'})`);
      }
    }
    if (hb.company) {
      parts.push(`Company: ${hb.company.name || hb.company.domain}`);
      if (hb.company.industry) parts.push(`Industry: ${hb.company.industry}`);
    }
    if (parts.length) addSection('HubSpot CRM Data', parts.join('\n'));
  }

  addSection('Ocean.io Firmographics', extractOcean(session.ocean_data));
  addSection('Apollo.io Contact Enrichment', extractApollo(session.apollo_data));

  // ── 🔧 Tech Analysis ──
  if (session.detectzestack_data) {
    const dz = session.detectzestack_data;
    if (dz.grouped) {
      const parts: string[] = [];
      for (const [cat, techs] of Object.entries(dz.grouped) as [string, any[]][]) {
        parts.push(`${cat}: ${techs.map((t: any) => t.name || t).join(', ')}`);
      }
      if (parts.length) addSection('DetectZeStack Technology Detection', parts.join('\n'));
    }
  }

  if (session.tech_analysis_data?.analysis) {
    addSection('AI Technology Analysis', session.tech_analysis_data.analysis);
  }


  return sections.join('\n\n');

  return sections.join('\n\n');
}
