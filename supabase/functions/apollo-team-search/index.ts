import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_ENRICH_PER_GROUP = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, sessionId, skipEnrichment } = await req.json();

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

    // --- Cache check: skip if session already has apollo_team_data ---
    if (sessionId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const sb = createClient(supabaseUrl, supabaseKey);
        const { data: session } = await sb
          .from('crawl_sessions')
          .select('apollo_team_data')
          .eq('id', sessionId)
          .maybeSingle();
        if (session?.apollo_team_data) {
          console.log('Apollo team data already cached for session', sessionId);
          return new Response(
            JSON.stringify({ ...session.apollo_team_data, cached: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (cacheErr) {
        console.warn('Cache check failed, proceeding with API call:', cacheErr);
      }
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
      return `https://api.apollo.io/api/v1/mixed_people/api_search?${sp.toString()}`;
    }

    function mapEmploymentHistory(history: any[] = []) {
      return history.map((eh: any) => ({
        title: eh.title,
        organizationName: eh.organization_name,
        startDate: eh.start_date,
        endDate: eh.end_date,
        current: eh.current,
        description: eh.description,
        degree: eh.degree,
        kind: eh.kind,
      }));
    }

    function mapPerson(p: any) {
      return {
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
        organizationName: p.organization?.name || p.organization_name || null,
        organizationLogo: p.organization?.logo_url || null,
        employmentHistory: mapEmploymentHistory(p.employment_history || []),
      };
    }

    async function enrichPeopleById(ids: string[]) {
      if (ids.length === 0) return new Map<string, any>();

      const response = await fetch('https://api.apollo.io/api/v1/people/bulk_match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          details: ids.slice(0, MAX_ENRICH_PER_GROUP).map((id) => ({ id })),
          reveal_personal_emails: false,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      if (!contentType.includes('application/json')) {
        throw new Error(`Apollo bulk_match returned non-JSON (${response.status})`);
      }

      const data = JSON.parse(rawText);
      if (!response.ok) {
        throw new Error(data?.message || `Apollo bulk_match returned ${response.status}`);
      }

      const people = data.people || data.contacts || data.matches || [];
      return new Map<string, any>(people.map((p: any) => [p.id, p]));
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

        const searchPeople = data.people || [];
        console.log(`Apollo ${search.label}: found ${searchPeople.length} people`);

        if (skipEnrichment) {
          // Free mode: just return search results without bulk_match (0 credits)
          results[search.label] = searchPeople.map((p: any) => mapPerson(p));
        } else {
          // Enrich top N only (capped to save credits)
          const idsToEnrich = searchPeople.slice(0, MAX_ENRICH_PER_GROUP).map((p: any) => p.id).filter(Boolean);
          const enrichedMap = await enrichPeopleById(idsToEnrich).catch((error) => {
            console.error(`Apollo ${search.label} bulk enrich error:`, error);
            return new Map<string, any>();
          });

          results[search.label] = searchPeople.map((p: any) => mapPerson(enrichedMap.get(p.id) || p));
        }
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

    const responsePayload = {
      success: true,
      domain,
      marketing: results.marketing,
      c_suite: results.c_suite,
      totalFound: results.marketing.length + results.c_suite.length,
      enriched: !skipEnrichment,
      enrichCap: MAX_ENRICH_PER_GROUP,
    };

    return new Response(
      JSON.stringify(responsePayload),
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
