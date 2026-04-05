/**
 * crawl-phase3: Runs batch 3 integrations (depend on phase 2 results)
 * and marks the session as completed/completed_with_errors.
 * This is the final phase — no further dispatch.
 */
import { getSupabase, runIntegration, runPool, isSessionCancelled, syncEnrichmentToCompany, type Integration } from "../_shared/phase-runner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sb, supabaseUrl, anonKey } = getSupabase();

    // Load fresh session (phase 2 wrote content_types_data, etc.)
    const { data: session } = await sb.from("crawl_sessions").select("*").eq("id", session_id).single();
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`crawl-phase3: starting ${session.domain} (${session_id})`);

    // Check for cancellation before running
    if (await isSessionCancelled(sb, session_id)) {
      console.log(`crawl-phase3: session ${session_id} cancelled, skipping`);
      return new Response(
        JSON.stringify({ success: true, phase: 3, cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Batch 3 integrations — depend on phase 2 results
    const integrations: Integration[] = [
      { key: "apollo-team", fn: "apollo-team-search", column: "apollo_team_data", buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
      { key: "page-tags", fn: "page-tag-orchestrate", column: "page_tags", buildBody: (s) => ({ session_id: s.id }) },
    ];

    // Filter to only pending runs
    const { data: runs } = await sb.from("integration_runs")
      .select("integration_key, status")
      .eq("session_id", session_id)
      .in("integration_key", integrations.map(i => i.key));

    const pendingKeys = new Set(
      (runs || []).filter(r => r.status === "pending" || r.status === "running").map(r => r.integration_key)
    );
    const toRun = integrations.filter(i => pendingKeys.has(i.key));

    console.log(`crawl-phase3: running ${toRun.length} integrations`);

    // Run in parallel (only 2 integrations)
    const tasks = toRun.map(int => () => runIntegration(int, session, sb, supabaseUrl, anonKey));
    await runPool(tasks, 2);

    // Sync company-level enrichment (apollo_team from this phase)
    await syncEnrichmentToCompany(session, sb);

    // ── Mark session complete ──
    // Wait for self-persisting functions to flush their DB writes
    await new Promise(r => setTimeout(r, 2000));

    // Force phase 3 runs that are still "running" to "done" (they completed via runPool)
    // Only target phase 3 keys — don't blanket-update all running integrations
    const phase3Keys = integrations.map(i => i.key);
    await sb.from("integration_runs")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("session_id", session_id)
      .eq("status", "running")
      .in("integration_key", phase3Keys);

    // Now check all runs
    const { data: allRuns } = await sb.from("integration_runs")
      .select("status")
      .eq("session_id", session_id);

    const hasFailed = (allRuns || []).some(r => r.status === "failed");
    const hasStillPending = (allRuns || []).some(r => r.status === "pending");

    // Always mark complete at end of phase 3 — this is the final phase
    const status = hasFailed ? "completed_with_errors" : hasStillPending ? "completed_with_errors" : "completed";
    await sb.from("crawl_sessions").update({ status }).eq("id", session_id);
    console.log(`crawl-phase3: session ${session_id} marked ${status}`);

    console.log(`crawl-phase3: complete for ${session.domain}`);

    return new Response(
      JSON.stringify({ success: true, phase: 3, ran: toRun.length, status: hasFailed ? "completed_with_errors" : "completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("crawl-phase3 error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Phase 3 failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
