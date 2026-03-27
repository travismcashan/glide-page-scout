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

    const apiKey = Deno.env.get('APOLLO_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apollo API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Apollo team search for domain:', domain);

    function buildSearchUrl(params: { domain: string; seniorities: string[]; departments?: string[]; perPage: number }) {
      const sp = new URLSearchParams();
      sp.set('q_organization_domains', params.domain);
      for (const s of params.seniorities) sp.append('person_seniorities[]', s);
      if (params.departments) {
        for (const d of params.departments) sp.append('person_departments[]', d);
      }
      sp.set('per_page', String(params.perPage));
      return `https://api.apollo.io/api/v1/mixed_people/search?${sp.toString()}`;
    }

    const searches = [
      {
        label: 'marketing',
        url: buildSearchUrl({ domain, seniorities: ['director', 'vp', 'c_suite', 'manager', 'senior'], departments: ['marketing'], perPage: 10 }),
      },
      {
        label: 'c_suite',
        url: buildSearchUrl({ domain, seniorities: ['c_suite', 'vp', 'founder', 'owner'], perPage: 10 }),
      },
    ];

    const results: Record<string, any[]> = { marketing: [], c_suite: [] };

    for (const search of searches) {
      try {
        const response = await fetch(search.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Api-Key': apiKey,
          },
        });

        const contentType = response.headers.get('content-type') || '';
        const rawText = await response.text();

        if (!contentType.includes('application/json')) {
          console.error(`Apollo ${search.label} returned non-JSON:`, response.status, rawText.substring(0, 300));
          continue;
        }

        const data = JSON.parse(rawText);

        if (!response.ok) {
          console.error(`Apollo ${search.label} error:`, response.status, data);
          continue;
        }

        const people = data.people || [];
        console.log(`Apollo ${search.label}: found ${people.length} people`);

        results[search.label] = people.map((p: any) => ({
          id: p.id,
          name: p.name,
          firstName: p.first_name,
          lastName: p.last_name,
          title: p.title,
          headline: p.headline,
          photoUrl: p.photo_url,
          email: p.email,
          emailStatus: p.email_status,
          linkedinUrl: p.linkedin_url,
          city: p.city,
          state: p.state,
          country: p.country,
          seniority: p.seniority,
          departments: p.departments || [],
          organizationName: p.organization?.name || null,
          organizationLogo: p.organization?.logo_url || null,
        }));
      } catch (err) {
        console.error(`Apollo ${search.label} search error:`, err);
      }
    }

    // Deduplicate across both lists (by Apollo ID)
    const seenIds = new Set<string>();
    for (const key of Object.keys(results)) {
      results[key] = results[key].filter((p: any) => {
        if (seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        domain,
        marketing: results.marketing,
        c_suite: results.c_suite,
        totalFound: results.marketing.length + results.c_suite.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Apollo team search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to search team contacts' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
