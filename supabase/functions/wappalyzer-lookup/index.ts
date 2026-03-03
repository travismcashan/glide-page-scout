const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('WAPPALYZER_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Wappalyzer API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Wappalyzer lookup for:', url);

    const res = await fetch(
      `https://api.wappalyzer.com/v2/lookup/?urls=${encodeURIComponent(url)}&sets=all`,
      { headers: { 'x-api-key': apiKey } }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Wappalyzer API error:', res.status, errText);
      if (res.status === 403) {
        return new Response(
          JSON.stringify({ success: false, error: 'Wappalyzer API: Access denied. Your API key may not have permission for this endpoint — check your Wappalyzer subscription tier.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(
        JSON.stringify({ success: false, error: `Wappalyzer API error: ${res.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await res.json();

    // data is an array of results (one per URL)
    const result = data?.[0] || {};
    const technologies = (result.technologies || []).map((t: any) => ({
      name: t.name,
      slug: t.slug,
      versions: t.versions || [],
      categories: (t.categories || []).map((c: any) => c.name),
      website: t.website,
      icon: t.icon,
    }));

    // Group by first category
    const grouped: Record<string, any[]> = {};
    for (const tech of technologies) {
      const cat = tech.categories[0] || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(tech);
    }

    console.log(`Wappalyzer found ${technologies.length} technologies`);

    return new Response(
      JSON.stringify({
        success: true,
        technologies,
        grouped,
        totalCount: technologies.length,
        meta: result.meta || null,
        social: result.social || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Wappalyzer error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Wappalyzer lookup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
