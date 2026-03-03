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

    const apiKey = Deno.env.get('GOOGLE_PSI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Google PSI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Running PageSpeed Insights for:', url);

    // Run both mobile and desktop in parallel
    const [mobileRes, desktopRes] = await Promise.all([
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`),
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=desktop&category=performance&category=accessibility&category=best-practices&category=seo`),
    ]);

    if (!mobileRes.ok) {
      const errText = await mobileRes.text();
      console.error('PSI mobile error:', errText);
      return new Response(JSON.stringify({ success: false, error: `PSI API error: ${mobileRes.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const [mobileData, desktopData] = await Promise.all([mobileRes.json(), desktopRes.json()]);

    function extractScores(data: any) {
      const cats = data?.lighthouseResult?.categories || {};
      const audits = data?.lighthouseResult?.audits || {};
      return {
        performance: Math.round((cats.performance?.score || 0) * 100),
        accessibility: Math.round((cats.accessibility?.score || 0) * 100),
        bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
        seo: Math.round((cats.seo?.score || 0) * 100),
        fcp: audits['first-contentful-paint']?.numericValue || null,
        lcp: audits['largest-contentful-paint']?.numericValue || null,
        tbt: audits['total-blocking-time']?.numericValue || null,
        cls: audits['cumulative-layout-shift']?.numericValue || null,
        si: audits['speed-index']?.numericValue || null,
        tti: audits['interactive']?.numericValue || null,
      };
    }

    const result = {
      success: true,
      mobile: extractScores(mobileData),
      desktop: extractScores(desktopData),
      finalUrl: mobileData?.lighthouseResult?.finalUrl || url,
    };

    console.log('PSI complete — mobile perf:', result.mobile.performance, 'desktop perf:', result.desktop.performance);

    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('PSI error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'PSI analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
