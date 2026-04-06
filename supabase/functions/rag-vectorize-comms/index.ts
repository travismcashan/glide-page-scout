/**
 * RAG Vectorize Comms — Auto-vectorization pipeline for communication data.
 *
 * Bridges Pillar 1 (Connections) → Pillar 2 (Knowledge Base).
 * Reads unvectorized records from engagements, company_emails, company_meetings,
 * company_messages, then chunks + embeds them via rag-ingest so AI Chat can search them.
 *
 * Uses synthetic crawl sessions per company (domain = `_comms_{company_id}`)
 * and source_key for dedup (e.g. `engagement_{id}`).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveUserId } from "../_shared/resolve-user.ts";
import { startSyncRun, completeSyncRun, failSyncRun } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_DOCS_PER_RUN = 200; // Stay within edge function timeout

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let syncRunId = "";
  let syncRunStartedAt = 0;
  let supabase: any;

  try {
    const SB_URL = Deno.env.get("SUPABASE_URL")!;
    const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

    const userId = await resolveUserId(supabase, req);

    const syncRun = await startSyncRun(supabase, "rag-vectorize-comms");
    syncRunId = syncRun.id;
    syncRunStartedAt = syncRun.startedAt;

    // ── Step 1: Find already-vectorized source keys ──
    const { data: existingDocs } = await supabase
      .from("knowledge_documents")
      .select("source_key")
      .like("source_type", "comms_%");
    const vectorizedKeys = new Set((existingDocs || []).map((d: any) => d.source_key).filter(Boolean));

    // ── Step 2: Collect unvectorized records from all comm sources ──
    type CommDoc = {
      sourceKey: string;
      sourceType: string;
      companyId: string;
      name: string;
      content: string;
    };
    const pendingDocs: CommDoc[] = [];

    // 2a. Engagements (already synced — 2000 records with body content)
    const { data: engagements } = await supabase
      .from("engagements")
      .select("id, company_id, engagement_type, subject, body_preview, direction, occurred_at")
      .not("body_preview", "is", null)
      .not("company_id", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(MAX_DOCS_PER_RUN * 2);

    for (const e of engagements || []) {
      const key = `engagement_${e.id}`;
      if (vectorizedKeys.has(key)) continue;
      const dateStr = e.occurred_at ? new Date(e.occurred_at).toLocaleDateString() : "unknown date";
      const dir = e.direction ? ` (${e.direction})` : "";
      const content = [
        `${e.engagement_type}${dir} — ${dateStr}`,
        e.subject ? `Subject: ${e.subject}` : null,
        e.body_preview,
      ].filter(Boolean).join("\n\n");

      if (content.length < 30) continue;
      pendingDocs.push({
        sourceKey: key,
        sourceType: "comms_engagement",
        companyId: e.company_id,
        name: `${e.engagement_type}: ${e.subject || "Untitled"} (${dateStr})`,
        content,
      });
      if (pendingDocs.length >= MAX_DOCS_PER_RUN) break;
    }

    // 2b. Company Emails (when populated)
    if (pendingDocs.length < MAX_DOCS_PER_RUN) {
      const { data: emails } = await supabase
        .from("company_emails")
        .select("id, company_id, subject, sender, recipient, body, snippet, date")
        .not("company_id", "is", null)
        .order("date", { ascending: false })
        .limit(MAX_DOCS_PER_RUN);

      for (const e of emails || []) {
        const key = `email_${e.id}`;
        if (vectorizedKeys.has(key)) continue;
        const dateStr = e.date ? new Date(e.date).toLocaleDateString() : "unknown date";
        const content = [
          `Email — ${dateStr}`,
          `From: ${e.sender || "unknown"}`,
          `To: ${e.recipient || "unknown"}`,
          e.subject ? `Subject: ${e.subject}` : null,
          e.body || e.snippet,
        ].filter(Boolean).join("\n\n");

        if (content.length < 30) continue;
        pendingDocs.push({
          sourceKey: key,
          sourceType: "comms_email",
          companyId: e.company_id,
          name: `Email: ${e.subject || "No Subject"} (${dateStr})`,
          content,
        });
        if (pendingDocs.length >= MAX_DOCS_PER_RUN) break;
      }
    }

    // 2c. Company Meetings (when populated — includes transcripts)
    if (pendingDocs.length < MAX_DOCS_PER_RUN) {
      const { data: meetings } = await supabase
        .from("company_meetings")
        .select("id, company_id, title, date, summary, transcript, attendees, duration_minutes")
        .not("company_id", "is", null)
        .order("date", { ascending: false })
        .limit(MAX_DOCS_PER_RUN);

      for (const m of meetings || []) {
        const key = `meeting_${m.id}`;
        if (vectorizedKeys.has(key)) continue;
        const dateStr = m.date ? new Date(m.date).toLocaleDateString() : "unknown date";
        const attendeeStr = Array.isArray(m.attendees)
          ? m.attendees.map((a: any) => a.name || a.email || a).join(", ")
          : "";
        const content = [
          `Meeting: ${m.title || "Untitled"} — ${dateStr}`,
          m.duration_minutes ? `Duration: ${m.duration_minutes} minutes` : null,
          attendeeStr ? `Attendees: ${attendeeStr}` : null,
          m.summary ? `Summary:\n${m.summary}` : null,
          m.transcript ? `Transcript:\n${m.transcript}` : null,
        ].filter(Boolean).join("\n\n");

        if (content.length < 30) continue;
        pendingDocs.push({
          sourceKey: key,
          sourceType: "comms_meeting",
          companyId: m.company_id,
          name: `Meeting: ${m.title || "Untitled"} (${dateStr})`,
          content,
        });
        if (pendingDocs.length >= MAX_DOCS_PER_RUN) break;
      }
    }

    // 2d. Company Messages / Slack (when populated)
    if (pendingDocs.length < MAX_DOCS_PER_RUN) {
      const { data: messages } = await supabase
        .from("company_messages")
        .select("id, company_id, channel_name, author, text, created_at")
        .not("company_id", "is", null)
        .not("text", "is", null)
        .order("created_at", { ascending: false })
        .limit(MAX_DOCS_PER_RUN);

      for (const m of messages || []) {
        const key = `message_${m.id}`;
        if (vectorizedKeys.has(key)) continue;
        const dateStr = m.created_at ? new Date(m.created_at).toLocaleDateString() : "";
        const content = [
          `Slack message in #${m.channel_name || "unknown"} — ${dateStr}`,
          `Author: ${m.author || "unknown"}`,
          m.text,
        ].filter(Boolean).join("\n\n");

        if (content.length < 30) continue;
        pendingDocs.push({
          sourceKey: key,
          sourceType: "comms_message",
          companyId: m.company_id,
          name: `Slack: #${m.channel_name || "?"} by ${m.author || "?"} (${dateStr})`,
          content,
        });
        if (pendingDocs.length >= MAX_DOCS_PER_RUN) break;
      }
    }

    console.log(`[rag-vectorize-comms] ${pendingDocs.length} docs to vectorize`);

    if (pendingDocs.length === 0) {
      await completeSyncRun(supabase, syncRunId, { recordsUpserted: 0, metadata: { message: "Nothing to vectorize" } }, syncRunStartedAt);
      return new Response(JSON.stringify({ success: true, vectorized: 0, message: "Nothing new to vectorize" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 3: Group by company and find/create synthetic sessions ──
    const companyIds = [...new Set(pendingDocs.map(d => d.companyId))];
    const sessionMap: Record<string, string> = {}; // companyId → sessionId

    // Find existing synthetic sessions
    const syntheticDomains = companyIds.map(id => `_comms_${id}`);
    const { data: existingSessions } = await supabase
      .from("crawl_sessions")
      .select("id, domain")
      .in("domain", syntheticDomains);

    for (const s of existingSessions || []) {
      const companyId = s.domain.replace("_comms_", "");
      sessionMap[companyId] = s.id;
    }

    // Create missing sessions
    for (const companyId of companyIds) {
      if (sessionMap[companyId]) continue;
      const { data: session } = await supabase
        .from("crawl_sessions")
        .insert({
          domain: `_comms_${companyId}`,
          base_url: `comms://${companyId}`,
          status: "complete",
          company_id: companyId,
        })
        .select("id")
        .single();
      if (session) sessionMap[companyId] = session.id;
    }

    // ── Step 4: Invoke rag-ingest per company batch ──
    let totalVectorized = 0;
    let totalFailed = 0;
    const typeCounts: Record<string, number> = {};

    for (const companyId of companyIds) {
      const sessionId = sessionMap[companyId];
      if (!sessionId) continue;

      const companyDocs = pendingDocs.filter(d => d.companyId === companyId);

      // Call rag-ingest directly (same Supabase project)
      const { data: result, error } = await supabase.functions.invoke("rag-ingest", {
        body: {
          session_id: sessionId,
          documents: companyDocs.map(d => ({
            name: d.name,
            content: d.content,
            source_type: d.sourceType,
            source_key: d.sourceKey,
          })),
        },
      });

      if (error) {
        console.error(`[rag-vectorize-comms] rag-ingest error for company ${companyId}: ${error.message}`);
        totalFailed += companyDocs.length;
        continue;
      }

      const results = result?.results || [];
      const ready = results.filter((r: any) => r.status === "ready").length;
      totalVectorized += ready;
      totalFailed += results.filter((r: any) => r.status === "error").length;

      for (const d of companyDocs) {
        typeCounts[d.sourceType] = (typeCounts[d.sourceType] || 0) + 1;
      }

      console.log(`[rag-vectorize-comms] Company ${companyId}: ${ready}/${companyDocs.length} vectorized`);
    }

    // ── Step 5: Summary ──
    await completeSyncRun(supabase, syncRunId, {
      recordsUpserted: totalVectorized,
      recordsSkipped: totalFailed,
      metadata: {
        pending_docs: pendingDocs.length,
        companies: companyIds.length,
        by_type: typeCounts,
      },
    }, syncRunStartedAt);

    return new Response(
      JSON.stringify({
        success: true,
        vectorized: totalVectorized,
        failed: totalFailed,
        companies: companyIds.length,
        by_type: typeCounts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[rag-vectorize-comms] Fatal: ${e.message}`);
    if (syncRunId && supabase) {
      try { await failSyncRun(supabase, syncRunId, e); } catch {}
    }
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
