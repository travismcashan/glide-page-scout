import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Service registry: maps service names to their base URL and auth header builder.
 * Add new services here — no other code changes needed.
 */
const SERVICES: Record<string, {
  baseUrl: string;
  buildHeaders: () => Record<string, string> | null;
}> = {
  harvest: {
    baseUrl: 'https://api.harvestapp.com/v2',
    buildHeaders: () => {
      const token = Deno.env.get('HARVEST_ACCESS_TOKEN');
      const accountId = Deno.env.get('HARVEST_ACCOUNT_ID');
      if (!token || !accountId) return null;
      return {
        Authorization: `Bearer ${token}`,
        'Harvest-Account-Id': accountId,
        'Content-Type': 'application/json',
      };
    },
  },
  asana: {
    baseUrl: 'https://app.asana.com/api/1.0',
    buildHeaders: () => {
      const token = Deno.env.get('ASANA_ACCESS_TOKEN');
      if (!token) return null;
      return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    },
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { service, method, path, params, body: requestBody } = body;

    // Validate service
    if (!service || !SERVICES[service]) {
      return new Response(JSON.stringify({
        error: `Unknown service "${service}". Available: ${Object.keys(SERVICES).join(', ')}`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate path
    if (!path || typeof path !== 'string') {
      return new Response(JSON.stringify({ error: 'path is required (e.g. "/projects" or "/time_entries")' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const svc = SERVICES[service];
    const headers = svc.buildHeaders();
    if (!headers) {
      return new Response(JSON.stringify({ error: `${service} credentials not configured` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build URL
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${svc.baseUrl}${cleanPath}`;

    // Add query params
    if (params && typeof params === 'object' && Object.keys(params).length > 0) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
      url += `?${qs}`;
    }

    const httpMethod = (method || 'GET').toUpperCase();

    const fetchOptions: RequestInit = {
      method: httpMethod,
      headers,
    };
    if (requestBody && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
      fetchOptions.body = JSON.stringify(requestBody);
    }

    console.log(`[api-proxy] ${httpMethod} ${service} → ${url}`);

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[api-proxy] ${service} error [${res.status}]:`, errText.slice(0, 500));
      return new Response(JSON.stringify({
        error: `${service} API error [${res.status}]`,
        details: errText.slice(0, 500),
      }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();

    // Truncate large responses to prevent context overflow
    const jsonStr = JSON.stringify(data);
    if (jsonStr.length > 100_000) {
      return new Response(JSON.stringify({
        _truncated: true,
        _original_length: jsonStr.length,
        data: JSON.parse(jsonStr.slice(0, 100_000).replace(/[^}]*$/, '}}')),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(jsonStr, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[api-proxy] Error:', e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});