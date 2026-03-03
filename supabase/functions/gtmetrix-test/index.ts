const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GTMETRIX_API = 'https://gtmetrix.com/api/2.0';

async function gtmetrixFetch(path: string, apiKey: string, options: RequestInit = {}) {
  const res = await fetch(`${GTMETRIX_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${btoa(apiKey + ':')}`,
      'Content-Type': 'application/vnd.api+json',
      ...options.headers,
    },
  });
  return res;
}

async function pollForCompletion(testId: string, apiKey: string, maxAttempts = 20): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const res = await gtmetrixFetch(`/tests/${testId}`, apiKey);
    const rawText = await res.text();

    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      console.warn('GTmetrix poll returned non-JSON response');
    }

    if (!res.ok) {
      console.warn(`GTmetrix poll HTTP ${res.status} (attempt ${i + 1})`);
      // transient errors/rate limits: keep polling
      if (res.status === 429 || res.status >= 500) continue;
      throw new Error(`GTmetrix poll failed: ${res.status}`);
    }

    const attrs = data?.data?.attributes ?? {};
    const state = attrs?.state ?? data?.state ?? null;

    // Sometimes completed payload may omit state but include scores
    const hasFinalScores = attrs?.performance_score != null || attrs?.structure_score != null;

    console.log(`GTmetrix test ${testId} state: ${state ?? 'unknown'} (attempt ${i + 1})`);

    if (state === 'completed' || hasFinalScores) return data;
    if (state === 'error' || state === 'failed') throw new Error('GTmetrix test failed');
  }

  throw new Error('GTmetrix test timed out after polling');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GTMETRIX_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GTmetrix API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting GTmetrix test for:', url);

    // Start the test
    const startRes = await gtmetrixFetch('/tests', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'test',
          attributes: { url },
        },
      }),
    });

    if (!startRes.ok) {
      const err = await startRes.text();
      console.error('GTmetrix start error:', startRes.status, err);
      return new Response(
        JSON.stringify({ success: false, error: `GTmetrix API error: ${startRes.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startData = await startRes.json();
    const testId = startData.data?.id;

    console.log('GTmetrix start response:', JSON.stringify(startData).substring(0, 500));

    if (!testId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No test ID returned' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('GTmetrix test started:', testId);

    // Poll for completion
    const result = await pollForCompletion(testId, apiKey);
    const attrs = result.data?.attributes;

    const scores = {
      performance: attrs?.performance_score,
      structure: attrs?.structure_score,
      lcp: attrs?.lcp,
      tbt: attrs?.tbt,
      cls: attrs?.cls,
      fcp: attrs?.fcp,
      tti: attrs?.tti,
      speed_index: attrs?.speed_index,
    };

    const grade = attrs?.performance_score != null
      ? attrs.performance_score >= 90 ? 'A'
        : attrs.performance_score >= 50 ? 'B'
        : attrs.performance_score >= 30 ? 'C'
        : 'D'
      : null;

    console.log('GTmetrix test completed:', testId, 'Grade:', grade);

    return new Response(
      JSON.stringify({
        success: true,
        testId,
        grade,
        scores,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GTmetrix error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'GTmetrix test failed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
