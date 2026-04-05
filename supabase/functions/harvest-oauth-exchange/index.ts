/**
 * Harvest OAuth Exchange Edge Function
 * Handles:
 *   action: 'get-config'  → returns client_id for frontend OAuth redirect
 *   action: 'exchange'    → exchanges authorization code for tokens, stores in oauth_connections
 *   action: 'disconnect'  → removes Harvest connection
 *   action: 'status'      → returns connection status + expiry info
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tokenStatus } from "../_shared/oauth-refresh.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HARVEST_TOKEN_URL = "https://id.getharvest.com/api/v2/oauth2/token";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, code, redirectUri } = body;

    const clientId = Deno.env.get("HARVEST_CLIENT_ID");
    const clientSecret = Deno.env.get("HARVEST_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── get-config: Return client ID for frontend OAuth redirect ──
    if (action === "get-config") {
      if (!clientId) {
        return new Response(
          JSON.stringify({ error: "HARVEST_CLIENT_ID not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ clientId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── exchange: Exchange authorization code for tokens ──
    if (action === "exchange") {
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: "Harvest OAuth not configured (missing client credentials)" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!code || !redirectUri) {
        return new Response(
          JSON.stringify({ error: "code and redirectUri are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Exchange code for tokens
      const tokenRes = await fetch(HARVEST_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok) {
        console.error("[harvest-oauth] Token exchange failed:", JSON.stringify(tokenData));
        return new Response(
          JSON.stringify({ error: tokenData.error || "Token exchange failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch Harvest account info to get account_id and user email
      let accountId: string | null = null;
      let email = "unknown";

      try {
        const accountsRes = await fetch("https://id.getharvest.com/api/v2/accounts", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const accountsData = await accountsRes.json();

        if (accountsData.accounts?.length > 0) {
          accountId = String(accountsData.accounts[0].id);
        }
        if (accountsData.user?.email) {
          email = accountsData.user.email;
        }
      } catch (err) {
        console.error("[harvest-oauth] Failed to fetch account info:", err);
      }

      // Also try HARVEST_ACCOUNT_ID env var as fallback
      if (!accountId) {
        accountId = Deno.env.get("HARVEST_ACCOUNT_ID") || null;
      }

      const expiresAt = new Date(
        Date.now() + (tokenData.expires_in || 1209600) * 1000
      ).toISOString();

      // Delete existing harvest connection, then insert fresh
      await supabase.from("oauth_connections").delete().eq("provider", "harvest");
      const { error: insertError } = await supabase
        .from("oauth_connections")
        .insert({
          provider: "harvest",
          provider_email: email,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt,
          scopes: tokenData.scope || null,
          provider_config: {
            account_id: accountId,
            token_type: tokenData.token_type || "bearer",
          },
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("[harvest-oauth] Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to save connection" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(
        `[harvest-oauth] Connected successfully — email: ${email}, account_id: ${accountId}, expires: ${expiresAt}`
      );

      return new Response(
        JSON.stringify({ success: true, email, accountId, expiresAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── disconnect: Remove Harvest connection ──
    if (action === "disconnect") {
      const { id } = body;
      if (id) {
        await supabase.from("oauth_connections").delete().eq("id", id);
      } else {
        await supabase.from("oauth_connections").delete().eq("provider", "harvest");
      }
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── status: Return connection status + expiry info ──
    if (action === "status") {
      const { data: connections } = await supabase
        .from("oauth_connections")
        .select("*")
        .eq("provider", "harvest")
        .limit(1);

      const conn = connections?.[0];
      if (!conn) {
        return new Response(
          JSON.stringify({ connected: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const status = tokenStatus(conn);

      return new Response(
        JSON.stringify({
          connected: true,
          email: conn.provider_email,
          accountId: conn.provider_config?.account_id || null,
          tokenExpiresAt: conn.token_expires_at,
          ...status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[harvest-oauth] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
