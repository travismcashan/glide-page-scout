const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin } = await req.json();

    if (!origin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Origin URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GOOGLE_PSI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Google API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('CrUX query for origin:', origin);

    const endpoint = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${apiKey}`;

    // Query both form factors + overall in parallel
    const [allRes, phoneRes, desktopRes] = await Promise.all([
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          metrics: [
            'largest_contentful_paint',
            'cumulative_layout_shift',
            'interaction_to_next_paint',
            'first_contentful_paint',
            'experimental_time_to_first_byte',
          ],
        }),
      }),
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          formFactor: 'PHONE',
          metrics: [
            'largest_contentful_paint',
            'cumulative_layout_shift',
            'interaction_to_next_paint',
            'first_contentful_paint',
            'experimental_time_to_first_byte',
          ],
        }),
      }),
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          formFactor: 'DESKTOP',
          metrics: [
            'largest_contentful_paint',
            'cumulative_layout_shift',
            'interaction_to_next_paint',
            'first_contentful_paint',
            'experimental_time_to_first_byte',
          ],
        }),
      }),
    ]);

    const parseResult = async (res: Response, label: string) => {
      if (!res.ok) {
        const text = await res.text();
        console.log(`CrUX ${label} error (${res.status}):`, text.slice(0, 300));
        // 404 means no data for this origin/form-factor — not an error
        if (res.status === 404) return null;
        return null;
      }
      return await res.json();
    };

    const [allData, phoneData, desktopData] = await Promise.all([
      parseResult(allRes, 'all'),
      parseResult(phoneRes, 'phone'),
      parseResult(desktopRes, 'desktop'),
    ]);

    if (!allData && !phoneData && !desktopData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No CrUX field data available for this origin. The site may not have enough Chrome traffic.',
          noData: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract metric summary
    const extractMetrics = (data: any) => {
      if (!data?.record?.metrics) return null;
      const metrics = data.record.metrics;
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(metrics)) {
        const m = value as any;
        result[key] = {
          p75: m.percentiles?.p75,
          good: m.histogram?.[0]?.density,
          needsImprovement: m.histogram?.[1]?.density,
          poor: m.histogram?.[2]?.density,
        };
      }
      return result;
    };

    const response = {
      success: true,
      overall: extractMetrics(allData),
      phone: extractMetrics(phoneData),
      desktop: extractMetrics(desktopData),
      collectionPeriod: allData?.record?.collectionPeriod || phoneData?.record?.collectionPeriod || null,
    };

    console.log('CrUX data retrieved:', JSON.stringify(response).slice(0, 500));

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('CrUX error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'CrUX query failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
