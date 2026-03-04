const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const YLT_API = 'https://yellowlab.tools/api';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Yellow Lab Tools: starting run for', url);

    // Launch run with waitForResponse=true (blocks until complete, up to ~60s)
    const runRes = await fetch(`${YLT_API}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, waitForResponse: false }),
    });

    if (!runRes.ok) {
      const errText = await runRes.text();
      console.error('YLT run error:', runRes.status, errText);
      return new Response(JSON.stringify({ success: false, error: `Yellow Lab Tools error: ${runRes.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const runData = await runRes.json();
    const runId = runData.runId;
    if (!runId) {
      return new Response(JSON.stringify({ success: false, error: 'No runId returned' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('YLT runId:', runId, '- polling for results...');

    // Poll for completion (max 2 minutes)
    const maxPolls = 24;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const statusRes = await fetch(`${YLT_API}/runs/${runId}`);
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();

      if (statusData.status?.statusCode === 'complete') {
        // Fetch full results
        const resultRes = await fetch(`${YLT_API}/results/${runId}`);
        if (!resultRes.ok) {
          return new Response(JSON.stringify({ success: false, error: 'Failed to fetch YLT results' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = await resultRes.json();
        const scores = result.scoreProfiles?.generic?.categories || {};
        const globalScore = result.scoreProfiles?.generic?.globalScore ?? null;

        // Extract key metrics
        const categories: Record<string, { score: number; label: string }> = {};
        for (const [key, cat] of Object.entries(scores) as [string, any][]) {
          categories[key] = {
            score: cat.categoryScore ?? 0,
            label: cat.label || key,
          };
        }

        console.log('YLT complete. Global score:', globalScore);

        return new Response(JSON.stringify({
          success: true,
          runId,
          globalScore,
          categories,
          toolsResults: result.toolsResults || {},
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (statusData.status?.statusCode === 'failed') {
        return new Response(JSON.stringify({ success: false, error: 'Yellow Lab Tools run failed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ success: false, error: 'Yellow Lab Tools timed out after 2 minutes' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('YLT error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Yellow Lab Tools scan failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
