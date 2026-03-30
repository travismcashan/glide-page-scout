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
  // ── Batch 3: depends on apollo_data ──
  { key: "apollo-team", fn: "apollo-team-search", column: "apollo_team_data", batch: 3, buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
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

    // 6. Run firecrawl-map DIRECTLY first (it's fast, <2s) so discovered_urls
    // is available before batch 2 workers start. This avoids concurrency issues
    // where firecrawl-map's worker gets queued behind 25 other workers.
    const functionsUrl = `${supabaseUrl}/functions/v1`;
    const firecrawlInt = toRun.find(i => i.key === "firecrawl-map");
    if (firecrawlInt) {
      try {
        await sb.from("integration_runs").update({ status: "running" })
          .eq("session_id", session_id).eq("integration_key", "firecrawl-map");
        const fcResp = await fetch(`${functionsUrl}/${firecrawlInt.fn}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify(firecrawlInt.buildBody(session)),
        });
        if (fcResp.ok) {
          const fcData = await fcResp.json();
          if (fcData && !fcData.error) {
            await sb.from("crawl_sessions").update({ [firecrawlInt.column]: fcData } as any).eq("id", session_id);
            // Update local session so batch 2 buildBody gets fresh URLs
            (session as any)[firecrawlInt.column] = fcData;
          }
          await sb.from("integration_runs").update({ status: "done" })
            .eq("session_id", session_id).eq("integration_key", "firecrawl-map");
        } else {
          await sb.from("integration_runs").update({ status: "failed" })
            .eq("session_id", session_id).eq("integration_key", "firecrawl-map");
        }
        console.log(`crawl-start: firecrawl-map completed directly (${fcResp.status})`);
      } catch (e) {
        console.error("crawl-start: firecrawl-map direct call failed:", e);
        await sb.from("integration_runs").update({ status: "failed" })
          .eq("session_id", session_id).eq("integration_key", "firecrawl-map");
      }
    }

    // 7. Fire remaining integrations through crawl-worker (fire-and-forget).
    // Batch 2 workers no longer need to poll for discovered_urls — it's already in the session.
    const remainingToRun = toRun.filter(i => i.key !== "firecrawl-map");

    for (const int of remainingToRun) {
      const body = {
        session_id,
        integration_key: int.key,
        db_column: int.column,
        fn_name: int.fn,
        fn_body: int.buildBody(session),
        // Tell crawl-worker which column to wait for before calling the function
        ...(int.waitFor ? { _wait_for_column: int.waitFor }
          : int.batch === 2 ? { _wait_for_column: "discovered_urls" }
          : int.batch === 3 ? { _wait_for_column: "apollo_data" }
          : {}),
      };

      // Fire and forget — don't await. Each gets its own isolate + timeout.
      fetch(`${functionsUrl}/crawl-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify(body),
      }).catch(e => console.error(`Failed to dispatch ${int.key}:`, e));
    }

    // 8. Fire a delayed cleanup worker that marks zombie runs as failed after 130s.
    // This catches workers killed by 503/504/OOM before they could update their status.
    fetch(`${functionsUrl}/crawl-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        session_id,
        integration_key: null,
        db_column: "_cleanup",
        fn_name: "_cleanup",
        _cleanup_after_ms: 130_000, // 130s — must be under 150s edge function timeout
      }),
    }).catch(e => console.error(`Failed to dispatch cleanup:`, e));

    console.log(`crawl-start: firecrawl-map direct + dispatched ${remainingToRun.length} workers + cleanup, skipped ${skippedKeys.length} for session ${session_id}`);

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
