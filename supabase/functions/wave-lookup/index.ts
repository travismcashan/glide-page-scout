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

    const apiKey = Deno.env.get('WAVE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'WAVE API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('WAVE accessibility scan for:', url);

    // reporttype=2 gives statistics + item listings (2 credits)
    const apiUrl = `https://wave.webaim.org/api/request?key=${apiKey}&url=${encodeURIComponent(url)}&reporttype=2`;
    const res = await fetch(apiUrl);

    if (!res.ok) {
      const errText = await res.text();
      console.error('WAVE API error:', res.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `WAVE API error: ${res.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await res.json();

    if (!data.status?.success) {
      return new Response(
        JSON.stringify({ success: false, error: data.status?.error || 'WAVE scan failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const categories = data.categories || {};
    const stats = data.statistics || {};

    // Build structured result
    const result = {
      success: true,
      pageTitle: stats.pagetitle || null,
      waveUrl: stats.waveurl || null,
      creditsRemaining: stats.creditsremaining ?? null,
      summary: {
        errors: categories.error?.count || 0,
        alerts: categories.alert?.count || 0,
        features: categories.feature?.count || 0,
        structure: categories.structure?.count || 0,
        aria: categories.aria?.count || 0,
        contrast: categories.contrast?.count || 0,
      },
      items: {
        errors: categories.error?.items || {},
        alerts: categories.alert?.items || {},
        features: categories.feature?.items || {},
        structure: categories.structure?.items || {},
        aria: categories.aria?.items || {},
        contrast: categories.contrast?.items || {},
      },
    };

    console.log(`WAVE scan complete: ${result.summary.errors} errors, ${result.summary.alerts} alerts, ${result.summary.contrast} contrast issues`);

    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('WAVE error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'WAVE lookup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
