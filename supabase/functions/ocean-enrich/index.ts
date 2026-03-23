const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      // Retry on 524 (timeout), 502, 503, 429
      if ([524, 502, 503, 429].includes(response.status) && attempt < maxRetries) {
        console.log(`Ocean.io attempt ${attempt} returned ${response.status}, retrying...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt < maxRetries) {
        console.log(`Ocean.io attempt ${attempt} failed (${err}), retrying...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('OCEAN_IO_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ocean.io API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Ocean.io enrich for domain:', domain);

    const response = await fetchWithRetry(
      `https://api.ocean.io/v2/enrich/company?apiToken=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'x-api-token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ company: { domain } }),
      }
    );

    const rawText = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      console.error('Ocean.io returned non-JSON:', response.status, rawText.substring(0, 300));
      return new Response(
        JSON.stringify({ success: false, error: `Ocean.io returned an unexpected response (${response.status}). The API may be temporarily unavailable.` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data: Record<string, any>;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error('Ocean.io JSON parse failed:', rawText.substring(0, 300));
      return new Response(
        JSON.stringify({ success: false, error: 'Ocean.io returned invalid JSON.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      console.error('Ocean.io API error:', response.status, data);
      return new Response(
        JSON.stringify({ success: false, error: data?.detail || `Ocean.io returned ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Ocean.io enrich successful');

    const result: Record<string, any> = {
      success: true,
      domain: data.domain || domain,
      companyName: data.name || null,
      countries: data.countries || [],
      primaryCountry: data.primaryCountry || null,
      companySize: data.companySize || null,
      industries: data.industries || [],
      industryCategories: data.industryCategories || [],
      linkedinIndustry: data.linkedinIndustry || null,
      technologies: data.technologies || [],
      technologyCategories: data.technologyCategories || [],
      yearFounded: data.yearFounded || null,
      revenue: data.revenue || null,
      description: data.description || null,
      ecommercePlatform: data.ecommercePlatform || null,
      employeeCountLinkedin: data.employeeCountLinkedin || null,
      employeeCountOcean: data.employeeCountOcean || null,
      departmentSizes: data.departmentSizes || [],
      locations: data.locations || [],
      emails: data.emails || [],
      medias: data.medias || null,
      logo: data.logo || null,
      keywords: data.keywords || [],
      webTraffic: data.webTraffic || null,
      rootUrl: data.rootUrl || null,
      updatedAt: data.updatedAt || null,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Ocean.io error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to enrich';
    const isTimeout = msg.includes('abort') || msg.includes('timeout');
    return new Response(
      JSON.stringify({ success: false, error: isTimeout ? 'Ocean.io request timed out. Please try again.' : msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
