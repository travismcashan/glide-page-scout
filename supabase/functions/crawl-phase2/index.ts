/**
 * crawl-phase2: Runs batch 2 integrations that depend on phase 1 results.
 * Reads fresh session data (discovered_urls, builtwith_data are already populated).
 * When done, dispatches crawl-phase3.
 */
import { getSupabase, runIntegration, runPool, dispatchNextPhase, extractUrls, isSessionCancelled, type Integration } from "../_shared/phase-runner.ts";

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

    // Load fresh session (phase 1 wrote builtwith_data, discovered_urls, etc.)
    const { data: session } = await sb.from("crawl_sessions").select("*").eq("id", session_id).single();
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`crawl-phase2: starting ${session.domain} (${session_id})`);

    // Check for cancellation before running
    if (await isSessionCancelled(sb, session_id)) {
      console.log(`crawl-phase2: session ${session_id} cancelled, skipping`);
      return new Response(
        JSON.stringify({ success: true, phase: 2, cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Batch 2 integrations — depend on discovered_urls and/or builtwith_data
    const integrations: Integration[] = [
      { key: "tech-analysis", fn: "tech-analysis", column: "tech_analysis_data", buildBody: (s) => ({ domain: s.domain, session_id: s.id }) },
      { key: "content-types", fn: "content-types", column: "content_types_data", buildBody: (s) => {
        const urls = extractUrls(s);
        return { urls, baseUrl: s.base_url, phase: "classify", session_id: s.id };
      }},
      { key: "forms", fn: "forms-detect", column: "forms_data", buildBody: (s) => {
        const urls = extractUrls(s);
        return { urls, domain: s.domain };
      }},
      { key: "link-checker", fn: "link-checker", column: "linkcheck_data", buildBody: (s) => {
        const urls = extractUrls(s);
        return { urls };
      }},
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

    console.log(`crawl-phase2: running ${toRun.length} integrations`);

    // Run all in parallel (only 4 integrations, no need for pool limit)
    const tasks = toRun.map(int => () => runIntegration(int, session, sb, supabaseUrl, anonKey));
    await runPool(tasks, 4);

    console.log(`crawl-phase2: complete for ${session.domain}, dispatching phase 3`);

    // Check for cancellation before dispatching next phase
    if (await isSessionCancelled(sb, session_id)) {
      console.log(`crawl-phase2: session ${session_id} cancelled after run, not dispatching phase 3`);
      return new Response(
        JSON.stringify({ success: true, phase: 2, ran: toRun.length, cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Dispatch phase 3
    await dispatchNextPhase("crawl-phase3", session_id, supabaseUrl, anonKey);

    return new Response(
      JSON.stringify({ success: true, phase: 2, ran: toRun.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("crawl-phase2 error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Phase 2 failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
