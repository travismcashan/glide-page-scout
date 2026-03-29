const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, pageTitle, pageUrl } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating AI outline for:', pageUrl || pageTitle);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a content cleanup assistant. Given raw scraped website content, clean it up into readable, well-structured markdown while keeping the actual content as faithful as possible to what appears on the page.

Your job:
- Remove navigation menus, footer links, cookie banners, repeated CTAs, social media links, and other site chrome
- Remove scraped artifacts like "Skip to content", breadcrumbs, "Back to top", form labels, etc.
- Preserve the actual page content — headings, body text, lists, quotes — in the order they appear
- Keep the original wording; do NOT rewrite, summarize, or editorialize
- Format cleanly with proper markdown headings, paragraphs, and lists
- If there are obvious section breaks on the page, use markdown headings to reflect them

Do NOT add your own commentary, analysis, or synthesis. The output should read like the page itself, just clean.`,
          },
          {
            role: 'user',
            content: `Page: ${pageTitle || 'Unknown'}\nURL: ${pageUrl || 'Unknown'}\n\nContent:\n${content.substring(0, 8000)}`,
          },
        ],
        max_tokens: 1500,
      }),
    });

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse AI response:', responseText.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'AI returned invalid response. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      console.error('AI Gateway error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error?.message || 'AI request failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const outline = data.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ success: true, outline }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating outline:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate outline' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
