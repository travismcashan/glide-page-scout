import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function checkUrl(url: string): Promise<{ url: string; statusCode: number; redirectUrl: string | null; responseTimeMs: number; error: string | null }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrokenLinkChecker/1.0)' },
    });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    const redirectUrl = res.headers.get('location') || null;
    return { url, statusCode: res.status, redirectUrl, responseTimeMs: elapsed, error: null };
  } catch (e: any) {
    const elapsed = Date.now() - start;
    // If HEAD fails, try GET (some servers block HEAD)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrokenLinkChecker/1.0)' },
      });
      clearTimeout(timeout);
      const getElapsed = Date.now() - start;
      const redirectUrl = res.headers.get('location') || null;
      // Consume body to free resources
      await res.body?.cancel();
      return { url, statusCode: res.status, redirectUrl, responseTimeMs: getElapsed, error: null };
    } catch (e2: any) {
      return { url, statusCode: 0, redirectUrl: null, responseTimeMs: elapsed, error: e2?.message || 'Request failed' };
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'urls array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limit to 200 URLs per request to avoid timeouts
    const batch = urls.slice(0, 200);
    const concurrency = 10;
    const results: any[] = [];

    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(checkUrl));
      results.push(...chunkResults);
    }

    const summary = {
      total: results.length,
      ok: results.filter(r => r.statusCode >= 200 && r.statusCode < 300).length,
      redirects: results.filter(r => r.statusCode >= 300 && r.statusCode < 400).length,
      clientErrors: results.filter(r => r.statusCode >= 400 && r.statusCode < 500).length,
      serverErrors: results.filter(r => r.statusCode >= 500).length,
      failures: results.filter(r => r.statusCode === 0).length,
    };

    return new Response(JSON.stringify({
      success: true,
      summary,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('link-checker error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
