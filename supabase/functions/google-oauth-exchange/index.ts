import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, code, redirectUri, provider, id } = body;

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Return client ID for the frontend to initiate auth code flow
    if (action === 'get-config') {
      if (!clientId) {
        return new Response(JSON.stringify({ error: 'GOOGLE_CLIENT_ID not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ clientId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exchange authorization code for tokens
    if (action === 'exchange') {
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!code || !redirectUri) {
        return new Response(JSON.stringify({ error: 'code and redirectUri are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error('[oauth-exchange] Token exchange failed:', tokenData);
        return new Response(JSON.stringify({
          error: 'token_exchange_failed',
          message: tokenData.error_description || 'Failed to exchange authorization code',
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!tokenData.refresh_token) {
        console.warn('[oauth-exchange] No refresh_token returned — user may have previously authorized');
      }

      // Get user info to identify the account
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json();
      const providerEmail = userInfo.email || 'unknown';
      const providerName = provider || 'google';

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

      // Upsert the connection
      const upsertData: any = {
        provider: providerName,
        provider_email: providerEmail,
        access_token: tokenData.access_token,
        token_expires_at: expiresAt,
        scopes: tokenData.scope || '',
      };
      // Only overwrite refresh_token if we got a new one
      if (tokenData.refresh_token) {
        upsertData.refresh_token = tokenData.refresh_token;
      }

      const { error: dbError } = await supabase
        .from('oauth_connections')
        .upsert(upsertData, { onConflict: 'provider,provider_email' });

      if (dbError) {
        console.error('[oauth-exchange] DB error:', dbError);
        return new Response(JSON.stringify({ error: 'Failed to store tokens' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[oauth-exchange] Stored tokens for ${providerName}: ${providerEmail}`);

      // For GA4 and GSC, auto-fetch available properties/sites
      let availableProperties: any[] | undefined;
      if (providerName === 'google-analytics') {
        try {
          const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (res.ok) {
            const data = await res.json();
            availableProperties = (data.accountSummaries || []).flatMap((a: any) =>
              (a.propertySummaries || []).map((p: any) => ({
                id: p.property,
                name: p.displayName,
                account: a.displayName,
              }))
            );
          }
        } catch (e) {
          console.warn('[oauth-exchange] Failed to list GA4 properties:', e);
        }
      }

      if (providerName === 'google-search-console') {
        try {
          const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (res.ok) {
            const data = await res.json();
            availableProperties = (data.siteEntry || []).map((s: any) => ({
              id: s.siteUrl,
              name: s.siteUrl,
              permissionLevel: s.permissionLevel,
            }));
          }
        } catch (e) {
          console.warn('[oauth-exchange] Failed to list GSC sites:', e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        provider: providerName,
        email: providerEmail,
        ...(availableProperties ? { availableProperties, needsPropertySelection: availableProperties.length > 0 } : {}),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List available properties/sites for a connected provider
    if (action === 'list-properties') {
      const { provider: provName } = body;
      if (!provName) {
        return new Response(JSON.stringify({ error: 'provider is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: connections } = await supabase
        .from('oauth_connections')
        .select('*')
        .eq('provider', provName)
        .limit(1);

      const conn = connections?.[0];
      if (!conn) {
        return new Response(JSON.stringify({ error: 'Provider not connected' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Refresh token if needed
      let accessToken = conn.access_token;
      const expiresAt = new Date(conn.token_expires_at).getTime();
      if (Date.now() >= expiresAt - 5 * 60 * 1000) {
        if (!clientId || !clientSecret || !conn.refresh_token) {
          return new Response(JSON.stringify({ error: 'Cannot refresh token' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
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
        if (tokenRes.ok) {
          accessToken = tokenData.access_token;
          const newExp = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
          await supabase.from('oauth_connections').update({
            access_token: accessToken,
            token_expires_at: newExp,
          }).eq('id', conn.id);
        }
      }

      let properties: any[] = [];

      if (provName === 'google-analytics') {
        const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          properties = (data.accountSummaries || []).flatMap((a: any) =>
            (a.propertySummaries || []).map((p: any) => ({
              id: p.property,
              name: p.displayName,
              account: a.displayName,
            }))
          );
        }
      }

      if (provName === 'google-search-console') {
        const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          properties = (data.siteEntry || []).map((s: any) => ({
            id: s.siteUrl,
            name: s.siteUrl,
            permissionLevel: s.permissionLevel,
          }));
        }
      }

      return new Response(JSON.stringify({
        properties,
        currentConfig: conn.provider_config,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store selected property/site for a provider
    if (action === 'set-property') {
      const { provider: provName, propertyId, propertyName } = body;
      if (!provName || !propertyId) {
        return new Response(JSON.stringify({ error: 'provider and propertyId are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: dbError } = await supabase
        .from('oauth_connections')
        .update({
          provider_config: { propertyId, propertyName: propertyName || propertyId },
        })
        .eq('provider', provName);

      if (dbError) {
        return new Response(JSON.stringify({ error: dbError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List stored connections
    if (action === 'list') {
      const { data, error: dbError } = await supabase
        .from('oauth_connections')
        .select('id, provider, provider_email, token_expires_at, scopes, created_at, updated_at, provider_config')
        .order('provider');

      if (dbError) {
        return new Response(JSON.stringify({ error: dbError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ connections: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Disconnect (delete) a connection
    if (action === 'disconnect') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'id is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Also revoke the token with Google
      const { data: conn } = await supabase
        .from('oauth_connections')
        .select('access_token')
        .eq('id', id)
        .single();

      if (conn?.access_token) {
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${conn.access_token}`, {
            method: 'POST',
          });
        } catch (e) {
          console.warn('[oauth-exchange] Token revoke failed (non-fatal):', e);
        }
      }

      const { error: dbError } = await supabase
        .from('oauth_connections')
        .delete()
        .eq('id', id);

      if (dbError) {
        return new Response(JSON.stringify({ error: dbError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[oauth-exchange] Error:', error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
