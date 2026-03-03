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

    const apiKey = Deno.env.get('BUILTWITH_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'BuiltWith API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('BuiltWith lookup for:', domain);

    const res = await fetch(
      `https://api.builtwith.com/v22/api.json?KEY=${apiKey}&LOOKUP=${encodeURIComponent(domain)}`
    );

    // Capture credit headers from response
    const credits = {
      available: res.headers.get('X-API-CREDITS-AVAILABLE'),
      used: res.headers.get('X-API-CREDITS-USED'),
      remaining: res.headers.get('X-API-CREDITS-REMAINING'),
    };
    console.log('BuiltWith credits:', JSON.stringify(credits));

    if (!res.ok) {
      const errText = await res.text();
      console.error('BuiltWith API error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: `BuiltWith API error: ${res.status}`, credits }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();

    // Check for API-level errors in the response body
    if (data?.Errors?.length) {
      const errorMsg = data.Errors.map((e: any) => e.Message || e).join(', ');
      console.error('BuiltWith API returned errors:', errorMsg);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, credits }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract and simplify tech categories
    const technologies: { name: string; category: string; description?: string; link?: string }[] = [];
    const paths = data?.Results?.[0]?.Result?.Paths || [];

    for (const path of paths) {
      for (const tech of path.Technologies || []) {
        if (!technologies.find(t => t.name === tech.Name)) {
          technologies.push({
            name: tech.Name,
            category: tech.Categories?.[0] || 'Other',
            description: tech.Description || undefined,
            link: tech.Link || undefined,
          });
        }
      }
    }

    // Group by category
    const grouped: Record<string, { name: string; description?: string; link?: string }[]> = {};
    for (const tech of technologies) {
      if (!grouped[tech.category]) grouped[tech.category] = [];
      grouped[tech.category].push({
        name: tech.name,
        description: tech.description,
        link: tech.link,
      });
    }

    console.log(`BuiltWith found ${technologies.length} technologies for ${domain}`);

    return new Response(
      JSON.stringify({
        success: true,
        technologies,
        grouped,
        totalCount: technologies.length,
        credits,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('BuiltWith error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'BuiltWith lookup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
