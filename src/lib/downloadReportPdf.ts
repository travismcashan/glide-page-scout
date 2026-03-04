/**
 * Opens a new window with rendered markdown and triggers the browser print dialog (Save as PDF).
 */
export function downloadReportPdf(markdownContent: string, title: string, domain: string) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to download the PDF.');
    return;
  }

  // Convert markdown to basic HTML (good enough for print)
  const html = markdownToHtml(markdownContent);

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escHtml(title)} — ${escHtml(domain)}</title>
  <style>
    @media print {
      body { margin: 0.5in; }
      @page { margin: 0.5in; size: letter; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 8in;
      margin: 0 auto;
      padding: 2rem;
      font-size: 11pt;
    }
    h1 { font-size: 1.6em; border-bottom: 2px solid #333; padding-bottom: 0.3em; margin-top: 1.5em; }
    h2 { font-size: 1.3em; border-bottom: 1px solid #ccc; padding-bottom: 0.2em; margin-top: 1.3em; }
    h3 { font-size: 1.1em; margin-top: 1em; }
    h4 { font-size: 1em; margin-top: 0.8em; }
    ul, ol { padding-left: 1.5em; }
    li { margin-bottom: 0.3em; }
    strong { font-weight: 600; }
    blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #555; }
    code { background: #f4f4f4; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
    .header-info { color: #666; font-size: 0.9em; margin-bottom: 1.5em; }
  </style>
</head>
<body>
  <h1>${escHtml(title)}</h1>
  <div class="header-info">
    <div>${escHtml(domain)} · Generated ${new Date().toLocaleDateString()}</div>
  </div>
  ${html}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`);
  win.document.close();
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Minimal markdown → HTML converter for print */
function markdownToHtml(md: string): string {
  let html = md;

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

  // Unordered lists - group consecutive list items
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

  // Paragraphs - wrap remaining text blocks
  html = html.replace(/^(?!<[a-z])((?:.+\n?)+)/gm, (match) => {
    const trimmed = match.trim();
    if (!trimmed || trimmed.startsWith('<')) return match;
    return `<p>${trimmed}</p>`;
  });

  return html;
}
