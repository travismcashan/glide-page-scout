import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { INTEGRATION_REGISTRY, getAutoIntegrations, type IntegrationDef } from "../_shared/integration-registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Extract URL list from session's discovered_urls */
function extractUrls(session: any): string[] {
  const d = session.discovered_urls;
  if (Array.isArray(d)) return d;
  if (d?.links && Array.isArray(d.links)) return d.links;
  if (d?.urls && Array.isArray(d.urls)) return d.urls;
  return [];
}

/* ── buildBody map ──
 * Runtime-specific payload builders keyed by integration key.
 * These reference session data and URL constructors, so they stay here.
 */
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
  "tech-analysis": (s) => ({ domain: s.domain, session_id: s.id }),
  apollo: (s) => ({ domain: s.prospect_domain || s.domain }),
  "apollo-team": (s) => ({ domain: s.prospect_domain || s.domain }),
  ocean: (s) => ({ domain: s.domain }),
  hubspot: (s) => ({ domain: s.prospect_domain || s.domain }),
  avoma: (s) => ({ domain: s.prospect_domain || s.domain }),
  "firecrawl-map": (s) => ({ url: s.base_url }),
  "content-types": (s) => {
    const urls = extractUrls(s);
    return { urls, baseUrl: s.base_url, phase: "classify", session_id: s.id };
  },
  forms: (s) => {
    const urls = extractUrls(s);
    return { urls, domain: s.domain };
  },
  "link-checker": (s) => {
    const urls = extractUrls(s);
    return { urls };
  },
  "page-tags": (s) => ({ session_id: s.id }),
  "content-audit": (s) => ({ session_id: s.id }),
};

// Build the runtime integration list from the canonical registry + local buildBody map
const INTEGRATIONS = getAutoIntegrations().map(def => ({
  ...def,
  buildBody: BUILD_BODY[def.key] || ((s: any) => ({ domain: s.domain })),
}));

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

    // 5b. Transition session from 'pending' to 'analyzing' now that integration_runs are created
    await sb.from("crawl_sessions").update({ status: "analyzing" }).eq("id", session_id);

    // 6. Run firecrawl-map directly (~2s) — batch 2 needs discovered_urls.
    const functionsUrl = `${supabaseUrl}/functions/v1`;
    const firecrawlInt = toRun.find(i => i.key === "firecrawl-map");
    if (firecrawlInt) {
      try {
        await sb.from("integration_runs").update({ status: "running" })
          .eq("session_id", session_id).eq("integration_key", "firecrawl-map");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
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
