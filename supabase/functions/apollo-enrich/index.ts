const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, domain } = await req.json();

    if (!email && !domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email or domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('APOLLO_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apollo.io API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Apollo.io people/match for:', email || domain);

    const response = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        email: email || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        domain: domain || undefined,
        reveal_personal_emails: false,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    if (!contentType.includes('application/json')) {
      console.error('Apollo returned non-JSON:', response.status, rawText.substring(0, 300));
      return new Response(
        JSON.stringify({ success: false, error: `Apollo returned an unexpected response (${response.status})` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(rawText);

    if (!response.ok) {
      console.error('Apollo API error:', response.status, data);
      return new Response(
        JSON.stringify({ success: false, error: data?.message || `Apollo returned ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const person = data.person;
    if (!person) {
      return new Response(
        JSON.stringify({ success: true, found: false, error: 'No matching person found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Apollo match successful:', person.name);

    const org = person.organization || {};
    const result = {
      success: true,
      found: true,
      id: person.id,
      firstName: person.first_name,
      lastName: person.last_name,
      name: person.name,
      title: person.title,
      headline: person.headline,
      linkedinUrl: person.linkedin_url,
      photoUrl: person.photo_url,
      email: person.email,
      emailStatus: person.email_status,
      personalEmails: person.personal_emails || [],
      phone: person.phone_numbers?.[0]?.sanitized_number || null,
      phoneNumbers: person.phone_numbers || [],
      city: person.city,
      state: person.state,
      country: person.country,
      // Social profiles
      twitterUrl: person.twitter_url || null,
      facebookUrl: person.facebook_url || null,
      githubUrl: person.github_url || null,
      // Organization
      organizationName: org.name || null,
      organizationDomain: org.primary_domain || null,
      organizationIndustry: org.industry || null,
      organizationSize: org.estimated_num_employees || null,
      organizationLinkedin: org.linkedin_url || null,
      organizationLogo: org.logo_url || null,
      organizationWebsite: org.website_url || null,
      organizationFounded: org.founded_year || null,
      organizationRevenue: org.annual_revenue_printed || null,
      organizationDescription: org.short_description || null,
      organizationKeywords: org.keywords || [],
      organizationPhone: org.phone || null,
      organizationCity: org.city || null,
      organizationState: org.state || null,
      organizationCountry: org.country || null,
      organizationTechnologies: org.current_technologies?.map((t: any) => t.name || t) || [],
      // Employment history
      employmentHistory: person.employment_history?.map((e: any) => ({
        title: e.title,
        organizationName: e.organization_name,
        startDate: e.start_date,
        endDate: e.end_date,
        current: e.current,
        description: e.description || null,
      })) || [],
      // Seniority & department
      seniority: person.seniority,
      departments: person.departments,
      // Intent & signals
      intentStrength: person.intent_strength || null,
      showIntent: person.show_intent || false,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Apollo error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to enrich contact' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
