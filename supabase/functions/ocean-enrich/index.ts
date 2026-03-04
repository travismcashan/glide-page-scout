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

    const response = await fetch(`https://api.ocean.io/v2/enrich/company?apiToken=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'x-api-token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company: { domain },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Ocean.io API error:', response.status, data);
      return new Response(
        JSON.stringify({ success: false, error: data?.detail || `Ocean.io returned ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Ocean.io enrich successful');

    // Extract all available firmographic fields
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
      // Employee counts
      employeeCountLinkedin: data.employeeCountLinkedin || null,
      employeeCountOcean: data.employeeCountOcean || null,
      // Department breakdown
      departmentSizes: data.departmentSizes || [],
      // Locations with full address data
      locations: data.locations || [],
      // Contact emails
      emails: data.emails || [],
      // Social media profiles
      medias: data.medias || null,
      // Company logo
      logo: data.logo || null,
      // Keywords extracted from website
      keywords: data.keywords || [],
      // Traffic data
      webTraffic: data.webTraffic || null,
      // Canonical URL
      rootUrl: data.rootUrl || null,
      // Data freshness
      updatedAt: data.updatedAt || null,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Ocean.io error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to enrich' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
