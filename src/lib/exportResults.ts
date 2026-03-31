import JSZip from 'jszip';
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
  carbon_data: any | null;
  crux_data: any | null;
  wave_data: any | null;
  observatory_data: any | null;
  ocean_data: any | null;
  ssllabs_data: any | null;
  httpstatus_data: any | null;
  
  w3c_data: any | null;
  schema_data: any | null;
  readable_data: any | null;
  yellowlab_data: any | null;
  gtmetrix_grade: string | null;
  gtmetrix_scores: any | null;
  gtmetrix_test_id: string | null;
  detectzestack_data?: any | null;
  tech_analysis_data?: any | null;
  deep_research_data?: any | null;
  content_types_data?: any | null;
  nav_structure?: any | null;
  sitemap_data?: any | null;
  forms_data?: any | null;
  apollo_data?: any | null;
  avoma_data?: any | null;
  discovered_urls?: any | null;
  page_tags?: any | null;
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

/** All integration sections with labels and data keys */
function getIntegrationSections(session: ExportSession) {
  return [
    { key: 'builtwith', label: 'BuiltWith', data: session.builtwith_data },
    { key: 'detectzestack', label: 'DetectZeStack', data: session.detectzestack_data },
    { key: 'tech-analysis', label: 'AI Tech Analysis', data: session.tech_analysis_data },
    { key: 'gtmetrix', label: 'GTmetrix', data: session.gtmetrix_grade ? { grade: session.gtmetrix_grade, scores: session.gtmetrix_scores, testId: session.gtmetrix_test_id } : null },
    { key: 'pagespeed', label: 'PageSpeed Insights', data: session.psi_data },
    { key: 'crux', label: 'CrUX Field Data', data: session.crux_data },
    { key: 'yellowlab', label: 'Yellow Lab Tools', data: session.yellowlab_data },
    { key: 'wave', label: 'WAVE Accessibility', data: session.wave_data },
    { key: 'observatory', label: 'Mozilla Observatory', data: session.observatory_data },
    { key: 'ssllabs', label: 'SSL Labs', data: session.ssllabs_data },
    { key: 'semrush', label: 'SEMrush', data: session.semrush_data },
    { key: 'schema', label: 'Schema.org', data: session.schema_data },
    { key: 'httpstatus', label: 'HTTP Status', data: session.httpstatus_data },
    
    { key: 'w3c', label: 'W3C Validation', data: session.w3c_data },
    { key: 'readable', label: 'Readability', data: session.readable_data },
    { key: 'carbon', label: 'Website Carbon', data: session.carbon_data },
    { key: 'ocean', label: 'Ocean.io', data: session.ocean_data },
    { key: 'deep-research', label: 'Deep Research', data: session.deep_research_data },
    { key: 'content-types', label: 'Content Types', data: session.content_types_data },
    { key: 'nav-structure', label: 'Navigation Structure', data: session.nav_structure },
    { key: 'sitemap', label: 'Sitemap', data: session.sitemap_data },
    { key: 'forms', label: 'Forms', data: session.forms_data },
    { key: 'apollo', label: 'Apollo', data: session.apollo_data },
    { key: 'avoma', label: 'Avoma', data: session.avoma_data },
    { key: 'discovered-urls', label: 'Discovered URLs', data: session.discovered_urls },
    { key: 'page-tags', label: 'Page Tags', data: session.page_tags },
  ].filter(s => s.data != null);
}

/** Build a structured object ideal for AI model ingestion */
function buildStructuredExport(session: ExportSession, pages: ExportPage[]) {
  const ts = new Date().toISOString();
  const sections = getIntegrationSections(session);
  const integrations: Record<string, any> = {};
  for (const s of sections) {
    integrations[s.key] = s.data;
  }
  return {
    _meta: {
      exportedAt: ts,
      format: 'site-analysis-v1',
      description: 'Structured site analysis data suitable for AI model ingestion.',
    },
    site: {
      domain: session.domain,
      baseUrl: session.base_url,
      analyzedAt: session.created_at,
      sessionId: session.id,
      status: session.status,
    },
    integrations,
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

/** Download a blob as a file */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

/** Export structured JSON — single combined file */
export function exportAsJson(session: ExportSession, pages: ExportPage[]) {
  const data = buildStructuredExport(session, pages);
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${session.domain}-analysis.json`, 'application/json');
}

/** Export as Markdown — single combined file */
export function exportAsMarkdown(session: ExportSession, pages: ExportPage[]) {
  const data = buildStructuredExport(session, pages);
  const lines: string[] = [];

  lines.push(`# Site Analysis: ${session.domain}`);
  lines.push(`> Analyzed: ${new Date(session.created_at).toLocaleString()}`);
  lines.push(`> URL: ${session.base_url}`);
  lines.push('');

  const sections = getIntegrationSections(session);
  for (const s of sections) {
    lines.push(`## ${s.label}`);
    lines.push('```json');
    lines.push(JSON.stringify(s.data, null, 2));
    lines.push('```');
    lines.push('');
  }

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

/** Export as ZIP — one JSON file per integration */
export async function exportAsZip(session: ExportSession, pages: ExportPage[]) {
  const zip = new JSZip();
  const folder = zip.folder(session.domain)!;

  // Site overview
  folder.file('_site-info.json', JSON.stringify({
    domain: session.domain,
    baseUrl: session.base_url,
    analyzedAt: session.created_at,
    sessionId: session.id,
    status: session.status,
  }, null, 2));

  // One file per integration
  const sections = getIntegrationSections(session);
  for (const s of sections) {
    folder.file(`${s.key}.json`, JSON.stringify(s.data, null, 2));
  }

  // Pages
  if (pages.length > 0) {
    folder.file('pages.json', JSON.stringify(pages.map(p => ({
      url: p.url,
      title: p.title,
      status: p.status,
      screenshotUrl: p.screenshot_url,
      content: p.raw_content ? p.raw_content.slice(0, 5000) : null,
      aiOutline: p.ai_outline,
    })), null, 2));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${session.domain}-analysis.zip`);
}

/** Export as PDF using the browser's print dialog */
export function exportAsPdf() {
  window.print();
}
