import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HopResult {
  step: number;
  url: string;
  statusCode: number;
  statusMessage: string;
  redirectTo: string | null;
  redirectType: string | null;
  latency: number | null;
  timings: Record<string, number> | null;
  responseHeaders: Record<string, string> | null;
}

async function checkUrl(_apiKey: string, url: string): Promise<{
  url: string;
  finalUrl: string;
  finalStatusCode: number;
  redirectCount: number;
  hops: HopResult[];
  timings: Record<string, number> | null;
  responseHeaders: Record<string, string> | null;
  error?: string;
}> {
  try {
    // Direct fetch — follow redirects manually to capture each hop
    const hops: HopResult[] = [];
    let currentUrl = url;
    const maxRedirects = 10;
    const overallStart = Date.now();

    for (let i = 0; i <= maxRedirects; i++) {
      const hopStart = Date.now();
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // Don't auto-follow — we track each hop
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        },
      });
      const hopLatency = Date.now() - hopStart;

      const isRedirect = response.status >= 300 && response.status < 400;
      const location = response.headers.get('location');
      const redirectTo = isRedirect && location
        ? (location.startsWith('/') ? new URL(location, currentUrl).href : location)
        : null;

      // Capture response headers
      const respHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => { respHeaders[k] = v; });

      hops.push({
        step: i + 1,
        url: currentUrl,
        statusCode: response.status,
        statusMessage: response.statusText || '',
        redirectTo,
        redirectType: isRedirect ? (response.status === 301 ? '301 Permanent' : response.status === 302 ? '302 Temporary' : `${response.status}`) : null,
        latency: hopLatency,
        timings: i === 0 ? { ttfb: hopLatency } : null,
        responseHeaders: respHeaders,
      });

      if (!isRedirect || !redirectTo) break;
      currentUrl = redirectTo;
    }

    const finalHop = hops.length > 0 ? hops[hops.length - 1] : null;
    const totalTime = Date.now() - overallStart;

    return {
      url,
      finalUrl: finalHop?.url || url,
      finalStatusCode: finalHop?.statusCode || 0,
      redirectCount: Math.max(0, hops.length - 1),
      hops,
      timings: { total: totalTime, ttfb: hops[0]?.latency || 0 },
      responseHeaders: finalHop?.responseHeaders || null,
    };
  } catch (err: any) {
    console.error(`httpstatus-check error for ${url}:`, err);
    return { url, finalUrl: url, finalStatusCode: 0, redirectCount: 0, hops: [], timings: null, responseHeaders: null, error: err.message };
  }
}

function getDomainVariants(url: string): string[] {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    return [
      `http://${hostname}`,
      `https://${hostname}`,
      `http://www.${hostname}`,
      `https://www.${hostname}`,
    ];
  } catch {
    return [url];
  }
}

serve(async (req) => {
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

    const variants = getDomainVariants(url);

    // Check all 4 variants in parallel (direct fetch, no API key needed)
    const results = await Promise.all(variants.map(v => checkUrl('', v)));

    // Build canonical analysis
    const canonicalVariants = results.map(r => ({
      url: r.url,
      finalUrl: r.finalUrl,
      finalStatusCode: r.finalStatusCode,
      redirectCount: r.redirectCount,
      error: r.error || null,
    }));

    const validResults = canonicalVariants.filter(v => !v.error && v.finalStatusCode > 0);
    const finalUrls = [...new Set(validResults.map(v => v.finalUrl.replace(/\/$/, '')))];
    const allResolveToSame = finalUrls.length === 1;
    const canonicalUrl = finalUrls.length === 1 ? finalUrls[0] : null;

    // Primary = the result for the original URL (or https non-www)
    const primaryResult = results.find(r => r.url === url) || results.find(r => r.url.startsWith('https://') && !r.url.includes('www.')) || results[0];

    return new Response(JSON.stringify({
      success: true,
      // Canonical analysis
      canonical: {
        variants: canonicalVariants,
        allResolveToSame,
        canonicalUrl,
      },
      // Primary URL data (backward compatible)
      requestUrl: url,
      finalUrl: primaryResult.finalUrl,
      finalStatusCode: primaryResult.finalStatusCode,
      redirectCount: primaryResult.redirectCount,
      hops: primaryResult.hops,
      timings: primaryResult.timings,
      responseHeaders: primaryResult.responseHeaders,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('httpstatus-check error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
