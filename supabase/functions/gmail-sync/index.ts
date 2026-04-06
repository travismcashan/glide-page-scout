import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveUserId } from "../_shared/resolve-user.ts";
import { startSyncRun, completeSyncRun, failSyncRun } from "../_shared/sync-logger.ts";
import { findPrimarySession, ragAutoIngest, formatEmailsForRag } from "../_shared/rag-auto-ingest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getValidAccessToken(supabase: any): Promise<string | null> {
  const { data: connections } = await supabase
    .from("oauth_connections")
    .select("*")
    .eq("provider", "gmail")
    .limit(1);

  const conn = connections?.[0];
  if (!conn) return null;

  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return conn.access_token;
  }

  // Refresh expired token
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !conn.refresh_token) return null;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return null;

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  await supabase
    .from("oauth_connections")
    .update({
      access_token: tokenData.access_token,
      token_expires_at: newExpiresAt,
      ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
    })
    .eq("id", conn.id);

  return tokenData.access_token;
}

async function gmailFetch(path: string, token: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API error [${res.status}]: ${errText.substring(0, 500)}`);
  }
  return res.json();
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  try { return atob(padded); } catch { return ""; }
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

function extractAttachments(payload: any): any[] {
  const attachments: any[] = [];
  function collect(part: any) {
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
      });
    }
    if (part.parts) for (const sub of part.parts) collect(sub);
  }
  if (payload) collect(payload);
  return attachments;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let syncRunId = "";
  let syncRunStartedAt = 0;
  let supabase: any;

  try {
    const SB_URL = Deno.env.get("SUPABASE_URL")!;
    const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

    const body = await req.json();
    const { companyId, domain, contactEmails, maxResults = 50, lookbackDays = 180 } = body;

    if (!companyId) throw new Error("companyId is required");
    if (!domain && (!contactEmails || contactEmails.length === 0)) {
      throw new Error("domain or contactEmails required");
    }

    const userId = await resolveUserId(supabase, req, body.userId);
    const syncRun = await startSyncRun(supabase, "gmail-sync");
    syncRunId = syncRun.id;
    syncRunStartedAt = syncRun.startedAt;

    const token = await getValidAccessToken(supabase);
    if (!token) throw new Error("Gmail not connected — no valid OAuth token found");

    // Build Gmail search query
    let query = "";
    if (contactEmails?.length > 0) {
      const parts = contactEmails.map((e: string) => `from:${e} OR to:${e}`);
      query = parts.join(" OR ");
    } else {
      query = `from:@${domain} OR to:@${domain}`;
    }

    if (lookbackDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() - lookbackDays);
      query += ` after:${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    }

    console.log(`[gmail-sync] Searching: ${query} (limit: ${maxResults})`);

    // Paginate message IDs
    const messageIds: string[] = [];
    let pageToken: string | null = null;
    do {
      let url = `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.min(maxResults, 100)}`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      const searchRes = await gmailFetch(url, token);
      for (const m of searchRes.messages || []) messageIds.push(m.id);
      pageToken = searchRes.nextPageToken || null;
    } while (pageToken && messageIds.length < maxResults);

    if (messageIds.length > maxResults) messageIds.length = maxResults;
    console.log(`[gmail-sync] Found ${messageIds.length} messages`);

    // Fetch full messages in batches
    const rows: any[] = [];
    for (let i = 0; i < messageIds.length; i += 20) {
      const batch = messageIds.slice(i, i + 20);
      const fetched = await Promise.all(
        batch.map(async (id) => {
          try {
            const msg = await gmailFetch(`/users/me/messages/${id}?format=full`, token);
            const headers = msg.payload?.headers || [];
            const body = extractBody(msg.payload);
            const attachments = extractAttachments(msg.payload);

            return {
              company_id: companyId,
              gmail_id: msg.id,
              thread_id: msg.threadId,
              subject: getHeader(headers, "Subject"),
              sender: getHeader(headers, "From"),
              recipient: getHeader(headers, "To"),
              body: body.substring(0, 10000),
              snippet: msg.snippet || "",
              date: getHeader(headers, "Date") ? new Date(getHeader(headers, "Date")).toISOString() : null,
              attachments,
              raw_data: { id: msg.id, threadId: msg.threadId, headers, snippet: msg.snippet, labelIds: msg.labelIds },
              user_id: userId,
            };
          } catch (e) {
            console.error(`[gmail-sync] Error fetching message ${id}: ${e.message}`);
            return null;
          }
        })
      );
      rows.push(...fetched.filter(Boolean));
    }

    // Upsert into company_emails
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase
        .from("company_emails")
        .upsert(batch, { onConflict: "gmail_id,user_id" });
      if (error) {
        console.error(`[gmail-sync] Upsert error at offset ${i}: ${JSON.stringify(error)}`);
      } else {
        upserted += batch.length;
      }
    }

    console.log(`[gmail-sync] Upserted ${upserted} emails for company ${companyId}`);

    // Auto-vectorize into RAG pipeline (non-blocking)
    if (upserted > 0) {
      try {
        const sessionId = await findPrimarySession(supabase, companyId);
        if (sessionId) {
          const companyName = domain || companyId;
          const doc = formatEmailsForRag(rows, companyName);
          if (doc) {
            const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
            await ragAutoIngest(sessionId, [doc], SB_URL, anonKey);
          }
        } else {
          console.log(`[gmail-sync] No crawl session found for company ${companyId}, skipping RAG ingest`);
        }
      } catch (ragErr: any) {
        console.warn(`[gmail-sync] RAG ingest failed (non-blocking): ${ragErr?.message}`);
      }
    }

    await completeSyncRun(supabase, syncRunId, {
      recordsUpserted: upserted,
      metadata: { company_id: companyId, domain, messages_found: messageIds.length },
    }, syncRunStartedAt);

    return new Response(
      JSON.stringify({ success: true, emails_synced: upserted, messages_found: messageIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[gmail-sync] Fatal: ${e.message}`);
    if (syncRunId && supabase) {
      try { await failSyncRun(supabase, syncRunId, e); } catch {}
    }
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
