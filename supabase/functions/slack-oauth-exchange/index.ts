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
    const { action, code, redirectUri } = body;

    const clientId = Deno.env.get('SLACK_CLIENT_ID');
    const clientSecret = Deno.env.get('SLACK_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Return client ID + auth URL for the frontend
    if (action === 'get-config') {
      if (!clientId) {
        return new Response(JSON.stringify({ error: 'SLACK_CLIENT_ID not configured' }), {
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
        return new Response(JSON.stringify({ error: 'Slack OAuth not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!code || !redirectUri) {
        return new Response(JSON.stringify({ error: 'code and redirectUri are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Exchange code for token via Slack's oauth.v2.access
      const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenData.ok) {
        console.error('[slack-oauth] Token exchange failed:', tokenData.error);
        return new Response(JSON.stringify({ error: tokenData.error || 'Token exchange failed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accessToken = tokenData.access_token;
      const teamName = tokenData.team?.name || 'Slack';
      const teamId = tokenData.team?.id || '';
      const scope = tokenData.scope || '';
      const authedUserId = tokenData.authed_user?.id || '';

      // Get user info for email
      let email = 'unknown';
      try {
        const userRes = await fetch('https://slack.com/api/users.info', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        // For bot tokens, use auth.test instead
        if (!userRes.ok) {
          const testRes = await fetch('https://slack.com/api/auth.test', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          const testData = await testRes.json();
          email = testData.user || teamName;
        } else {
          const userData = await userRes.json();
          email = userData.user?.profile?.email || userData.user?.name || teamName;
        }
      } catch {
        email = teamName;
      }

      // Upsert into oauth_connections
      const { error: upsertError } = await supabase
        .from('oauth_connections')
        .upsert({
          provider: 'slack',
          provider_email: email,
          access_token: accessToken,
          refresh_token: null, // Slack user tokens don't use refresh tokens
          token_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // Slack tokens don't expire
          scopes: scope,
          provider_config: { team_id: teamId, team_name: teamName, authed_user_id: authedUserId },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'provider' });

      if (upsertError) {
        console.error('[slack-oauth] Upsert error:', upsertError);
        return new Response(JSON.stringify({ error: 'Failed to save connection' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        email,
        teamName,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Disconnect
    if (action === 'disconnect') {
      const { id } = body;
      if (id) {
        await supabase.from('oauth_connections').delete().eq('id', id);
      } else {
        await supabase.from('oauth_connections').delete().eq('provider', 'slack');
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[slack-oauth] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
