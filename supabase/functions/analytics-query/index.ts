import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getOAuthToken(supabase: any, provider: string): Promise<{ accessToken: string; config: any } | null> {
  const { data: connections } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('provider', provider)
    .limit(1);

  const conn = connections?.[0];
  if (!conn) return null;

  let accessToken = conn.access_token;
  const expiresAt = new Date(conn.token_expires_at).getTime();

  if (Date.now() >= expiresAt - 5 * 60 * 1000) {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret || !conn.refresh_token) return null;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) return null;

    accessToken = tokenData.access_token;
    await supabase
      .from('oauth_connections')
      .update({
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
        ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
      })
      .eq('id', conn.id);
  }

  return { accessToken, config: conn.provider_config };
}

async function queryGA4(
  accessToken: string,
  propertyId: string,
  params: {
    startDate: string;
    endDate: string;
    metrics: string[];
    dimensions?: string[];
    limit?: number;
    orderBy?: string;
    orderDesc?: boolean;
    compareStartDate?: string;
    compareEndDate?: string;
  }
) {
  const pid = propertyId.replace('properties/', '');

  const dateRanges: any[] = [{ startDate: params.startDate, endDate: params.endDate, name: 'primary' }];
  if (params.compareStartDate && params.compareEndDate) {
    dateRanges.push({ startDate: params.compareStartDate, endDate: params.compareEndDate, name: 'comparison' });
  }

  const body: any = {
    dateRanges,
    metrics: params.metrics.map(name => ({ name })),
  };

  if (params.dimensions?.length) {
    body.dimensions = params.dimensions.map(name => ({ name }));
  }
  if (params.limit) {
    body.limit = Math.min(params.limit, 100);
  }
  if (params.orderBy) {
    const isMetric = params.metrics.includes(params.orderBy);
    body.orderBys = [isMetric
      ? { metric: { metricName: params.orderBy }, desc: params.orderDesc ?? true }
      : { dimension: { dimensionName: params.orderBy }, desc: params.orderDesc ?? false }
    ];
  }

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    return { error: `GA4 API error (${response.status}): ${err}` };
  }

  const data = await response.json();
  const dimHeaders = (data.dimensionHeaders || []).map((h: any) => h.name);
  const metricHeaders = (data.metricHeaders || []).map((h: any) => h.name);

  const rows = (data.rows || []).map((row: any) => {
    const entry: Record<string, any> = {};
    dimHeaders.forEach((name: string, i: number) => {
      entry[name] = row.dimensionValues?.[i]?.value;
    });
    metricHeaders.forEach((name: string, i: number) => {
      entry[name] = parseFloat(row.metricValues?.[i]?.value || '0');
    });
    return entry;
  });

  return {
    dateRange: { start: params.startDate, end: params.endDate },
    ...(params.compareStartDate ? { comparisonRange: { start: params.compareStartDate, end: params.compareEndDate } } : {}),
    rowCount: rows.length,
    totals: data.totals?.[0] ? metricHeaders.reduce((acc: any, name: string, i: number) => {
      acc[name] = parseFloat(data.totals[0].metricValues?.[i]?.value || '0');
      return acc;
    }, {}) : undefined,
    rows,
  };
}

async function queryGSC(
  accessToken: string,
  siteUrl: string,
  params: {
    startDate: string;
    endDate: string;
    dimensions?: string[];
    limit?: number;
    dimensionFilterGroups?: any[];
  }
) {
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const body: any = {
    startDate: params.startDate,
    endDate: params.endDate,
    rowLimit: Math.min(params.limit || 25, 100),
    dataState: 'all',
  };

  if (params.dimensions?.length) {
    body.dimensions = params.dimensions;
  }
  if (params.dimensionFilterGroups?.length) {
    body.dimensionFilterGroups = params.dimensionFilterGroups;
  }

  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    return { error: `GSC API error (${response.status}): ${err}` };
  }

  const data = await response.json();
  const rows = (data.rows || []).map((row: any) => ({
    keys: row.keys,
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));

  const totalClicks = rows.reduce((s: number, r: any) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s: number, r: any) => s + r.impressions, 0);

  return {
    dateRange: { start: params.startDate, end: params.endDate },
    rowCount: rows.length,
    totals: { clicks: totalClicks, impressions: totalImpressions, avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0 },
    rows,
  };
}

async function queryHubSpot(
  token: string,
  params: {
    entity: string;
    startDate?: string;
    endDate?: string;
    properties?: string[];
    filters?: any[];
    limit?: number;
    query?: string;
  }
) {
  const entity = params.entity || 'contacts';
  const limit = Math.min(params.limit || 25, 100);

  const hubFetch = async (path: string, method = 'GET', body?: any) => {
    const opts: RequestInit = {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`https://api.hubapi.com${path}`, opts);
    if (!res.ok) {
      const err = await res.text();
      return { error: `HubSpot API error (${res.status}): ${err.substring(0, 500)}` };
    }
    return res.json();
  };

  // Build date filters if provided
  const dateFilters: any[] = [];
  const dateProperty = entity === 'deals' ? 'createdate' : 'createdate';
  if (params.startDate) {
    dateFilters.push({ propertyName: dateProperty, operator: 'GTE', value: new Date(params.startDate).getTime().toString() });
  }
  if (params.endDate) {
    dateFilters.push({ propertyName: dateProperty, operator: 'LTE', value: new Date(params.endDate + 'T23:59:59Z').getTime().toString() });
  }

  const allFilters = [...dateFilters, ...(params.filters || [])];

  // Default properties per entity
  const defaultProps: Record<string, string[]> = {
    contacts: ['email', 'firstname', 'lastname', 'jobtitle', 'lifecyclestage', 'hs_lead_status', 'createdate'],
    deals: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'createdate', 'hs_lastmodifieddate'],
    companies: ['name', 'domain', 'industry', 'lifecyclestage', 'numberofemployees', 'annualrevenue', 'createdate'],
  };
  const properties = params.properties?.length ? params.properties : (defaultProps[entity] || defaultProps.contacts);

  const searchBody: any = {
    properties,
    limit,
    sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
  };
  if (allFilters.length > 0) {
    searchBody.filterGroups = [{ filters: allFilters }];
  }
  if (params.query) {
    searchBody.query = params.query;
  }

  const data = await hubFetch(`/crm/v3/objects/${entity}/search`, 'POST', searchBody);
  if (data.error) return data;

  const rows = (data.results || []).map((r: any) => ({ id: r.id, ...r.properties }));

  // Build summary stats
  const summary: Record<string, any> = { total: data.total || rows.length, returned: rows.length };

  if (entity === 'contacts') {
    // Count by lifecycle stage
    const stages: Record<string, number> = {};
    for (const r of rows) {
      const stage = r.lifecyclestage || 'unknown';
      stages[stage] = (stages[stage] || 0) + 1;
    }
    summary.lifecycleStages = stages;
  }

  if (entity === 'deals') {
    // Sum amounts and group by stage
    const stages: Record<string, { count: number; totalAmount: number }> = {};
    for (const r of rows) {
      const stage = r.dealstage || 'unknown';
      if (!stages[stage]) stages[stage] = { count: 0, totalAmount: 0 };
      stages[stage].count++;
      stages[stage].totalAmount += parseFloat(r.amount || '0');
    }
    summary.dealStages = stages;
    summary.totalPipelineValue = rows.reduce((s: number, r: any) => s + parseFloat(r.amount || '0'), 0);
  }

  return {
    entity,
    dateRange: params.startDate ? { start: params.startDate, end: params.endDate || 'now' } : undefined,
    summary,
    rows,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tool, params } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (tool === 'query_ga4') {
      const conn = await getOAuthToken(supabase, 'google-analytics');
      if (!conn) {
        return new Response(JSON.stringify({ error: 'Google Analytics not connected' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const propertyId = conn.config?.propertyId?.replace('properties/', '') || '';
      if (!propertyId) {
        return new Response(JSON.stringify({ error: 'No GA4 property selected' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await queryGA4(conn.accessToken, propertyId, params);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tool === 'query_search_console') {
      const conn = await getOAuthToken(supabase, 'google-search-console');
      if (!conn) {
        return new Response(JSON.stringify({ error: 'Google Search Console not connected' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const siteUrl = conn.config?.propertyId || '';
      if (!siteUrl) {
        return new Response(JSON.stringify({ error: 'No Search Console site selected' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await queryGSC(conn.accessToken, siteUrl, params);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tool === 'query_hubspot') {
      const token = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
      if (!token) {
        return new Response(JSON.stringify({ error: 'HubSpot not connected. Add HUBSPOT_ACCESS_TOKEN.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await queryHubSpot(token, params);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown tool: ${tool}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[analytics-query] Error:', error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
