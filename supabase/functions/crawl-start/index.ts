import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Integration registry ──
 * Maps integration_key → { fn: edge function name, column: crawl_sessions column, batch }
 * batch 1 = independent, batch 2 = depends on batch 1, batch 3 = depends on batch 2
 */
const INTEGRATIONS: {
  key: string;
  fn: string;
  column: string;
  batch: number;
  buildBody: (session: any) => Record<string, unknown>;
}[] = [
  // ── Batch 1: independent ──
  { key: "builtwith", fn: "builtwith-lookup", column: "builtwith_data", batch: 1, buildBody: (s) => ({ domain: s.domain }) },
  { key: "semrush", fn: "semrush-domain", column: "semrush_data", batch: 1, buildBody: (s) => ({ domain: s.domain }) },
  { key: "psi", fn: "pagespeed-insights", column: "psi_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "detectzestack", fn: "detectzestack-lookup", column: "detectzestack_data", batch: 1, buildBody: (s) => ({ domain: s.domain }) },
  { key: "gtmetrix", fn: "gtmetrix-test", column: "gtmetrix_scores", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "carbon", fn: "website-carbon", column: "carbon_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "crux", fn: "crux-lookup", column: "crux_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "wave", fn: "wave-lookup", column: "wave_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "observatory", fn: "observatory-scan", column: "observatory_data", batch: 1, buildBody: (s) => ({ host: new URL(s.base_url).hostname }) },
  { key: "httpstatus", fn: "httpstatus-check", column: "httpstatus_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "w3c", fn: "w3c-validate", column: "w3c_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "schema", fn: "schema-validate", column: "schema_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "readable", fn: "readable-score", column: "readable_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "yellowlab", fn: "yellowlab-scan", column: "yellowlab_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "ocean", fn: "ocean-enrich", column: "ocean_data", batch: 1, buildBody: (s) => ({ domain: s.domain }) },
  { key: "hubspot", fn: "hubspot-lookup", column: "hubspot_data", batch: 1, buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
  { key: "sitemap", fn: "sitemap-parse", column: "sitemap_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "nav-structure", fn: "nav-extract", column: "nav_structure", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "firecrawl-map", fn: "firecrawl-map", column: "discovered_urls", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  // ── Batch 2: depends on batch 1 ──
  { key: "tech-analysis", fn: "tech-analysis", column: "tech_analysis_data", batch: 2, buildBody: (s) => ({ domain: s.domain, session_id: s.id }) },
  { key: "avoma", fn: "avoma-lookup", column: "avoma_data", batch: 2, buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
  { key: "apollo", fn: "apollo-enrich", column: "apollo_data", batch: 2, buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
  { key: "content-types", fn: "content-types", column: "content_types_data", batch: 2, buildBody: (s) => ({ session_id: s.id }) },
  { key: "forms", fn: "forms-detect", column: "forms_data", batch: 2, buildBody: (s) => ({ session_id: s.id }) },
  { key: "link-checker", fn: "link-checker", column: "linkcheck_data", batch: 2, buildBody: (s) => ({ session_id: s.id }) },
  // ── Batch 3: depends on batch 2 ──
  { key: "apollo-team", fn: "apollo-team-search", column: "apollo_team_data", batch: 3, buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
  { key: "observations", fn: "observations-insights", column: "observations_data", batch: 3, buildBody: (s) => ({ session_id: s.id }) },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, integration_overrides } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Load session
    const { data: session, error: sessionErr } = await sb
      .from("crawl_sessions")
      .select("*")
      .eq("id", session_id)
      .single();
    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load paused integrations
    const { data: settings } = await sb
      .from("integration_settings")
      .select("id, paused");
    const pausedSet = new Set<string>();
    if (settings) {
      for (const s of settings) {
        if (s.paused) pausedSet.add(s.id);
      }
    }

    // 3. Apply integration_overrides from group picker (paused overrides)
    if (integration_overrides && typeof integration_overrides === 'object') {
      for (const [key, val] of Object.entries(integration_overrides)) {
        if ((val as any)?.paused) pausedSet.add(key);
        else pausedSet.delete(key);
      }
    }

    // 4. Determine which integrations to run
    // Skip if paused or if data already exists in session
    const toRun = INTEGRATIONS.filter((int) => {
      if (pausedSet.has(int.key)) return false;
      const existingData = (session as any)[int.column];
      if (existingData !== null && existingData !== undefined) return false;
      return true;
    });

    const skippedKeys = INTEGRATIONS.filter(
      (int) => pausedSet.has(int.key)
    ).map((int) => int.key);

    // 4. Insert integration_runs rows
    const runRows = [
      ...toRun.map((int) => ({
        session_id,
        integration_key: int.key,
        status: "pending",
      })),
      ...skippedKeys.map((key) => ({
        session_id,
        integration_key: key,
        status: "skipped",
      })),
    ];

    if (runRows.length > 0) {
      await sb.from("integration_runs").upsert(runRows, {
        onConflict: "session_id,integration_key",
      });
    }

    // 5. Dispatch each integration via crawl-worker for independent timeouts.
    // Each crawl-worker invocation gets its own 400s timeout (Pro plan),
    // so a slow integration can't block or kill others.
    const functionsUrl = `${supabaseUrl}/functions/v1`;

    const SELF_PERSIST_KEYS = new Set([
      "schema", "avoma", "tech-analysis", "semrush", "psi", "builtwith",
    ]);

    // Group by batch
    const batch1 = toRun.filter(i => i.batch === 1);
    const batch2 = toRun.filter(i => i.batch === 2);
    const batch3 = toRun.filter(i => i.batch === 3);

    // Fire one integration — self-persisting go direct, others via crawl-worker
    const fireOne = (int: typeof toRun[0], sessionData: any) => {
      const body = int.buildBody(sessionData);
      if (SELF_PERSIST_KEYS.has(int.key)) {
        return fetch(`${functionsUrl}/${int.fn}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ ...body, _orchestrated: true, _session_id: session_id, _integration_key: int.key, _db_column: int.column }),
        }).then(r => ({ key: int.key, status: r.status })).catch(e => { console.error(`${int.key} failed:`, e); return { key: int.key, status: 500 }; });
      } else {
        return fetch(`${functionsUrl}/crawl-worker`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ session_id, integration_key: int.key, db_column: int.column, fn_name: int.fn, fn_body: body }),
        }).then(r => ({ key: int.key, status: r.status })).catch(e => { console.error(`${int.key} worker failed:`, e); return { key: int.key, status: 500 }; });
      }
    };

    // Batch 1: fire all in parallel, await completion
    const b1Results = await Promise.allSettled(batch1.map(int => fireOne(int, session)));
    console.log(`crawl-start batch 1: ${b1Results.filter(r => r.status === 'fulfilled').length}/${batch1.length} dispatched`);

    // Batch 2: reload session (batch 1 results now in DB), fire all
    if (batch2.length > 0) {
      const { data: freshSession } = await sb.from("crawl_sessions").select("*").eq("id", session_id).single();
      const b2Results = await Promise.allSettled(batch2.map(int => fireOne(int, freshSession || session)));
      console.log(`crawl-start batch 2: ${b2Results.filter(r => r.status === 'fulfilled').length}/${batch2.length} dispatched`);
    }

    // Batch 3: reload session, fire all
    if (batch3.length > 0) {
      const { data: freshSession } = await sb.from("crawl_sessions").select("*").eq("id", session_id).single();
      const b3Results = await Promise.allSettled(batch3.map(int => fireOne(int, freshSession || session)));
      console.log(`crawl-start batch 3: ${b3Results.filter(r => r.status === 'fulfilled').length}/${batch3.length} dispatched`);
    }

    console.log(`crawl-start: dispatched ${toRun.length} integrations, skipped ${skippedKeys.length} for session ${session_id}`);

    // Auto-index knowledge base (fire-and-forget)
    fetch(`${functionsUrl}/auto-index`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ session_id }),
    }).catch(e => console.error("auto-index failed:", e));

    return new Response(
      JSON.stringify({
        success: true,
        fired: toRun.map((i) => i.key),
        skipped: skippedKeys,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("crawl-start error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
