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

const MAX_RESPONSE_CHARS = 100_000;
const MAX_ARRAY_ITEMS = 25;
const MAX_OBJECT_KEYS = 50;
const MAX_STRING_CHARS = 2_000;
const MAX_DEPTH = 6;

function compactValue(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) return '[truncated nested data]';

  if (typeof value === 'string') {
    return value.length > MAX_STRING_CHARS
      ? `${value.slice(0, MAX_STRING_CHARS)}… [truncated ${value.length - MAX_STRING_CHARS} chars]`
      : value;
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => compactValue(item, depth + 1));
    return value.length > MAX_ARRAY_ITEMS
      ? {
          _type: 'array_preview',
          _returned_items: items.length,
          _remaining_items: value.length - MAX_ARRAY_ITEMS,
          items,
        }
      : items;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const limitedEntries = entries.slice(0, MAX_OBJECT_KEYS).map(([key, entryValue]) => [key, compactValue(entryValue, depth + 1)]);

    if (entries.length > MAX_OBJECT_KEYS) {
      limitedEntries.push(['_truncated_keys', entries.length - MAX_OBJECT_KEYS]);
    }

    return Object.fromEntries(limitedEntries);
  }

  return value;
}

function buildPreviewPayload(data: unknown, originalLength: number) {
  return {
    _truncated: true,
    _original_length: originalLength,
    _message: 'Response was too large to return in full. Metadata and a preview of the first items are included instead.',
    data: compactValue(data),
  };
}

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

    const responseText = await res.text();

    let data: unknown;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (_parseError) {
      console.error(`[api-proxy] ${service} returned non-JSON success payload:` , responseText.slice(0, 500));
      return new Response(JSON.stringify({
        error: `${service} API returned an invalid JSON payload`,
        details: responseText.slice(0, 500),
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Truncate large responses to prevent context overflow
    const jsonStr = JSON.stringify(data);
    if (jsonStr.length > MAX_RESPONSE_CHARS) {
      return new Response(JSON.stringify(buildPreviewPayload(data, jsonStr.length)), {
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