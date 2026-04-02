/**
 * Generates a GLIDE-branded PDF document via DocRaptor (Prince XML engine).
 *
 * Template matches the "GLIDE Executive Brief" format:
 * - Cover page with logo, title, subtitle, domain, prepared-by block
 * - Interior pages with header (logo + doc info) and footer (contact line)
 * - Larsseit font family, clean layout, simple tables
 *
 * Uses DocRaptor API via Supabase edge function for pixel-perfect PDF output.
 */

export interface GlideDocumentOptions {
  title: string;
  subtitle?: string;
  clientDomain?: string;
  companyName?: string;
  preparedBy?: {
    name: string;
    title: string;
    company: string;
    email: string;
    phone: string;
  };
  sections: string; // Markdown content for body pages
}

const DEFAULT_PREPARED_BY = {
  name: 'Travis McAshan',
  title: 'Founder & CEO',
  company: 'GLIDE LLC',
  email: 'travis@glidedesign.com',
  phone: '512-215-4992',
};

// Official GLIDE logo SVGs (from brand assets)
const GLIDE_LOGO_SVG = `<svg class="glide-logo" viewBox="0 0 472 124" xmlns="http://www.w3.org/2000/svg">
  <g fill="#0A0B0C">
    <path d="M127.319,2H62.347C29.289,2,2.216,28.896,1.999,62.044c0.09,13.722,4.857,26.344,12.709,36.46C25.772,112.758,43.011,122,62.347,122h62.085V55.341H74.613L127.319,2z M111.115,68.658v31.813l-35.64-31.813H111.115z M100.313,108.683H62.347c-25.764,0-47.031-20.874-47.031-46.639c0-25.766,21.267-46.727,47.031-46.727h33.092L48.704,62.615L100.313,108.683z"/>
    <path d="M231.984,49.289h-15.528c-2.779-7.611-8.642-11.415-17.794-11.415c-6.172,0-11.212,2.262-15.118,6.788c-3.909,4.526-5.863,10.285-5.863,17.279c0,7.094,1.953,12.857,5.966,17.483c4.01,4.526,9.152,6.789,15.632,6.789c10.595,0,17.381-5.143,18.101-13.885h-17.175V59.163H232.5v6.273c0,10.595-3.086,18.924-9.155,24.993c-6.066,5.966-14.088,8.949-24.067,8.949c-10.592,0-19.334-3.496-26.123-10.595c-6.789-7.096-10.182-16.045-10.182-26.842c0-10.8,3.393-19.645,10.079-26.638c6.789-7.097,15.428-10.594,25.92-10.594C216.659,24.709,227.974,34.171,231.984,49.289z"/>
    <path d="M259.148,26.045v58.83h29.929v13.165h-44.124V26.045H259.148z"/>
    <path d="M312.84,26.045v71.995h-14.091V26.045H312.84z"/>
    <path d="M354.394,26.045c11.315,0,20.364,3.291,27.05,9.977c6.789,6.684,10.182,15.325,10.182,26.02s-3.393,19.337-10.182,26.02c-6.686,6.686-15.735,9.978-27.05,9.978h-26.946V26.045H354.394z M341.539,39.21v45.665h12.855c14.298,0,22.524-8.332,22.524-22.833c0-14.398-8.125-22.832-22.524-22.832H341.539z"/>
    <path d="M444.293,26.045V39.21h-27.357v15.221h23.654v13.267h-23.654v17.177h27.357v13.165h-41.448V26.045H444.293z"/>
    <path d="M461.79,24.59c-4.747,0-7.862,3.458-7.862,8.039c0,4.55,3.115,8.039,7.862,8.039c4.716,0,7.801-3.489,7.801-8.039C469.591,28.048,466.506,24.59,461.79,24.59z M461.79,39.211c-3.841,0-6.32-2.851-6.32-6.583c0-3.761,2.479-6.582,6.32-6.582c3.81,0,6.259,2.821,6.259,6.582C468.048,36.359,465.6,39.211,461.79,39.211z M464.814,31.081c0-1.638-1.12-2.7-2.934-2.7h-2.842v8.494h1.542V33.66h1.118l1.694,3.215h1.784l-1.904-3.489C464.239,32.992,464.814,32.143,464.814,31.081z M460.58,29.777h1.239c0.877,0,1.421,0.455,1.421,1.304c0,0.819-0.544,1.304-1.421,1.304h-1.239V29.777z"/>
  </g>
</svg>`;

// Same logo used at smaller size for interior page headers
const GLIDE_LOGO_SMALL = GLIDE_LOGO_SVG.replace('class="glide-logo"', 'class="glide-logo-small"');

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function markdownToHtml(md: string): string {
  let html = md;

  // Tables (must be before other transformations)
  html = html.replace(/(?:^(\|.+\|)\n(\|[-:\s|]+\|)\n((?:\|.+\|\n?)+))/gm, (_match, headerRow, _sepRow, bodyRows) => {
    const headers = headerRow.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('');
    const rows = bodyRows.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Code blocks
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const content = match.slice(3).replace(/^[^\n]*\n/, '').slice(0, -3);
    return `<pre><code>${escHtml(content)}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr />');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Unordered lists
  html = html.replace(/((?:^[-*] .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(line => {
      const content = line.replace(/^[-*] /, '');
      return `<li>${content}</li>`;
    }).join('\n');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(line => {
      const content = line.replace(/^\d+\. /, '');
      return `<li>${content}</li>`;
    }).join('\n');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs
  html = html.replace(/^(?!<[a-z])((?:.+\n?)+)/gm, (match) => {
    const trimmed = match.trim();
    if (!trimmed || trimmed.startsWith('<')) return match;
    return `<p>${trimmed}</p>`;
  });

  return html;
}

/** Build the full HTML document string (used by both preview and DocRaptor) */
export function buildGlideHtml(options: GlideDocumentOptions): string {
  const { title, subtitle, clientDomain, companyName, sections, preparedBy = DEFAULT_PREPARED_BY } = options;
  const bodyHtml = markdownToHtml(sections);
  const headerRight = [title, subtitle, companyName].filter(Boolean).join('<br/>');

  const FONT_BASE = 'https://glide-page-scout.vercel.app/fonts';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escHtml(title)} - ${escHtml(companyName || clientDomain || '')}</title>
  <style>
    @font-face { font-family: 'Larsseit'; src: url('${FONT_BASE}/Larsseit-Light.otf') format('opentype'); font-weight: 300; }
    @font-face { font-family: 'Larsseit'; src: url('${FONT_BASE}/Larsseit-Regular.otf') format('opentype'); font-weight: 400; }
    @font-face { font-family: 'Larsseit'; src: url('${FONT_BASE}/Larsseit-Medium.otf') format('opentype'); font-weight: 500; }
    @font-face { font-family: 'Larsseit'; src: url('${FONT_BASE}/Larsseit-Bold.otf') format('opentype'); font-weight: 700; }

    /* ── Page setup with Prince running header/footer ── */
    @page {
      size: letter;
      margin: 0.7in 0.85in 0.9in 0.85in;
      @top-left { content: element(page-header-left); }
      @top-right { content: element(page-header-right-box); }
      @bottom-center { content: element(page-footer-el); }
    }
    @page cover { margin: 0.85in; @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; } }

    /* Running elements (Prince pulls these out of flow) */
    .running-header-left { position: running(page-header-left); }
    .running-header-right { position: running(page-header-right-box); }
    .running-footer { position: running(page-footer-el); }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Larsseit', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-weight: 400;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #1a1a1a;
    }

    /* ── Cover page ────────────────────────────── */
    .cover {
      page: cover;
      page-break-after: always;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .cover .glide-logo { width: 180px; height: auto; margin-bottom: 2.2in; }
    .cover-title { font-size: 24pt; font-weight: 700; color: #1a1a1a; margin-bottom: 0.1em; line-height: 1.2; }
    .cover-subtitle { font-size: 20pt; font-weight: 300; color: #999; margin-bottom: 0.1em; line-height: 1.2; }
    .cover-domain { font-size: 20pt; font-weight: 400; color: #3355bb; text-decoration: underline; line-height: 1.3; }
    .prepared-by { margin-top: auto; }
    .prepared-by-label { font-size: 10pt; font-weight: 700; margin-bottom: 0.4em; }
    .prepared-by-detail { font-size: 9pt; line-height: 1.7; color: #1a1a1a; }
    .prepared-by-detail a { color: #3355bb; text-decoration: none; }

    /* ── Running header elements ───────────────── */
    .running-header-left .glide-logo-small { width: 110px; height: auto; }
    .running-header-right {
      text-align: right;
      font-size: 8pt;
      font-weight: 500;
      color: #1a1a1a;
      line-height: 1.45;
      padding-top: 2pt;
    }
    .running-header-right .rh-bold { font-weight: 700; }

    /* ── Running footer ────────────────────────── */
    .running-footer {
      border-top: 0.5pt solid #ccc;
      padding-top: 6pt;
      font-size: 7.5pt;
      color: #666;
      text-align: center;
    }
    .running-footer a { color: #3355bb; text-decoration: none; }

    /* ── Content styles ────────────────────────── */
    h1 {
      font-size: 20pt;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 0.5em;
      padding-bottom: 0.2em;
      border-bottom: 0.5pt solid #ddd;
      line-height: 1.2;
    }
    h2 {
      font-size: 14pt;
      font-weight: 700;
      margin-top: 1.4em;
      margin-bottom: 0.35em;
      line-height: 1.25;
    }
    h3 {
      font-size: 11pt;
      font-weight: 600;
      margin-top: 1em;
      margin-bottom: 0.25em;
    }
    p { margin-bottom: 0.6em; }
    ul, ol { padding-left: 1.4em; margin-bottom: 0.7em; }
    li { margin-bottom: 0.2em; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    a { color: #3355bb; text-decoration: underline; }

    blockquote {
      border-left: 2pt solid #ccc;
      margin: 0.6em 0;
      padding-left: 1em;
      color: #555;
    }

    code {
      background: #f4f4f4;
      padding: 0.1em 0.3em;
      border-radius: 2px;
      font-size: 0.9em;
      font-family: Consolas, monospace;
    }
    pre {
      background: #f4f4f4;
      padding: 0.8em;
      border-radius: 3px;
      overflow-x: auto;
      margin-bottom: 0.6em;
    }
    pre code { background: none; padding: 0; }

    hr { border: none; border-top: 0.5pt solid #ddd; margin: 1.2em 0; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.6em 0;
      font-size: 10pt;
    }
    th, td {
      border: 0.5pt solid #ccc;
      padding: 0.5em 0.7em;
      text-align: left;
    }
    th { font-weight: 700; }
  </style>
</head>
<body>

  <!-- Running elements (Prince removes these from flow and places in page margins) -->
  <div class="running-header-left">${GLIDE_LOGO_SMALL}</div>
  <div class="running-header-right">
    <span class="rh-bold">${escHtml(title)}</span><br/>
    ${subtitle ? escHtml(subtitle) + '<br/>' : ''}${companyName ? escHtml(companyName) : ''}
  </div>
  <div class="running-footer">
    GLIDE&reg; &nbsp;|&nbsp; <a href="https://glidedesign.com">glidedesign.com</a> &nbsp;|&nbsp; <a href="mailto:${escHtml(preparedBy.email)}">${escHtml(preparedBy.email)}</a> &nbsp;|&nbsp; ${escHtml(preparedBy.phone)}
  </div>

  <!-- Cover Page -->
  <div class="cover">
    ${GLIDE_LOGO_SVG}
    <div>
      <div class="cover-title">${escHtml(title)}</div>
      ${subtitle ? `<div class="cover-subtitle">${escHtml(subtitle)}</div>` : ''}
      ${clientDomain ? `<a class="cover-domain" href="https://${escHtml(clientDomain)}">${escHtml(clientDomain)}</a>` : ''}
    </div>
    <div class="prepared-by">
      <div class="prepared-by-label">Prepared by</div>
      <div class="prepared-by-detail">
        ${escHtml(preparedBy.name)}<br/>
        ${escHtml(preparedBy.title)}<br/>
        ${escHtml(preparedBy.company)}<br/>
        <a href="mailto:${escHtml(preparedBy.email)}">${escHtml(preparedBy.email)}</a><br/>
        ${escHtml(preparedBy.phone)}
      </div>
    </div>
  </div>

  <!-- Content -->
  ${bodyHtml}

</body>
</html>`;
}

/** Generate a GLIDE-branded PDF via DocRaptor and trigger download */
export async function generateGlideDocument(options: GlideDocumentOptions): Promise<void> {
  const html = buildGlideHtml(options);
  const filename = `${options.title || 'Document'} — ${options.companyName || options.clientDomain || 'GLIDE'}.pdf`
    .replace(/[^\w\s.—-]/g, '');

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ html, filename, test: false }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`PDF generation failed (${response.status}): ${errText}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
