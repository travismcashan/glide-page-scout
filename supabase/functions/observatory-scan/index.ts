const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host } = await req.json();
    if (!host) {
      return new Response(JSON.stringify({ success: false, error: 'Host is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Extract hostname from URL if full URL provided
    let hostname = host.trim();
    try {
      const url = new URL(hostname.startsWith('http') ? hostname : `https://${hostname}`);
      hostname = url.hostname;
    } catch {
      // use as-is
    }

    console.log('Mozilla Observatory scan for:', hostname);

    // POST to trigger/get scan
    const res = await fetch(`https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(hostname)}`, {
      method: 'POST',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Observatory API error:', res.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `Observatory API error: ${res.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await res.json();

    if (data.error) {
      return new Response(
        JSON.stringify({ success: false, error: data.error }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch detailed test results via GET (the POST only returns grade/score)
    let tests = data.tests || null;
    if (!tests && data.id) {
      try {
        const detailRes = await fetch(`https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(hostname)}`, {
          method: 'GET',
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          tests = detailData.tests || null;
        }
      } catch (e) {
        console.warn('Failed to fetch test details:', e);
      }
    }

    console.log(`Observatory scan complete: grade=${data.grade}, score=${data.score}, tests=${tests ? Object.keys(tests).length : 0}`);

    return new Response(JSON.stringify({
      success: true,
      grade: data.grade || null,
      score: data.score ?? null,
      scannedAt: data.scanned_at || null,
      detailsUrl: data.details_url || null,
      tests,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Observatory error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Observatory scan failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
