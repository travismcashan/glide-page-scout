import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function convertMarkdownLists(input: string): string {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  let listType: 'ol' | 'ul' | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) return;

    const listStyle = listType === 'ol'
      ? 'margin:10pt 0 0 0;padding-left:24pt;list-style-type:decimal;'
      : 'margin:10pt 0 0 0;padding-left:24pt;list-style-type:disc;';

    const items = listItems
      .map((item) => `<li style="margin:0 0 4pt 0;">${item}</li>`)
      .join('');

    output.push(`<${listType} style="${listStyle}">${items}</${listType}>`);
    output.push('<p style="margin:0 0 10pt 0;">&nbsp;</p>');

    listType = null;
    listItems = [];
  };

  for (const line of lines) {
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);

    if (orderedMatch || unorderedMatch) {
      const nextType: 'ol' | 'ul' = orderedMatch ? 'ol' : 'ul';

      if (listType && listType !== nextType) {
        flushList();
      }

      listType = nextType;
      listItems.push((orderedMatch ?? unorderedMatch)![1].trim());
      continue;
    }

    if (!line.trim()) {
      if (!listType) {
        output.push(line);
      }
      continue;
    }

    if (listType) {
      flushList();
    }

    output.push(line);
  }

  flushList();

  return output.join('\n').replace(/(?:\n){3,}/g, '\n\n');
}

/** Convert markdown to HTML optimized for Google Docs import */
function markdownToHtml(md: string): string {
  let html = md.replace(/\r\n/g, '\n');

  // Code blocks
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const content = match.slice(3).replace(/^[^\n]*\n/, '').slice(0, -3);
    return `<pre style="background-color:#f4f4f4;padding:12px;font-family:monospace;font-size:10pt;">${escHtml(content)}</pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background-color:#f4f4f4;padding:1px 4px;font-family:monospace;">$1</code>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #cccccc;padding-left:12px;color:#555555;margin:8px 0;">$1</blockquote>');

  // Markdown tables → HTML tables
  html = html.replace(/((?:^\|.+\|$\n?)+)/gm, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return tableBlock;

    const isSeparator = (row: string) => /^\|[\s\-:]+\|$/.test(row.trim());
    const hasSeparator = rows.length >= 2 && isSeparator(rows[1]);

    const parseRow = (row: string) =>
      row.split('|').slice(1, -1).map(cell => cell.trim());

    const tableStyle = 'border-collapse:collapse;width:100%;margin:12px 0;';
    const cellStyle = 'border:1px solid #cccccc;padding:8px 12px;';
    const headerStyle = cellStyle + 'background-color:#e8e8e8;font-weight:bold;';

    let tableHtml = `<table style="${tableStyle}">`;

    const headerCells = parseRow(rows[0]);
    if (hasSeparator) {
      tableHtml += '<thead><tr>';
      for (const cell of headerCells) {
        tableHtml += `<th style="${headerStyle}">${cell}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';
      for (let i = 2; i < rows.length; i++) {
        const cells = parseRow(rows[i]);
        tableHtml += '<tr>';
        for (const cell of cells) {
          tableHtml += `<td style="${cellStyle}">${cell}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody>';
    } else {
      tableHtml += '<tbody>';
      for (const row of rows) {
        const cells = parseRow(row);
        tableHtml += '<tr>';
        for (const cell of cells) {
          tableHtml += `<td style="${cellStyle}">${cell}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody>';
    }

    tableHtml += '</table>';
    return tableHtml;
  });

  // Lists
  html = convertMarkdownLists(html);

  // Wrap remaining text blocks in paragraphs
  html = html.replace(/^(?!<[a-z])((?:.+\n?)+)/gm, (match) => {
    const trimmed = match.trim();
    if (!trimmed || trimmed.startsWith('<')) return match;
    return `<p>${trimmed}</p>`;
  });

  // Google Docs ignores CSS margins — insert a blank <p> between block elements for spacing
  html = html.replace(/(<\/(?:p|h[1-4]|pre|blockquote|table|ol|ul)>)\s*(<(?:p|h[1-4]|pre|blockquote|table|ol|ul)[\s>])/gi, '$1<p><br></p>$2');

  return html;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, content, title } = await req.json();

    if (!accessToken || !content) {
      return new Response(JSON.stringify({ error: 'accessToken and content are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const docTitle = title || 'AI Chat Response';
    const htmlContent = markdownToHtml(content);

    const boundary = '===BOUNDARY===';
    const metadata = JSON.stringify({
      name: docTitle,
      mimeType: 'application/vnd.google-apps.document',
    });

    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      `<html><body style="font-family:Arial,sans-serif;font-size:11pt;">${htmlContent}</body></html>`,
      `--${boundary}--`,
    ].join('\r\n');

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Doc creation error:', errorText);

      if (response.status === 401 || response.status === 403) {
        return new Response(JSON.stringify({
          error: 'insufficient_scope',
          message: 'Please reconnect Google Drive with write permissions.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      return new Response(JSON.stringify({ error: 'Failed to create Google Doc' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const result = await response.json();

    return new Response(JSON.stringify({
      success: true,
      docId: result.id,
      docName: result.name,
      webViewLink: result.webViewLink,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
