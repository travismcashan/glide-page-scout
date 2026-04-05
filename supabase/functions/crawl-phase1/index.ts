/**
 * crawl-phase1: Runs all batch 1 (independent) integrations with concurrency limit of 8.
 * When done, dispatches crawl-phase2. Single DB connection, no polling.
 */
import { getSupabase, runIntegration, runPool, dispatchNextPhase, isSessionCancelled, type Integration } from "../_shared/phase-runner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONCURRENCY = 4;

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

    // Load session
    const { data: session } = await sb.from("crawl_sessions").select("*").eq("id", session_id).single();
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`crawl-phase1: starting ${session.domain} (${session_id})`);

    // Check for cancellation before running
    if (await isSessionCancelled(sb, session_id)) {
      console.log(`crawl-phase1: session ${session_id} cancelled, skipping`);
      return new Response(
        JSON.stringify({ success: true, phase: 1, cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // All batch 1 integrations (independent, no dependencies)
    // firecrawl-map already ran in crawl-start, so skip it here
    const integrations: Integration[] = [
      { key: "builtwith", fn: "builtwith-lookup", column: "builtwith_data", buildBody: (s) => ({ domain: s.domain }) },
      { key: "semrush", fn: "semrush-domain", column: "semrush_data", buildBody: (s) => ({ domain: s.domain }) },
      { key: "psi", fn: "pagespeed-insights", column: "psi_data", buildBody: (s) => ({ url: s.base_url }) },
      { key: "detectzestack", fn: "detectzestack-lookup", column: "detectzestack_data", buildBody: (s) => ({ domain: s.domain }) },
      { key: "gtmetrix", fn: "gtmetrix-test", column: "gtmetrix_scores", buildBody: (s) => ({ url: s.base_url }) },
      { key: "carbon", fn: "website-carbon", column: "carbon_data", buildBody: (s) => ({ url: s.base_url }) },
      { key: "crux", fn: "crux-lookup", column: "crux_data", buildBody: (s) => ({ origin: new URL(s.base_url).origin }) },
      { key: "wave", fn: "wave-lookup", column: "wave_data", buildBody: (s) => ({ url: s.base_url }) },
      { key: "observatory", fn: "observatory-scan", column: "observatory_data", buildBody: (s) => ({ host: new URL(s.base_url).hostname }) },
      { key: "httpstatus", fn: "httpstatus-check", column: "httpstatus_data", buildBody: (s) => ({ url: s.base_url }) },
      { key: "w3c", fn: "w3c-validate", column: "w3c_data", buildBody: (s) => ({ url: s.base_url }) },
      { key: "schema", fn: "schema-validate", column: "schema_data", buildBody: (s) => ({ url: s.base_url }) },
      { key: "readable", fn: "readable-score", column: "readable_data", buildBody: (s) => ({ url: s.base_url }) },
      { key: "yellowlab", fn: "yellowlab-scan", column: "yellowlab_data", buildBody: (s) => ({ url: s.base_url }) },
      { key: "ocean", fn: "ocean-enrich", column: "ocean_data", buildBody: (s) => ({ domain: s.domain }) },
      { key: "hubspot", fn: "hubspot-lookup", column: "hubspot_data", buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
      { key: "sitemap", fn: "sitemap-parse", column: "sitemap_data", buildBody: (s) => ({ baseUrl: s.base_url }) },
      { key: "nav-structure", fn: "nav-extract", column: "nav_structure", buildBody: (s) => ({ url: s.base_url }) },
      { key: "avoma", fn: "avoma-lookup", column: "avoma_data", buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
      { key: "apollo", fn: "apollo-enrich", column: "apollo_data", buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
    ];

    // Filter to only integrations that have pending runs (respect paused/skipped)
    const { data: runs } = await sb.from("integration_runs")
      .select("integration_key, status")
      .eq("session_id", session_id)
      .in("integration_key", integrations.map(i => i.key));

    const pendingKeys = new Set(
      (runs || []).filter(r => r.status === "pending" || r.status === "running").map(r => r.integration_key)
    );
    const toRun = integrations.filter(i => pendingKeys.has(i.key));

    console.log(`crawl-phase1: running ${toRun.length} integrations (${toRun.length} pending, ${integrations.length - toRun.length} skipped)`);

    // Run with concurrency pool
    const tasks = toRun.map(int => () => runIntegration(int, session, sb, supabaseUrl, anonKey));
    await runPool(tasks, CONCURRENCY);

    console.log(`crawl-phase1: complete for ${session.domain}, dispatching phase 2`);

    // Check for cancellation before dispatching next phase
    if (await isSessionCancelled(sb, session_id)) {
      console.log(`crawl-phase1: session ${session_id} cancelled after run, not dispatching phase 2`);
      return new Response(
        JSON.stringify({ success: true, phase: 1, ran: toRun.length, cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Dispatch phase 2
    await dispatchNextPhase("crawl-phase2", session_id, supabaseUrl, anonKey);

    return new Response(
      JSON.stringify({ success: true, phase: 1, ran: toRun.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("crawl-phase1 error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Phase 1 failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
