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

    const prompt = `You are a web design analyst. Describe this screenshot of the page "${page_url}" in detail for a knowledge base. Include:
- Overall layout and structure
- Key visual elements (hero sections, CTAs, navigation, images, forms)
- Color scheme and typography observations
- Content hierarchy and messaging
- Any notable design patterns or UI components

Be thorough but concise. Write 3-6 paragraphs.`;

    // Use Gemini with fileUri-style URL reference (no base64 needed)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
          generationConfig: { maxOutputTokens: 2000 },
        }),
      }
    );

    // If file_data with URL doesn't work, fall back to inline_data with fetch
    if (!response.ok) {
      const errText = await response.text();
      console.log(`[caption-screenshots] file_data failed (${response.status}), trying inline_data fallback`);

      // Fetch the image and convert to base64
      const imgRes = await fetch(screenshot_url);
      if (!imgRes.ok) {
        return new Response(JSON.stringify({ caption: null, error: 'Failed to fetch image' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const buf = await imgRes.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const fallbackRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: 'image/png', data: base64 } },
              ],
            }],
            generationConfig: { maxOutputTokens: 2000 },
          }),
        }
      );

      if (!fallbackRes.ok) {
        const fallbackErr = await fallbackRes.text();
        console.error(`[caption-screenshots] Fallback also failed: ${fallbackErr}`);
        return new Response(JSON.stringify({ caption: null, error: 'AI captioning failed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const fallbackData = await fallbackRes.json();
      const caption = fallbackData.candidates?.[0]?.content?.parts?.[0]?.text || null;
      return new Response(JSON.stringify({ caption }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const caption = data.candidates?.[0]?.content?.parts?.[0]?.text || null;

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
