const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkUrl(url: string, attempt = 1): Promise<{ url: string; statusCode: number; redirectUrl: string | null; responseTimeMs: number; error: string | null }> {
  const start = Date.now();
  const tryFetch = async (method: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
      clearTimeout(timeout);
      if (method === 'GET') await res.body?.cancel();
      return res;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  };

  try {
    let res: Response;
    try {
      res = await tryFetch('HEAD');
    } catch {
      res = await tryFetch('GET');
    }

    // Retry on 429 with backoff (up to 2 retries)
    if (res.status === 429 && attempt <= 2) {
      const retryAfter = res.headers.get('retry-after');
      const waitMs = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 5000) : attempt * 2000;
      console.log(`429 for ${url}, retrying in ${waitMs}ms (attempt ${attempt})`);
      await sleep(waitMs);
      return checkUrl(url, attempt + 1);
    }

    const elapsed = Date.now() - start;
    const redirectUrl = res.headers.get('location') || null;
    return { url, statusCode: res.status, redirectUrl, responseTimeMs: elapsed, error: null };
  } catch (e: any) {
    const elapsed = Date.now() - start;
    return { url, statusCode: 0, redirectUrl: null, responseTimeMs: elapsed, error: e?.message || 'Request failed' };
  }
}

Deno.serve(async (req) => {
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

    const batch = urls.slice(0, 300);
    // Lower concurrency to avoid triggering rate limits
    const concurrency = 5;
    const results: any[] = [];

    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(u => checkUrl(u)));
      results.push(...chunkResults);
      // Small delay between batches to be polite
      if (i + concurrency < batch.length) {
        await sleep(300);
      }
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
