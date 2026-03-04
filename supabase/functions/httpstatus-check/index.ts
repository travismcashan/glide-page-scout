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
        followRedirects: true,
        userAgent: 'Googlebot/2.1',
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
      url: hop.requestUrl || hop.url || '',
      statusCode: hop.statusCode || 0,
      statusText: hop.statusText || '',
      redirectUrl: hop.redirectUrl || null,
      ip: hop.ip || null,
      timing: hop.timing || null,
      tls: hop.tls || null,
      headers: hop.headers || null,
    }));

    const finalHop = hops.length > 0 ? hops[hops.length - 1] : null;
    const metadata = data.response?.meta || null;
    const parsedUrl = data.response?.parsedUrl || null;

    return new Response(JSON.stringify({
      success: true,
      requestUrl: url,
      finalUrl: finalHop?.url || url,
      finalStatusCode: finalHop?.statusCode || 0,
      redirectCount: Math.max(0, hops.length - 1),
      hops,
      metadata,
      parsedUrl,
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
