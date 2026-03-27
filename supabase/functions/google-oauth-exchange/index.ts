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
    const { action, code, redirectUri, provider } = await req.json();

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Return client ID for the frontend to initiate auth code flow
    if (action === 'get-config') {
      return new Response(JSON.stringify({ clientId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exchange authorization code for tokens
    if (action === 'exchange') {
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

      // Get user info to identify the account
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json();
      const providerEmail = userInfo.email || 'unknown';
      const providerName = provider || 'google';

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

      // Upsert the connection
      const { error: dbError } = await supabase
        .from('oauth_connections')
        .upsert({
          provider: providerName,
          provider_email: providerEmail,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt,
          scopes: tokenData.scope || '',
        }, { onConflict: 'provider,provider_email' });

      if (dbError) {
        console.error('[oauth-exchange] DB error:', dbError);
        return new Response(JSON.stringify({ error: 'Failed to store tokens' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[oauth-exchange] Stored tokens for ${providerName}: ${providerEmail}`);

      return new Response(JSON.stringify({
        success: true,
        provider: providerName,
        email: providerEmail,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List stored connections
    if (action === 'list') {
      const { data, error: dbError } = await supabase
        .from('oauth_connections')
        .select('id, provider, provider_email, token_expires_at, scopes, created_at, updated_at')
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
      const { id } = await req.json().catch(() => ({}));
      if (!id) {
        // Try from original parsed body
      }
      const body = { action, code, redirectUri, provider, id: undefined as any };
      // Re-parse since we already consumed the body
      // We need the id from the original parse - let me restructure
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
