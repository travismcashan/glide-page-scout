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
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Checking carbon footprint for:', formattedUrl);

    // Step 1: Fetch the page to measure actual transfer size
    let bytes = 0;
    try {
      const pageRes = await fetch(formattedUrl, {
        headers: { 'User-Agent': 'WebsiteCarbonCheck/1.0' },
        redirect: 'follow',
      });
      const body = await pageRes.arrayBuffer();
      bytes = body.byteLength;
      console.log('Page bytes:', bytes);
    } catch (e) {
      console.error('Failed to fetch page for byte count:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch the page to measure its size.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (bytes === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Page returned 0 bytes.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Check green hosting via The Green Web Foundation
    let green = 0;
    try {
      const hostname = new URL(formattedUrl).hostname;
      const gwfRes = await fetch(`https://api.thegreenwebfoundation.org/greencheck/${hostname}`);
      if (gwfRes.ok) {
        const gwfData = await gwfRes.json();
        green = gwfData.green ? 1 : 0;
        console.log('Green hosting:', green, gwfData);
      }
    } catch (e) {
      console.warn('Green Web Foundation check failed, defaulting to 0:', e);
    }

    // Step 3: Call Website Carbon /data endpoint
    const carbonRes = await fetch(
      `https://api.websitecarbon.com/data?bytes=${bytes}&green=${green}`
    );

    if (!carbonRes.ok) {
      const text = await carbonRes.text();
      console.error('Website Carbon API error:', text);
      return new Response(
        JSON.stringify({ success: false, error: `Website Carbon API returned ${carbonRes.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await carbonRes.json();
    console.log('Carbon data received:', JSON.stringify(data).slice(0, 300));

    return new Response(
      JSON.stringify({
        success: true,
        green: data.green,
        bytes: data.bytes,
        cleanerThan: data.cleanerThan,
        statistics: data.statistics,
        rating: data.rating,
        gco2e: data.gco2e,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking carbon:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to check carbon footprint' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
