/**
 * crawl-retry: Retry only failed integrations on completed_with_errors sessions.
 *
 * Modes:
 * 1. Single session: { "session_id": "uuid" }
 * 2. All errors:     {} (finds all completed_with_errors sessions and retries them)
 *
 * For each session:
 * - Finds failed integration_runs
 * - Nulls out error sentinel data columns so crawl-start sees them as "needs running"
 * - Deletes the failed integration_runs rows
 * - Resets session status to "pending"
 * - Re-invokes crawl-start (which skips integrations that already have data)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Maps integration_key → crawl_sessions column name */
const KEY_TO_COLUMN: Record<string, string> = {
  "builtwith": "builtwith_data",
  "semrush": "semrush_data",
  "psi": "psi_data",
  "detectzestack": "detectzestack_data",
  "gtmetrix": "gtmetrix_scores",
  "carbon": "carbon_data",
  "crux": "crux_data",
  "wave": "wave_data",
  "observatory": "observatory_data",
  "httpstatus": "httpstatus_data",
  "w3c": "w3c_data",
  "schema": "schema_data",
  "readable": "readable_data",
  "yellowlab": "yellowlab_data",
  "ocean": "ocean_data",
  "hubspot": "hubspot_data",
  "sitemap": "sitemap_data",
  "nav-structure": "nav_structure",
  "firecrawl-map": "discovered_urls",
  "tech-analysis": "tech_analysis_data",
  "avoma": "avoma_data",
  "apollo": "apollo_data",
  "content-types": "content_types_data",
  "forms": "forms_data",
  "link-checker": "linkcheck_data",
  "apollo-team": "apollo_team_data",
  "page-tags": "page_tags",
  "ga4": "ga4_data",
  "search-console": "search_console_data",
};

const CONCURRENCY = 3;
const BATCH_DELAY_MS = 5_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);
    const functionsUrl = `${supabaseUrl}/functions/v1`;

    // Parse input
    let targetSessionIds: string[] = [];
    try {
      const body = await req.json();
      if (body?.session_id) {
        targetSessionIds = [body.session_id];
      }
    } catch {
      // No body = retry all
    }

    // Find sessions to retry
    if (targetSessionIds.length === 0) {
      const { data: sessions } = await sb
        .from("crawl_sessions")
        .select("id")
        .eq("status", "completed_with_errors");
      targetSessionIds = (sessions || []).map((s: any) => s.id);
    }

    if (targetSessionIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No sessions with errors found", retried: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`crawl-retry: ${targetSessionIds.length} sessions to retry`);

    const results: { sessionId: string; domain: string; failedKeys: string[]; status: string }[] = [];

    // Process each session
    const tasks = targetSessionIds.map((sessionId) => async () => {
      // 1. Get session domain
      const { data: session } = await sb
        .from("crawl_sessions")
        .select("id, domain")
        .eq("id", sessionId)
        .single();

      if (!session) {
        results.push({ sessionId, domain: "unknown", failedKeys: [], status: "session-not-found" });
        return;
      }

      // 2. Find failed integration_runs
      const { data: failedRuns } = await sb
        .from("integration_runs")
        .select("integration_key")
        .eq("session_id", sessionId)
        .eq("status", "failed");

      if (!failedRuns || failedRuns.length === 0) {
        results.push({ sessionId, domain: session.domain, failedKeys: [], status: "no-failures" });
        return;
      }

      const failedKeys = failedRuns.map((r: any) => r.integration_key);
      console.log(`  ${session.domain}: retrying ${failedKeys.length} failed integrations: ${failedKeys.join(", ")}`);

      // 3. Null out error sentinel columns
      const columnsToNull: Record<string, null> = {};
      for (const key of failedKeys) {
        const col = KEY_TO_COLUMN[key];
        if (col) columnsToNull[col] = null;
      }

      if (Object.keys(columnsToNull).length > 0) {
        await sb
          .from("crawl_sessions")
          .update(columnsToNull as any)
          .eq("id", sessionId);
      }

      // 4. Delete failed integration_runs (crawl-start will recreate them)
      await sb
        .from("integration_runs")
        .delete()
        .eq("session_id", sessionId)
        .eq("status", "failed");

      // 5. Reset session status
      await sb
        .from("crawl_sessions")
        .update({ status: "pending" } as any)
        .eq("id", sessionId);

      // 6. Re-invoke crawl-start
      try {
        const resp = await fetch(`${functionsUrl}/crawl-start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const ok = resp.ok;
        console.log(`  ${session.domain}: crawl-start ${ok ? "started" : "failed"}`);
        results.push({ sessionId, domain: session.domain, failedKeys, status: ok ? "retrying" : "crawl-start-failed" });
      } catch (err) {
        console.error(`  ${session.domain}: crawl-start error:`, err);
        results.push({ sessionId, domain: session.domain, failedKeys, status: "error" });
      }
    });

    // Run in batches
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      const batch = tasks.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((fn) => fn()));
      if (i + CONCURRENCY < tasks.length) {
        console.log(`  Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
        await sleep(BATCH_DELAY_MS);
      }
    }

    const retriedCount = results.filter((r) => r.status === "retrying").length;
    console.log(`crawl-retry: complete. ${retriedCount} sessions retrying.`);

    return new Response(
      JSON.stringify({ success: true, retried: retriedCount, total: targetSessionIds.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("crawl-retry error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Retry failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
