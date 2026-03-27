import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { screenshot_url, page_url } = await req.json();
    if (!screenshot_url || !page_url) {
      return new Response(JSON.stringify({ error: 'screenshot_url and page_url required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[caption-screenshots] Captioning: ${page_url}`);

    const prompt = `Describe this screenshot of the web page "${page_url}" for a knowledge base. Cover: layout, visual elements (hero, CTAs, nav, images, forms), colors, typography, content hierarchy, and notable UI patterns. Be thorough but concise, 2-4 paragraphs.`;

    // Pass the screenshot URL directly to Gemini — no base64 needed
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { file_data: { mime_type: 'image/png', file_uri: screenshot_url } },
            ],
          }],
          generationConfig: { maxOutputTokens: 1000 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[caption-screenshots] Gemini error ${response.status}: ${errText.slice(0, 200)}`);
      return new Response(JSON.stringify({ caption: null, error: `Gemini ${response.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const caption = data.candidates?.[0]?.content?.parts?.[0]?.text || null;

    console.log(`[caption-screenshots] ✓ ${page_url} (${caption?.length || 0} chars)`);

    return new Response(JSON.stringify({ caption }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[caption-screenshots] Error:', e);
    return new Response(JSON.stringify({ caption: null, error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
