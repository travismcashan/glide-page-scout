import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const ct = res.headers.get('content-type') || 'image/png';
    return { base64, mimeType: ct.split(';')[0] };
  } catch {
    return null;
  }
}

async function captionImage(imageUrl: string, pageUrl: string, apiKey: string): Promise<string | null> {
  const img = await fetchImageAsBase64(imageUrl);
  if (!img) return null;

  const prompt = `You are a web design analyst. Describe this screenshot of the page "${pageUrl}" in detail for a knowledge base. Include:
- Overall layout and structure
- Key visual elements (hero sections, CTAs, navigation, images, forms)
- Color scheme and typography observations
- Content hierarchy and messaging
- Any notable design patterns or UI components

Be thorough but concise. Write 3-6 paragraphs.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: img.mimeType, data: img.base64 } },
          ],
        }],
        generationConfig: { maxOutputTokens: 2000 },
      }),
    }
  );

  if (!response.ok) {
    console.error(`Gemini error: ${response.status} ${await response.text()}`);
    return null;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { screenshots } = await req.json();
    if (!screenshots || !Array.isArray(screenshots)) {
      return new Response(JSON.stringify({ error: 'screenshots array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[caption-screenshots] Captioning ${screenshots.length} screenshots`);

    const results: { url: string; caption: string | null }[] = [];

    for (const s of screenshots) {
      const caption = await captionImage(s.screenshot_url, s.url, apiKey);
      results.push({ url: s.url, caption });
      // Rate limit protection
      if (screenshots.length > 1) await new Promise(r => setTimeout(r, 500));
    }

    const captioned = results.filter(r => r.caption).length;
    console.log(`[caption-screenshots] Done: ${captioned}/${screenshots.length} captioned`);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[caption-screenshots] Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
