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
    .eq('provider', 'google-search-console')
    .limit(1);

  const conn = connections?.[0];
  if (!conn) return null;

  let accessToken = conn.access_token;
  const expiresAt = new Date(conn.token_expires_at).getTime();

  if (Date.now() >= expiresAt - 5 * 60 * 1000) {
    console.log('[gsc] Access token expired, refreshing...');
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret || !conn.refresh_token) {
      console.error('[gsc] Cannot refresh: missing credentials or refresh token');
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
      console.error('[gsc] Token refresh failed:', tokenData);
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
    const { domain, siteUrl: requestedSiteUrl } = body;
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
      return new Response(JSON.stringify({ success: false, error: 'Google Search Console not connected. Connect via Settings → Connections.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { accessToken } = connection;

    // Use client-provided siteUrl or auto-detect
    let siteUrl: string | null = requestedSiteUrl || null;

    if (!siteUrl) {
      console.log(`[gsc] Auto-detecting Search Console site for domain: ${domain}`);
      const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!sitesRes.ok) {
        const err = await sitesRes.text();
        console.error('[gsc] Sites list failed:', err);
        return new Response(JSON.stringify({ success: false, error: `Search Console API error: ${sitesRes.status}` }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const sitesData = await sitesRes.json();
      const sites = sitesData.siteEntry || [];
      const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

      for (const site of sites) {
        const url = (site.siteUrl || '').toLowerCase();
        if (url.includes(cleanDomain)) {
          siteUrl = site.siteUrl;
          break;
        }
      }

      if (!siteUrl) {
        return new Response(JSON.stringify({
          success: true,
          found: false,
          message: `No Search Console property found for "${domain}".`,
          availableSites: sites.map((s: any) => ({ url: s.siteUrl, permissionLevel: s.permissionLevel })),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`[gsc] Using site: ${siteUrl}`);
    const encodedSiteUrl = encodeURIComponent(siteUrl);

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const startDate90 = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

    const apiBase = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}`;
    const searchAnalytics = (body: any) =>
      fetch(`${apiBase}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    const [queriesRes, pagesRes, trendRes, indexRes] = await Promise.all([
      searchAnalytics({ startDate, endDate, dimensions: ['query'], rowLimit: 50, dataState: 'all' }),
      searchAnalytics({ startDate, endDate, dimensions: ['page'], rowLimit: 50, dataState: 'all' }),
      searchAnalytics({ startDate: startDate90, endDate, dimensions: ['date'], dataState: 'all' }),
      fetch(`${apiBase}/sitemaps`, { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);

    const parseSearchAnalytics = async (res: Response, label: string) => {
      if (!res.ok) {
        const err = await res.text();
        console.error(`[gsc] ${label} failed:`, err);
        return [];
      }
      const data = await res.json();
      return (data.rows || []).map((row: any) => ({
        keys: row.keys,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      }));
    };

    const [queries, pages, trend] = await Promise.all([
      parseSearchAnalytics(queriesRes, 'queries'),
      parseSearchAnalytics(pagesRes, 'pages'),
      parseSearchAnalytics(trendRes, 'trend'),
    ]);

    let sitemapInfo: any[] = [];
    if (indexRes.ok) {
      const sitemapData = await indexRes.json();
      sitemapInfo = (sitemapData.sitemap || []).map((sm: any) => ({
        path: sm.path,
        lastSubmitted: sm.lastSubmitted,
        isPending: sm.isPending,
        lastDownloaded: sm.lastDownloaded,
        warnings: sm.warnings || 0,
        errors: sm.errors || 0,
        contents: sm.contents || [],
      }));
    }

    const totalClicks = queries.reduce((sum: number, q: any) => sum + q.clicks, 0);
    const totalImpressions = queries.reduce((sum: number, q: any) => sum + q.impressions, 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition = queries.length > 0
      ? queries.reduce((sum: number, q: any) => sum + q.position * q.impressions, 0) / totalImpressions
      : 0;

    const result = {
      success: true,
      found: true,
      siteUrl,
      period: { start: startDate, end: endDate },
      summary: {
        totalClicks,
        totalImpressions,
        avgCtr,
        avgPosition,
        totalQueries: queries.length,
        totalPages: pages.length,
      },
      topQueries: queries.slice(0, 25).map((q: any) => ({
        query: q.keys[0],
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position,
      })),
      topPages: pages.slice(0, 25).map((p: any) => ({
        page: p.keys[0],
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.ctr,
        position: p.position,
      })),
      dailyTrend: trend.map((t: any) => ({
        date: t.keys[0],
        clicks: t.clicks,
        impressions: t.impressions,
        ctr: t.ctr,
        position: t.position,
      })),
      sitemaps: sitemapInfo,
    };

    console.log(`[gsc] Report complete: ${queries.length} queries, ${pages.length} pages`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[gsc] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
