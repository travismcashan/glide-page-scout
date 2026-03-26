import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accessToken, fileId } = await req.json();

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
      if (!accessToken || !fileId) {
        return new Response(
          JSON.stringify({ error: "accessToken and fileId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      // Google Docs/Sheets/Slides need export
      const EXPORT_MIME: Record<string, string> = {
        "application/vnd.google-apps.document": "text/plain",
        "application/vnd.google-apps.spreadsheet": "text/csv",
        "application/vnd.google-apps.presentation": "text/plain",
      };

      let content: string;
      let finalMime = meta.mimeType;
      let finalName = meta.name;

      if (EXPORT_MIME[meta.mimeType]) {
        // Export Google Workspace files
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
        // Download binary/text files
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

        // For text-based files, return text; for binary, return base64
        const textTypes = ["text/", "application/json", "application/xml", "application/csv"];
        if (textTypes.some(t => finalMime.startsWith(t) || finalMime.includes(t))) {
          content = await dlResp.text();
        } else {
          const buf = await dlResp.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          content = btoa(binary);
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
