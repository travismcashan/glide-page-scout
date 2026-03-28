import { extractOrchestration } from "../_shared/orchestration.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { domain, action } = body;
    const orch = extractOrchestration(body);

    if (orch) await orch.markRunning();

    const apiKey = Deno.env.get('BUILTWITH_API_KEY');
    if (!apiKey) {
      const msg = 'BuiltWith API key not configured';
      if (orch) await orch.markFailed(msg);
      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // WhoAmI endpoint — returns account info and credits without using a lookup credit
    if (action === 'whoami') {
      console.log('BuiltWith WhoAmI check');
      const res = await fetch(`https://api.builtwith.com/whoamiv1/api.json?KEY=${apiKey}`);
      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `WhoAmI API error: ${res.status}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const data = await res.json();
      console.log('WhoAmI data:', JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({
          success: true,
          account: data.account,
          credits: data.credits,
          rateLimits: data.rate_limits,
          endpoints: data.endpoints,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!domain) {
      const msg = 'Domain is required';
      if (orch) await orch.markFailed(msg);
      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      const msg = `BuiltWith API error: ${res.status}`;
      if (orch) await orch.markFailed(msg);
      return new Response(
        JSON.stringify({ success: false, error: msg, credits }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();

    // Check for API-level errors in the response body
    if (data?.Errors?.length) {
      const errorMsg = data.Errors.map((e: any) => e.Message || e).join(', ');
      console.error('BuiltWith API returned errors:', errorMsg);
      if (orch) await orch.markFailed(errorMsg);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, credits }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract and simplify tech categories
    const technologies: { name: string; category: string; description?: string; link?: string; firstDetected?: number; lastDetected?: number; tag?: string; isPremium?: boolean }[] = [];
    const paths = data?.Results?.[0]?.Result?.Paths || [];

    for (const path of paths) {
      for (const tech of path.Technologies || []) {
        if (!technologies.find(t => t.name === tech.Name)) {
          technologies.push({
            name: tech.Name,
            category: tech.Categories?.[0] || 'Other',
            description: tech.Description || undefined,
            link: tech.Link || undefined,
            firstDetected: tech.FirstDetected || undefined,
            lastDetected: tech.LastDetected || undefined,
            tag: tech.Tag || undefined,
            isPremium: tech.IsPremium ?? undefined,
          });
        }
      }
    }

    // Group by category
    const grouped: Record<string, { name: string; description?: string; link?: string; firstDetected?: number; lastDetected?: number; tag?: string; isPremium?: boolean }[]> = {};
    for (const tech of technologies) {
      if (!grouped[tech.category]) grouped[tech.category] = [];
      grouped[tech.category].push({
        name: tech.name,
        description: tech.description,
        link: tech.link,
        firstDetected: tech.firstDetected,
        lastDetected: tech.lastDetected,
        tag: tech.tag,
        isPremium: tech.isPremium,
      });
    }

    console.log(`BuiltWith found ${technologies.length} technologies for ${domain}`);

    const result = {
      success: true,
      technologies,
      grouped,
      totalCount: technologies.length,
      credits,
    };

    // If orchestrated, save result to DB
    if (orch) {
      await orch.markDone({ grouped, totalCount: technologies.length });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('BuiltWith error:', error);
    const msg = error instanceof Error ? error.message : 'BuiltWith lookup failed';
    // Can't reliably get orch here since body parsing may have failed
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
