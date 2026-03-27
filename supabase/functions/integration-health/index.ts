const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type HealthResult = { id: string; ok: boolean; latencyMs: number; detail?: string };

async function checkBuiltWith(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const key = Deno.env.get('BUILTWITH_API_KEY');
    if (!key) return { id: 'builtwith', ok: false, latencyMs: 0, detail: 'No API key' };
    const res = await fetch(`https://api.builtwith.com/whoamiv1/api.json?KEY=${key}`);
    return { id: 'builtwith', ok: res.ok, latencyMs: Date.now() - start };
  } catch (e) {
    return { id: 'builtwith', ok: false, latencyMs: Date.now() - start, detail: (e as Error).message };
  }
}

async function checkGtmetrix(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const key = Deno.env.get('GTMETRIX_API_KEY');
    if (!key) return { id: 'gtmetrix', ok: false, latencyMs: 0, detail: 'No API key' };
    const res = await fetch('https://gtmetrix.com/api/2.0/status', {
      headers: { 'Authorization': `Basic ${btoa(key + ':')}` },
    });
    return { id: 'gtmetrix', ok: res.ok, latencyMs: Date.now() - start };
  } catch (e) {
    return { id: 'gtmetrix', ok: false, latencyMs: Date.now() - start, detail: (e as Error).message };
  }
}

async function checkWebsiteCarbon(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const res = await fetch('https://api.websitecarbon.com/site?url=https://example.com');
    // 200 or 304 both mean the service is up
    return { id: 'carbon', ok: res.status < 500, latencyMs: Date.now() - start };
  } catch (e) {
    return { id: 'carbon', ok: false, latencyMs: Date.now() - start, detail: (e as Error).message };
  }
}

async function checkPageSpeed(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const key = Deno.env.get('GOOGLE_PSI_API_KEY');
    // Just verify the key works with a minimal call
    const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://www.google.com&strategy=desktop&category=performance&key=${key || ''}`;
    const res = await fetch(url);
    return { id: 'psi', ok: res.ok, latencyMs: Date.now() - start };
  } catch (e) {
    return { id: 'psi', ok: false, latencyMs: Date.now() - start, detail: (e as Error).message };
  }
}

async function checkHubSpot(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const token = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    if (!token) return { id: 'hubspot', ok: false, latencyMs: 0, detail: 'No API key' };
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return { id: 'hubspot', ok: res.ok, latencyMs: Date.now() - start };
  } catch (e) {
    return { id: 'hubspot', ok: false, latencyMs: Date.now() - start, detail: (e as Error).message };
  }
}

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Run all health checks in parallel
    const results = await Promise.all([
      checkBuiltWith(),
      checkGtmetrix(),
      checkWebsiteCarbon(),
      checkPageSpeed(),
      checkHubSpot(),
    ]);

    const map: Record<string, HealthResult> = {};
    for (const r of results) map[r.id] = r;

    return new Response(
      JSON.stringify({ success: true, results: map }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
