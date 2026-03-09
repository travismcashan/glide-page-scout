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
    const contact = person.contact || {};

    const result = {
      success: true,
      found: true,
      // Person basics
      id: person.id,
      firstName: person.first_name,
      lastName: person.last_name,
      name: person.name,
      title: person.title,
      headline: person.headline,
      photoUrl: person.photo_url,
      // Contact info
      email: person.email,
      emailStatus: person.email_status,
      emailSource: contact.email_source || null,
      emailTrueStatus: contact.email_true_status || null,
      extrapolatedEmailConfidence: person.extrapolated_email_confidence || null,
      emailDomainCatchall: person.email_domain_catchall ?? null,
      freeDomain: contact.free_domain ?? null,
      personalEmails: person.personal_emails || [],
      phone: person.phone_numbers?.[0]?.sanitized_number || contact.sanitized_phone || null,
      phoneNumbers: person.phone_numbers || [],
      // Location
      streetAddress: person.street_address || null,
      city: person.city,
      state: person.state,
      country: person.country,
      postalCode: person.postal_code || null,
      formattedAddress: person.formatted_address || null,
      timeZone: contact.time_zone || person.time_zone || null,
      // Social profiles
      linkedinUrl: person.linkedin_url || null,
      twitterUrl: person.twitter_url || null,
      facebookUrl: person.facebook_url || null,
      githubUrl: person.github_url || null,
      // Seniority & department
      seniority: person.seniority,
      departments: person.departments,
      subdepartments: person.subdepartments || [],
      functions: person.functions || [],
      // Engagement signals
      isLikelyToEngage: contact.is_likely_to_engage ?? person.is_likely_to_engage ?? null,
      intentStrength: person.intent_strength || null,
      showIntent: person.show_intent || false,
      revealedForCurrentTeam: person.revealed_for_current_team ?? null,
      // Organization
      organizationId: person.organization_id || null,
      organizationName: org.name || null,
      organizationDomain: org.primary_domain || null,
      organizationWebsite: org.website_url || null,
      organizationLogo: org.logo_url || null,
      organizationIndustry: org.industry || null,
      organizationIndustries: org.industries || [],
      organizationSecondaryIndustries: org.secondary_industries || [],
      organizationSize: org.estimated_num_employees || null,
      organizationFounded: org.founded_year || null,
      organizationRevenue: org.annual_revenue_printed || org.organization_revenue_printed || null,
      organizationRevenueRaw: org.annual_revenue || org.organization_revenue || null,
      organizationDescription: org.short_description || null,
      organizationKeywords: org.keywords || [],
      organizationPhone: org.phone || null,
      // Org location
      organizationStreetAddress: org.street_address || null,
      organizationCity: org.city || null,
      organizationState: org.state || null,
      organizationCountry: org.country || null,
      organizationPostalCode: org.postal_code || null,
      organizationRawAddress: org.raw_address || null,
      // Org social
      organizationLinkedin: org.linkedin_url || null,
      organizationTwitter: org.twitter_url || null,
      organizationFacebook: org.facebook_url || null,
      organizationBlogUrl: org.blog_url || null,
      organizationAngellistUrl: org.angellist_url || null,
      organizationCrunchbaseUrl: org.crunchbase_url || null,
      // Org classification
      organizationSicCodes: org.sic_codes || [],
      organizationNaicsCodes: org.naics_codes || [],
      organizationAlexaRanking: org.alexa_ranking || null,
      organizationLanguages: org.languages || [],
      organizationRetailLocationCount: org.retail_location_count ?? null,
      // Org public trading
      organizationPubliclyTradedSymbol: org.publicly_traded_symbol || null,
      organizationPubliclyTradedExchange: org.publicly_traded_exchange || null,
      // Org growth
      organizationHeadcountGrowth6mo: org.organization_headcount_six_month_growth ?? null,
      organizationHeadcountGrowth12mo: org.organization_headcount_twelve_month_growth ?? null,
      organizationHeadcountGrowth24mo: org.organization_headcount_twenty_four_month_growth ?? null,
      // Org technologies
      organizationTechnologies: org.current_technologies?.map((t: any) => t.name || t) || [],
      // Employment history
      employmentHistory: person.employment_history?.map((e: any) => ({
        title: e.title,
        organizationName: e.organization_name,
        startDate: e.start_date,
        endDate: e.end_date,
        current: e.current,
        description: e.description || null,
        degree: e.degree || null,
        kind: e.kind || null,
      })) || [],
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
