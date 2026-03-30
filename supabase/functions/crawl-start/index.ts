import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Extract URL list from session's discovered_urls (handles array or {links:[...]} or {urls:[...]} formats) */
function extractUrls(session: any): string[] {
  const d = session.discovered_urls;
  if (Array.isArray(d)) return d;
  if (d?.links && Array.isArray(d.links)) return d.links;
  if (d?.urls && Array.isArray(d.urls)) return d.urls;
  return [];
}

/* ── Integration registry ──
 * Maps integration_key → { fn, column, batch, buildBody }
 * batch 1 = independent (fire immediately)
 * batch 2 = depends on discovered_urls from batch 1
 * batch 3 = depends on batch 2 (apollo_data)
 */
const INTEGRATIONS: {
  key: string;
  fn: string;
  column: string;
  batch: number;
  waitFor?: string; // column to poll for before calling the function
  buildBody: (session: any) => Record<string, unknown>;
}[] = [
  // ── Batch 1: independent ──
  { key: "builtwith", fn: "builtwith-lookup", column: "builtwith_data", batch: 1, buildBody: (s) => ({ domain: s.domain }) },
  { key: "semrush", fn: "semrush-domain", column: "semrush_data", batch: 1, buildBody: (s) => ({ domain: s.domain }) },
  { key: "psi", fn: "pagespeed-insights", column: "psi_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "detectzestack", fn: "detectzestack-lookup", column: "detectzestack_data", batch: 1, buildBody: (s) => ({ domain: s.domain }) },
  { key: "gtmetrix", fn: "gtmetrix-test", column: "gtmetrix_scores", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "carbon", fn: "website-carbon", column: "carbon_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "crux", fn: "crux-lookup", column: "crux_data", batch: 1, buildBody: (s) => ({ origin: new URL(s.base_url).origin }) },
  { key: "wave", fn: "wave-lookup", column: "wave_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "observatory", fn: "observatory-scan", column: "observatory_data", batch: 1, buildBody: (s) => ({ host: new URL(s.base_url).hostname }) },
  { key: "httpstatus", fn: "httpstatus-check", column: "httpstatus_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "w3c", fn: "w3c-validate", column: "w3c_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "schema", fn: "schema-validate", column: "schema_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "readable", fn: "readable-score", column: "readable_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "yellowlab", fn: "yellowlab-scan", column: "yellowlab_data", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "ocean", fn: "ocean-enrich", column: "ocean_data", batch: 1, buildBody: (s) => ({ domain: s.domain }) },
  { key: "hubspot", fn: "hubspot-lookup", column: "hubspot_data", batch: 1, buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
  { key: "sitemap", fn: "sitemap-parse", column: "sitemap_data", batch: 1, buildBody: (s) => ({ baseUrl: s.base_url }) },
  { key: "nav-structure", fn: "nav-extract", column: "nav_structure", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  { key: "firecrawl-map", fn: "firecrawl-map", column: "discovered_urls", batch: 1, buildBody: (s) => ({ url: s.base_url }) },
  // ── Batch 1 (moved from batch 2 — these don't actually depend on batch 1) ──
  { key: "tech-analysis", fn: "tech-analysis", column: "tech_analysis_data", batch: 2, waitFor: "builtwith_data", buildBody: (s) => ({ domain: s.domain, session_id: s.id }) },
  { key: "avoma", fn: "avoma-lookup", column: "avoma_data", batch: 1, buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
  { key: "apollo", fn: "apollo-enrich", column: "apollo_data", batch: 1, buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
  // ── Batch 2: depends on discovered_urls ──
  { key: "content-types", fn: "content-types", column: "content_types_data", batch: 2, buildBody: (s) => {
    const urls = extractUrls(s);
    return { urls, baseUrl: s.base_url, phase: "classify", session_id: s.id };
  }},
  { key: "forms", fn: "forms-detect", column: "forms_data", batch: 2, buildBody: (s) => {
    const urls = extractUrls(s);
    return { urls, domain: s.domain };
  }},
  { key: "link-checker", fn: "link-checker", column: "linkcheck_data", batch: 2, buildBody: (s) => {
    const urls = extractUrls(s);
    return { urls };
  }},
  // ── Batch 3: depends on other batch 2 results ──
  { key: "apollo-team", fn: "apollo-team-search", column: "apollo_team_data", batch: 3, waitFor: "apollo_data", buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
  { key: "page-tags", fn: "page-tag-orchestrate", column: "page_tags", batch: 3, waitFor: "content_types_data", buildBody: (s) => ({ session_id: s.id }) },
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

    // 3. Apply integration_overrides from group picker
    if (integration_overrides && typeof integration_overrides === 'object') {
      for (const [key, val] of Object.entries(integration_overrides)) {
        if ((val as any)?.paused) pausedSet.add(key);
        else pausedSet.delete(key);
      }
    }

    // 4. Determine which integrations to run
    const toRun = INTEGRATIONS.filter((int) => {
      if (pausedSet.has(int.key)) return false;
      const existingData = (session as any)[int.column];
      if (existingData !== null && existingData !== undefined) return false;
      return true;
    });

    const skippedKeys = INTEGRATIONS.filter(
      (int) => pausedSet.has(int.key)
    ).map((int) => int.key);

    // 5. Insert integration_runs rows
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

    // 6. Run firecrawl-map directly (~2s) — batch 2 needs discovered_urls.
    const functionsUrl = `${supabaseUrl}/functions/v1`;
    const firecrawlInt = toRun.find(i => i.key === "firecrawl-map");
    if (firecrawlInt) {
      try {
        await sb.from("integration_runs").update({ status: "running" })
          .eq("session_id", session_id).eq("integration_key", "firecrawl-map");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const resp = await fetch(`${functionsUrl}/${firecrawlInt.fn}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify(firecrawlInt.buildBody(session)),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const data = await resp.json();
          if (data && !data.error) {
            await sb.from("crawl_sessions").update({ [firecrawlInt.column]: data } as any).eq("id", session_id);
          }
          await sb.from("integration_runs").update({ status: "done" })
            .eq("session_id", session_id).eq("integration_key", "firecrawl-map");
        } else {
          await sb.from("integration_runs").update({ status: "failed" })
            .eq("session_id", session_id).eq("integration_key", "firecrawl-map");
        }
      } catch (e) {
        console.error("crawl-start: firecrawl-map direct call failed:", e);
        await sb.from("integration_runs").update({ status: "failed" })
          .eq("session_id", session_id).eq("integration_key", "firecrawl-map");
      }
    }

    // 7. Dispatch 3-phase pipeline (fire-and-forget).
    // Phase 1 → Phase 2 → Phase 3, each runs as a single edge function.
    // 3 workers total instead of 24. No dependency polling. No cleanup worker.
    fetch(`${functionsUrl}/crawl-phase1`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ session_id }),
    }).catch(e => console.error("Failed to dispatch crawl-phase1:", e));

    console.log(`crawl-start: firecrawl-map direct + dispatched phase pipeline, skipped ${skippedKeys.length} for session ${session_id}`);

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
