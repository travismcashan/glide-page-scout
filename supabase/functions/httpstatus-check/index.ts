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

async function checkUrl(apiKey: string, url: string): Promise<{
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
    const response = await fetch('https://api.httpstatus.io/v1/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Billing-Token': apiKey,
      },
      body: JSON.stringify({
        requestUrl: url,
        followRedirect: true,
        maxRedirects: 10,
        userAgent: 'googlebot-desktop',
        responseHeaders: true,
        timings: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`httpstatus.io error for ${url}:`, response.status, text);
      return { url, finalUrl: url, finalStatusCode: 0, redirectCount: 0, hops: [], timings: null, responseHeaders: null, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const chain = data.response?.chain || [];

    const hops: HopResult[] = chain.map((hop: any, i: number) => ({
      step: i + 1,
      url: hop.url || '',
      statusCode: hop.statusCode || 0,
      statusMessage: hop.statusMessage || hop.statusText || '',
      redirectTo: hop.redirectTo || null,
      redirectType: hop.redirectType || null,
      latency: hop.latency || null,
      timings: hop.timings?.phases || null,
      responseHeaders: hop.responseHeaders || null,
    }));

    const finalHop = hops.length > 0 ? hops[hops.length - 1] : null;

    return {
      url,
      finalUrl: finalHop?.url || url,
      finalStatusCode: finalHop?.statusCode || 0,
      redirectCount: data.response?.numberOfRedirects ?? Math.max(0, hops.length - 1),
      hops,
      timings: finalHop?.timings || null,
      responseHeaders: finalHop?.responseHeaders || null,
    };
  } catch (err) {
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

    const apiKey = Deno.env.get('HTTPSTATUS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'HTTPSTATUS_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const variants = getDomainVariants(url);

    // Check all 4 variants in parallel
    const results = await Promise.all(variants.map(v => checkUrl(apiKey, v)));

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
