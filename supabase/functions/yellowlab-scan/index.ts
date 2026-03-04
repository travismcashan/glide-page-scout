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
    const { url, action, runId } = await req.json();

    // Action: poll — check status and fetch results if ready
    if (action === 'poll' && runId) {
      const statusRes = await fetch(`${YLT_API}/runs/${runId}`);
      if (!statusRes.ok) {
        const errText = await statusRes.text();
        console.error('YLT status check failed:', statusRes.status, errText);
        return new Response(JSON.stringify({ success: false, error: `YLT status check failed: ${statusRes.status}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const statusData = await statusRes.json();
      const statusCode = statusData.status?.statusCode;

      if (statusCode === 'complete') {
        const resultRes = await fetch(`${YLT_API}/results/${runId}`);
        if (!resultRes.ok) {
          return new Response(JSON.stringify({ success: false, error: 'Failed to fetch YLT results' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const result = await resultRes.json();
        const scores = result.scoreProfiles?.generic?.categories || {};
        const globalScore = result.scoreProfiles?.generic?.globalScore ?? null;

        const categories: Record<string, { score: number; label: string }> = {};
        for (const [key, cat] of Object.entries(scores) as [string, any][]) {
          categories[key] = { score: cat.categoryScore ?? 0, label: cat.label || key };
        }

        return new Response(JSON.stringify({
          success: true, status: 'complete', runId, globalScore, categories,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (statusCode === 'failed') {
        const errorMessage = statusData.status?.error || statusData.status?.statusMessage || 'Yellow Lab Tools could not analyze this page';
        console.error('YLT run failed:', JSON.stringify(statusData.status));
        return new Response(JSON.stringify({ success: true, status: 'failed', runId, error: errorMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Still running
      return new Response(JSON.stringify({
        success: true, status: statusCode || 'running', runId,
        position: statusData.status?.position ?? null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Action: start (default) — launch a new run
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Yellow Lab Tools: starting run for', url);

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
    const newRunId = runData.runId;
    if (!newRunId) {
      return new Response(JSON.stringify({ success: false, error: 'No runId returned' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('YLT runId:', newRunId);

    return new Response(JSON.stringify({ success: true, status: 'started', runId: newRunId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('YLT error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Yellow Lab Tools scan failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
