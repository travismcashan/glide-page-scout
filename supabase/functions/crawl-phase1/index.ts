/**
 * crawl-phase1: Runs all batch 1 (independent) integrations with concurrency limit of 8.
 * When done, dispatches crawl-phase2. Single DB connection, no polling.
 */
import { getSupabase, runIntegration, runPool, dispatchNextPhase, isSessionCancelled, syncEnrichmentToCompany, type Integration } from "../_shared/phase-runner.ts";
import { getBatchIntegrations } from "../_shared/integration-registry.ts";

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

    // All batch 1 integrations from registry (independent, no dependencies)
    // firecrawl-map already ran in crawl-start, so skip it here
    const BUILD_BODY: Record<string, (s: any) => Record<string, unknown>> = {
      psi: (s) => ({ url: s.base_url }),
      gtmetrix: (s) => ({ url: s.base_url }),
      crux: (s) => ({ origin: new URL(s.base_url).origin }),
      yellowlab: (s) => ({ url: s.base_url }),
      carbon: (s) => ({ url: s.base_url }),
      semrush: (s) => ({ domain: s.domain }),
      schema: (s) => ({ url: s.base_url }),
      sitemap: (s) => ({ baseUrl: s.base_url }),
      wave: (s) => ({ url: s.base_url }),
      w3c: (s) => ({ url: s.base_url }),
      observatory: (s) => ({ host: new URL(s.base_url).hostname }),
      "nav-structure": (s) => ({ url: s.base_url }),
      readable: (s) => ({ url: s.base_url }),
      httpstatus: (s) => ({ url: s.base_url }),
      builtwith: (s) => ({ domain: s.domain }),
      detectzestack: (s) => ({ domain: s.domain }),
      ocean: (s) => ({ domain: s.domain }),
      hubspot: (s) => ({ domain: s.prospect_domain || s.domain }),
      avoma: (s) => ({ domain: s.prospect_domain || s.domain }),
      apollo: (s) => ({ domain: s.prospect_domain || s.domain }),
      "content-audit": (s) => ({ session_id: s.id }),
    };

    const integrations: Integration[] = getBatchIntegrations(1)
      .filter(def => def.key !== "firecrawl-map") // already ran in crawl-start
      .map(def => ({
        key: def.key,
        fn: def.fn,
        column: def.column,
        buildBody: BUILD_BODY[def.key] || ((s: any) => ({ domain: s.domain })),
      }));

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

    // Sync company-level enrichment data to the company
    await syncEnrichmentToCompany(session, sb);

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
