import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getValidAccessToken(supabase: any): Promise<string | null> {
  const { data: connections } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('provider', 'google-drive')
    .limit(1);

  const conn = connections?.[0];
  if (!conn) return null;

  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return conn.access_token;
  }

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

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  await supabase
    .from('oauth_connections')
    .update({
      access_token: tokenData.access_token,
      token_expires_at: newExpiresAt,
      ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
    })
    .eq('id', conn.id);

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, accessToken: clientToken, fileId } = body;

    // Return client ID for picker initialization
    if (action === "get-client-id") {
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      if (!clientId) {
        return new Response(
          JSON.stringify({ error: "Google Client ID not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ clientId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download file content from Google Drive
    if (action === "download") {
      // Resolve token
      let accessToken = clientToken;
      if (!accessToken) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        accessToken = await getValidAccessToken(supabase);
      }

      if (!accessToken || !fileId) {
        return new Response(
          JSON.stringify({ error: !accessToken ? "drive_auth_required" : "fileId is required" }),
          { status: !accessToken ? 401 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // First get file metadata
      const metaResp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!metaResp.ok) {
        const err = await metaResp.text();
        return new Response(
          JSON.stringify({ error: `Failed to get file metadata: ${err}` }),
          { status: metaResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const meta = await metaResp.json();

      const EXPORT_MIME: Record<string, string> = {
        "application/vnd.google-apps.document": "text/plain",
        "application/vnd.google-apps.spreadsheet": "text/csv",
        "application/vnd.google-apps.presentation": "text/plain",
      };

      let content: string;
      let finalMime = meta.mimeType;
      let finalName = meta.name;

      if (EXPORT_MIME[meta.mimeType]) {
        const exportMime = EXPORT_MIME[meta.mimeType];
        const exportResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!exportResp.ok) {
          const err = await exportResp.text();
          return new Response(
            JSON.stringify({ error: `Failed to export file: ${err}` }),
            { status: exportResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        content = await exportResp.text();
        finalMime = exportMime;
      } else {
        const dlResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!dlResp.ok) {
          const err = await dlResp.text();
          return new Response(
            JSON.stringify({ error: `Failed to download file: ${err}` }),
            { status: dlResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const textTypes = ["text/", "application/json", "application/xml", "application/csv"];
        if (textTypes.some(t => finalMime.startsWith(t) || finalMime.includes(t))) {
          content = await dlResp.text();
        } else {
          const buf = await dlResp.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const CHUNK = 32768;
          const chunks: string[] = [];
          for (let i = 0; i < bytes.length; i += CHUNK) {
            chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
          }
          content = btoa(chunks.join(''));
        }
      }

      return new Response(
        JSON.stringify({ name: finalName, mimeType: finalMime, content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("google-drive-picker error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
