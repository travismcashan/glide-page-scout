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
  // ── Batch 2: depends on batch 1 ──
  { key: "tech-analysis", fn: "tech-analysis", column: "tech_analysis_data", batch: 2, buildBody: (s) => ({ domain: s.domain, session_id: s.id }) },
  { key: "avoma", fn: "avoma-lookup", column: "avoma_data", batch: 2, buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
  { key: "apollo", fn: "apollo-enrich", column: "apollo_data", batch: 2, buildBody: (s) => ({ domain: s.prospect_domain || s.domain }) },
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
  // ── Batch 3: depends on batch 2 ──
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

    // 5. Call each integration directly, read response, persist to DB.
    // This is the approach that worked (v26) — no crawl-worker indirection.
    const functionsUrl = `${supabaseUrl}/functions/v1`;

    const SELF_PERSIST_KEYS = new Set([
      "schema", "avoma", "tech-analysis", "semrush", "psi", "builtwith",
    ]);

    // Group by batch
    const batches = new Map<number, typeof toRun>();
    for (const int of toRun) {
      const list = batches.get(int.batch) ?? [];
      list.push(int);
      batches.set(int.batch, list);
    }

    for (const batchNum of [1, 2, 3]) {
      const batch = batches.get(batchNum);
      if (!batch || batch.length === 0) continue;

      // Reload session between batches so dependent integrations see previous data
      let currentSession = session;
      if (batchNum > 1) {
        const { data: reloaded } = await sb
          .from("crawl_sessions").select("*").eq("id", session_id).single();
        if (reloaded) currentSession = reloaded;
      }

      const results = await Promise.allSettled(
        batch.map(async (int) => {
          const body = {
            ...int.buildBody(currentSession),
            _orchestrated: true,
            _session_id: session_id,
            _integration_key: int.key,
            _db_column: int.column,
          };

          try {
            const resp = await fetch(`${functionsUrl}/${int.fn}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anonKey}`,
              },
              body: JSON.stringify(body),
            });

            // Self-persisting functions write their own results
            if (SELF_PERSIST_KEYS.has(int.key)) {
              return { key: int.key, status: resp.status };
            }

            // For all others: read response and write to DB
            if (resp.ok) {
              try {
                const data = await resp.json();
                if (data && !data.error) {
                  await sb.from("crawl_sessions")
                    .update({ [int.column]: data } as any)
                    .eq("id", session_id);
                }
                // Whether data was found or not, the integration ran successfully
                await sb.from("integration_runs")
                  .update({ status: "done" })
                  .eq("session_id", session_id)
                  .eq("integration_key", int.key);
              } catch {
                // Non-JSON response — mark done
                await sb.from("integration_runs")
                  .update({ status: "done" })
                  .eq("session_id", session_id)
                  .eq("integration_key", int.key);
              }
            } else {
              // HTTP error — the function itself broke, mark as failed
              await sb.from("integration_runs")
                .update({ status: "failed" })
                .eq("session_id", session_id)
                .eq("integration_key", int.key);
            }

            return { key: int.key, status: resp.status };
          } catch (e) {
            console.error(`${int.key} failed:`, e);
            await sb.from("integration_runs")
              .update({ status: "failed" })
              .eq("session_id", session_id)
              .eq("integration_key", int.key);
            return { key: int.key, status: 500 };
          }
        })
      );

      console.log(
        `crawl-start batch ${batchNum}: ${results.filter(r => r.status === "fulfilled").length}/${batch.length} completed`
      );
    }

    console.log(`crawl-start: processed ${toRun.length} integrations, skipped ${skippedKeys.length} for session ${session_id}`);

    // Auto-index knowledge base (fire-and-forget — ok if this dies with the isolate)
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
