import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveUserId } from "../_shared/resolve-user.ts";
import { startSyncRun, completeSyncRun, failSyncRun } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getSlackToken(supabase: any): Promise<string | null> {
  const { data: connections } = await supabase
    .from("oauth_connections")
    .select("*")
    .eq("provider", "slack")
    .order("updated_at", { ascending: false })
    .limit(1);

  return connections?.[0]?.access_token || null;
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
    const { companyId, companyName, domain, count = 50 } = body;

    if (!companyId) throw new Error("companyId is required");
    if (!companyName && !domain) throw new Error("companyName or domain required");

    const userId = await resolveUserId(supabase, req, body.userId);
    const syncRun = await startSyncRun(supabase, "slack-sync");
    syncRunId = syncRun.id;
    syncRunStartedAt = syncRun.startedAt;

    const token = await getSlackToken(supabase);
    if (!token) throw new Error("Slack not connected — no valid OAuth token found");

    // Search by company name first, then by domain if different
    const queries = [companyName];
    if (domain && domain !== companyName) queries.push(domain);

    const allMessages: any[] = [];
    const seenTs = new Set<string>();

    for (const query of queries) {
      if (!query) continue;
      console.log(`[slack-sync] Searching: "${query}" (limit: ${count})`);

      const searchUrl = `https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&count=${count}&sort=timestamp&sort_dir=desc`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const searchData = await searchRes.json();

      if (!searchData.ok) {
        console.error(`[slack-sync] Search failed for "${query}": ${searchData.error}`);
        continue;
      }

      for (const msg of searchData.messages?.matches || []) {
        const ts = msg.ts || "";
        if (seenTs.has(ts)) continue;
        seenTs.add(ts);
        allMessages.push(msg);
      }
    }

    console.log(`[slack-sync] Found ${allMessages.length} unique messages`);

    // Upsert into company_messages
    const rows = allMessages.map((msg) => ({
      company_id: companyId,
      channel_id: msg.channel?.id || null,
      channel_name: msg.channel?.name || null,
      message_ts: msg.ts || null,
      author: msg.username || msg.user || null,
      text: msg.text || null,
      thread_ts: msg.thread_ts || null,
      permalink: msg.permalink || null,
      raw_data: msg,
      user_id: userId,
    }));

    let upserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase
        .from("company_messages")
        .upsert(batch, { onConflict: "message_ts,channel_id,user_id" });
      if (error) {
        console.error(`[slack-sync] Upsert error at offset ${i}: ${JSON.stringify(error)}`);
      } else {
        upserted += batch.length;
      }
    }

    console.log(`[slack-sync] Upserted ${upserted} messages for company ${companyId}`);

    await completeSyncRun(supabase, syncRunId, {
      recordsUpserted: upserted,
      metadata: { company_id: companyId, company_name: companyName, domain, messages_found: allMessages.length },
    }, syncRunStartedAt);

    return new Response(
      JSON.stringify({ success: true, messages_synced: upserted, messages_found: allMessages.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[slack-sync] Fatal: ${e.message}`);
    if (syncRunId && supabase) {
      try { await failSyncRun(supabase, syncRunId, e); } catch {}
    }
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
