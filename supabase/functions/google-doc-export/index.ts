import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Convert markdown to basic HTML for Google Docs import */
function markdownToHtml(md: string): string {
  let html = md;
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^---+$/gm, '<hr>');
  // Wrap remaining plain lines in paragraphs
  html = html.replace(/^(?!<[a-z])((?:.+\n?)+)/gm, (match) => {
    const trimmed = match.trim();
    if (!trimmed || trimmed.startsWith('<')) return match;
    return `<p>${trimmed}</p>`;
  });
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

    // Create a Google Doc by uploading HTML content
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
      `<html><body>${htmlContent}</body></html>`,
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
