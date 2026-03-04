import type { Json } from '@/integrations/supabase/types';

type ExportSession = {
  id: string;
  domain: string;
  base_url: string;
  status: string;
  created_at: string;
  builtwith_data: any | null;
  semrush_data: any | null;
  psi_data: any | null;
  wappalyzer_data: any | null;
  carbon_data: any | null;
  crux_data: any | null;
  wave_data: any | null;
  observatory_data: any | null;
  ocean_data: any | null;
  ssllabs_data: any | null;
  httpstatus_data: any | null;
  linkcheck_data: any | null;
  w3c_data: any | null;
  schema_data: any | null;
  readable_data: any | null;
  yellowlab_data: any | null;
  gtmetrix_grade: string | null;
  gtmetrix_scores: any | null;
  gtmetrix_test_id: string | null;
};

type ExportPage = {
  id: string;
  url: string;
  title: string | null;
  raw_content: string | null;
  ai_outline: string | null;
  screenshot_url: string | null;
  status: string;
};

/** Build a structured object ideal for AI model ingestion */
function buildStructuredExport(session: ExportSession, pages: ExportPage[]) {
  const ts = new Date().toISOString();
  return {
    _meta: {
      exportedAt: ts,
      format: 'site-analysis-v1',
      description: 'Structured site analysis data suitable for AI model ingestion. Each integration section contains raw results from third-party APIs.',
    },
    site: {
      domain: session.domain,
      baseUrl: session.base_url,
      analyzedAt: session.created_at,
      sessionId: session.id,
      status: session.status,
    },
    technologyStack: {
      builtwith: session.builtwith_data ?? null,
      wappalyzer: session.wappalyzer_data ?? null,
    },
    performance: {
      gtmetrix: session.gtmetrix_grade
        ? { grade: session.gtmetrix_grade, scores: session.gtmetrix_scores, testId: session.gtmetrix_test_id }
        : null,
      pageSpeedInsights: session.psi_data ?? null,
      crux: session.crux_data ?? null,
      yellowLabTools: session.yellowlab_data ?? null,
    },
    accessibility: {
      wave: session.wave_data ?? null,
      lighthouseAccessibility: session.psi_data
        ? { note: 'Derived from PageSpeed Insights data — see performance.pageSpeedInsights' }
        : null,
    },
    security: {
      observatory: session.observatory_data ?? null,
      sslLabs: session.ssllabs_data ?? null,
    },
    seo: {
      semrush: session.semrush_data ?? null,
      schema: session.schema_data ?? null,
      httpStatus: session.httpstatus_data ?? null,
      brokenLinks: session.linkcheck_data ?? null,
    },
    codeQuality: {
      w3cValidation: session.w3c_data ?? null,
      readability: session.readable_data ?? null,
    },
    sustainability: {
      websiteCarbon: session.carbon_data ?? null,
    },
    firmographics: {
      ocean: session.ocean_data ?? null,
    },
    pages: pages.map(p => ({
      url: p.url,
      title: p.title,
      status: p.status,
      screenshotUrl: p.screenshot_url,
      content: p.raw_content ? p.raw_content.slice(0, 5000) : null,
      aiOutline: p.ai_outline,
    })),
  };
}

/** Download a JSON blob as a file */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export structured JSON for AI ingestion */
export function exportAsJson(session: ExportSession, pages: ExportPage[]) {
  const data = buildStructuredExport(session, pages);
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${session.domain}-analysis.json`, 'application/json');
}

/** Export as Markdown — a more readable format that also works well for AI */
export function exportAsMarkdown(session: ExportSession, pages: ExportPage[]) {
  const data = buildStructuredExport(session, pages);
  const lines: string[] = [];

  lines.push(`# Site Analysis: ${session.domain}`);
  lines.push(`> Analyzed: ${new Date(session.created_at).toLocaleString()}`);
  lines.push(`> URL: ${session.base_url}`);
  lines.push('');

  const addSection = (title: string, obj: any) => {
    if (!obj) return;
    lines.push(`## ${title}`);
    lines.push('```json');
    lines.push(JSON.stringify(obj, null, 2));
    lines.push('```');
    lines.push('');
  };

  addSection('Technology Stack — BuiltWith', data.technologyStack.builtwith);
  addSection('Technology Stack — Wappalyzer', data.technologyStack.wappalyzer);
  addSection('Performance — GTmetrix', data.performance.gtmetrix);
  addSection('Performance — PageSpeed Insights', data.performance.pageSpeedInsights);
  addSection('Performance — CrUX Field Data', data.performance.crux);
  addSection('Performance — Yellow Lab Tools', data.performance.yellowLabTools);
  addSection('Accessibility — WAVE', data.accessibility.wave);
  addSection('Security — Mozilla Observatory', data.security.observatory);
  addSection('Security — SSL Labs', data.security.sslLabs);
  addSection('SEO — SEMrush', data.seo.semrush);
  addSection('SEO — Schema.org', data.seo.schema);
  addSection('SEO — HTTP Status & Redirects', data.seo.httpStatus);
  addSection('SEO — Broken Links', data.seo.brokenLinks);
  addSection('Code Quality — W3C Validation', data.codeQuality.w3cValidation);
  addSection('Code Quality — Readability', data.codeQuality.readability);
  addSection('Sustainability — Website Carbon', data.sustainability.websiteCarbon);
  addSection('Firmographics — Ocean.io', data.firmographics.ocean);

  if (data.pages.length > 0) {
    lines.push('## Analyzed Pages');
    for (const p of data.pages) {
      lines.push(`### ${p.title || p.url}`);
      lines.push(`- URL: ${p.url}`);
      lines.push(`- Status: ${p.status}`);
      if (p.aiOutline) {
        lines.push('');
        lines.push('#### AI Content Outline');
        lines.push(p.aiOutline);
      }
      lines.push('');
    }
  }

  downloadFile(lines.join('\n'), `${session.domain}-analysis.md`, 'text/markdown');
}

/** Export as PDF using the browser's print dialog */
export function exportAsPdf() {
  window.print();
}
