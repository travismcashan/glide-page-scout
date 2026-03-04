import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const apiUrl = `https://api.httpstatus.io/v1/status`;
    const response = await fetch(apiUrl, {
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
        requestHeaders: true,
        timings: true,
        parsedUrl: true,
        parsedHostname: true,
        meta: true,
        validateTlsCertificate: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('httpstatus.io error:', response.status, text);
      return new Response(JSON.stringify({ success: false, error: `httpstatus.io API error: ${response.status}` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const chain = data.response?.chain || [];

    const hops = chain.map((hop: any, i: number) => ({
      step: i + 1,
      url: hop.url || '',
      statusCode: hop.statusCode || 0,
      statusMessage: hop.statusMessage || hop.statusText || '',
      redirectFrom: hop.redirectFrom || null,
      redirectTo: hop.redirectTo || null,
      redirectType: hop.redirectType || null,
      ip: hop.ip || null,
      latency: hop.latency || null,
      timings: hop.timings?.phases || null,
      responseHeaders: hop.responseHeaders || null,
      requestHeaders: hop.requestHeaders || null,
      parsedUrl: hop.parsedUrl || null,
      parsedHostname: hop.parsedHostname || null,
    }));

    const finalHop = hops.length > 0 ? hops[hops.length - 1] : null;
    const metaData = finalHop?.responseHeaders ? undefined : null;

    // Extract meta from the last hop if available (API puts it on the destination)
    const lastChainItem = chain.length > 0 ? chain[chain.length - 1] : null;
    const meta = lastChainItem?.metaData || lastChainItem?.meta || data.response?.metaData || null;

    return new Response(JSON.stringify({
      success: true,
      requestUrl: url,
      finalUrl: finalHop?.url || url,
      finalStatusCode: finalHop?.statusCode || 0,
      redirectCount: data.response?.numberOfRedirects ?? Math.max(0, hops.length - 1),
      hops,
      meta,
      apiMeta: data.metaData || null,
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
