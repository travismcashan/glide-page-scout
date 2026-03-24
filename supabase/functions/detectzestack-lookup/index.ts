const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();
    if (!domain) {
      return new Response(JSON.stringify({ success: false, error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'RapidAPI key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('DetectZeStack lookup for:', domain);

    const url = `https://detectzestack.p.rapidapi.com/analyze?url=${encodeURIComponent(domain)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'detectzestack.p.rapidapi.com',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await res.text();

    if (!res.ok) {
      console.error('DetectZeStack API error:', res.status, text);
      return new Response(
        JSON.stringify({ success: false, error: `DetectZeStack API error: ${res.status} — ${text.slice(0, 200)}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('DetectZeStack returned non-JSON:', text.slice(0, 300));
      return new Response(
        JSON.stringify({ success: false, error: 'DetectZeStack returned invalid JSON' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const technologies = (data.technologies || []).map((t: any) => ({
      name: t.name,
      categories: t.categories || [],
      confidence: t.confidence ?? null,
      version: t.version ?? null,
      cpe: t.cpe ?? null,
    }));

    // Group by first category
    const grouped: Record<string, any[]> = {};
    for (const tech of technologies) {
      const cat = tech.categories?.[0] || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(tech);
    }

    console.log(`DetectZeStack found ${technologies.length} technologies for ${domain}`);

    return new Response(
      JSON.stringify({
        success: true,
        technologies,
        grouped,
        totalCount: technologies.length,
        scanDepth: data.scan_depth || null,
        domain: data.domain || domain,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('DetectZeStack error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'DetectZeStack lookup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
