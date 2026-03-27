import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getConnectionWithToken(supabase: any): Promise<{ accessToken: string; config: any } | null> {
  const { data: connections } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('provider', 'google-analytics')
    .limit(1);

  const conn = connections?.[0];
  if (!conn) return null;

  let accessToken = conn.access_token;
  const expiresAt = new Date(conn.token_expires_at).getTime();

  if (Date.now() >= expiresAt - 5 * 60 * 1000) {
    console.log('[ga4] Access token expired, refreshing...');
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret || !conn.refresh_token) {
      console.error('[ga4] Cannot refresh: missing credentials or refresh token');
      return null;
    }

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
    if (!tokenRes.ok) {
      console.error('[ga4] Token refresh failed:', tokenData);
      return null;
    }

    accessToken = tokenData.access_token;
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
    await supabase
      .from('oauth_connections')
      .update({
        access_token: accessToken,
        token_expires_at: newExpiresAt,
        ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
      })
      .eq('id', conn.id);
  }

  return { accessToken, config: conn.provider_config };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { domain, propertyId: requestedPropertyId } = body;
    if (!domain) {
      return new Response(JSON.stringify({ success: false, error: 'domain is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const connection = await getConnectionWithToken(supabase);
    if (!connection) {
      return new Response(JSON.stringify({ success: false, error: 'Google Analytics not connected. Connect via Settings → Connections.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { accessToken } = connection;

    // If client provided a specific propertyId, use it directly
    let propertyId: string | null = requestedPropertyId?.replace('properties/', '') || null;
    let propertyName: string = '';
    // Auto-detect if no propertyId provided
    if (!propertyId) {
    console.log(`[ga4] Auto-detecting GA4 property for domain: ${domain}`);
    const accountsRes = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsRes.ok) {
      const err = await accountsRes.text();
      console.error('[ga4] Account list failed:', err);
      return new Response(JSON.stringify({ success: false, error: `GA4 API error: ${accountsRes.status}` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountsData = await accountsRes.json();
    const summaries = accountsData.accountSummaries || [];
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

    for (const account of summaries) {
      for (const prop of account.propertySummaries || []) {
        const propName = (prop.displayName || '').toLowerCase();
        if (propName.includes(cleanDomain) || cleanDomain.includes(propName.replace(/[^a-z0-9.]/g, ''))) {
          propertyId = prop.property?.replace('properties/', '');
          propertyName = prop.displayName;
          break;
        }
      }
      if (propertyId) break;
    }

    // Try data streams if name match failed
    if (!propertyId) {
      for (const account of summaries) {
        for (const prop of account.propertySummaries || []) {
          const pid = prop.property?.replace('properties/', '');
          if (!pid) continue;
          try {
            const streamsRes = await fetch(
              `https://analyticsadmin.googleapis.com/v1beta/properties/${pid}/dataStreams`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (streamsRes.ok) {
              const streamsData = await streamsRes.json();
              for (const stream of streamsData.dataStreams || []) {
                const streamUri = (stream.webStreamData?.defaultUri || '').toLowerCase();
                if (streamUri.includes(cleanDomain)) {
                  propertyId = pid;
                  propertyName = prop.displayName;
                  break;
                }
              }
            }
          } catch {}
          if (propertyId) break;
        }
        if (propertyId) break;
      }
    }

    if (!propertyId) {
      return new Response(JSON.stringify({
        success: true,
        found: false,
        message: `No GA4 property found matching "${domain}".`,
        availableProperties: summaries.flatMap((a: any) => (a.propertySummaries || []).map((p: any) => ({ name: p.displayName, id: p.property }))),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    } // end auto-detect block

    console.log(`[ga4] Using property: ${propertyName || 'user-selected'} (${propertyId})`);

    // Run GA4 Data API reports
    const endDate = new Date().toISOString().split('T')[0];
    const startDate30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const startDate90 = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

    const [overviewRes, pagesRes, sourcesRes, trendRes] = await Promise.all([
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [
            { startDate: startDate30, endDate, name: 'last30' },
            { startDate: startDate90, endDate: startDate30, name: 'previous' },
          ],
          metrics: [
            { name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' },
            { name: 'bounceRate' }, { name: 'averageSessionDuration' },
            { name: 'engagementRate' }, { name: 'newUsers' }, { name: 'conversions' },
          ],
        }),
      }),
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: startDate30, endDate }],
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [
            { name: 'screenPageViews' }, { name: 'sessions' }, { name: 'bounceRate' },
            { name: 'averageSessionDuration' }, { name: 'engagementRate' },
          ],
          limit: 25,
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        }),
      }),
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: startDate30, endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [
            { name: 'sessions' }, { name: 'totalUsers' }, { name: 'conversions' }, { name: 'engagementRate' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        }),
      }),
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: startDate30, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
          orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
        }),
      }),
    ]);

    const parseReport = async (res: Response, label: string) => {
      if (!res.ok) {
        const err = await res.text();
        console.error(`[ga4] ${label} failed:`, err);
        return null;
      }
      return await res.json();
    };

    const [overview, pages, sources, trend] = await Promise.all([
      parseReport(overviewRes, 'overview'),
      parseReport(pagesRes, 'pages'),
      parseReport(sourcesRes, 'sources'),
      parseReport(trendRes, 'trend'),
    ]);

    const parseMetrics = (report: any) => {
      if (!report?.rows?.length) return null;
      const currentRow = report.rows[0];
      const previousRow = report.rows[1];
      const metricHeaders = report.metricHeaders?.map((h: any) => h.name) || [];
      const current: Record<string, number> = {};
      const previous: Record<string, number> = {};
      metricHeaders.forEach((name: string, i: number) => {
        current[name] = parseFloat(currentRow.metricValues?.[i]?.value || '0');
        if (previousRow) {
          previous[name] = parseFloat(previousRow.metricValues?.[i]?.value || '0');
        }
      });
      return { current, previous };
    };

    const parseDimensionReport = (report: any) => {
      if (!report?.rows) return [];
      const dimHeaders = report.dimensionHeaders?.map((h: any) => h.name) || [];
      const metricHeaders = report.metricHeaders?.map((h: any) => h.name) || [];
      return report.rows.map((row: any) => {
        const entry: Record<string, any> = {};
        dimHeaders.forEach((name: string, i: number) => {
          entry[name] = row.dimensionValues?.[i]?.value;
        });
        metricHeaders.forEach((name: string, i: number) => {
          entry[name] = parseFloat(row.metricValues?.[i]?.value || '0');
        });
        return entry;
      });
    };

    const result = {
      success: true,
      found: true,
      propertyId,
      propertyName,
      period: { start: startDate30, end: endDate },
      overview: parseMetrics(overview),
      topPages: parseDimensionReport(pages),
      trafficSources: parseDimensionReport(sources),
      dailyTrend: parseDimensionReport(trend),
    };

    console.log(`[ga4] Report complete: ${result.topPages.length} pages, ${result.trafficSources.length} sources`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[ga4] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
