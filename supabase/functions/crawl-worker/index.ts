import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Extract URL list from session's discovered_urls */
function extractUrls(session: any): string[] {
  const d = session.discovered_urls;
  if (Array.isArray(d)) return d;
  if (d?.links && Array.isArray(d.links)) return d.links;
  if (d?.urls && Array.isArray(d.urls)) return d.urls;
  return [];
}

/** Rebuild fn_body for batch 2/3 integrations using fresh session data */
function rebuildBody(integration_key: string, session: any): Record<string, unknown> | null {
  switch (integration_key) {
    case "content-types": {
      const urls = extractUrls(session);
      return urls.length > 0 ? { urls, baseUrl: session.base_url, phase: "classify", session_id: session.id } : null;
    }
    case "forms": {
      const urls = extractUrls(session);
      return urls.length > 0 ? { urls, domain: session.domain } : null;
    }
    case "link-checker": {
      const urls = extractUrls(session);
      return urls.length > 0 ? { urls } : null;
    }
    case "apollo-team":
      return { domain: session.prospect_domain || session.domain };
    default:
      return null;
  }
}

/** Check if all integration_runs for a session are finished; if so mark session completed */
async function maybeCompleteSession(sb: any, session_id: string) {
  const { data: runs } = await sb
    .from("integration_runs")
    .select("status")
    .eq("session_id", session_id);
  if (!runs || runs.length === 0) return;
  const allFinished = runs.every((r: any) => r.status === "done" || r.status === "failed" || r.status === "skipped");
  if (allFinished) {
    await sb.from("crawl_sessions").update({ status: "completed" }).eq("id", session_id);
    console.log(`crawl-worker: session ${session_id} marked completed (${runs.length} runs finished)`);
  }
}

/**
 * crawl-worker: Calls a single integration edge function, reads the response,
 * and persists the result to crawl_sessions + integration_runs.
 *
 * Each invocation gets its own 150s timeout (Pro plan).
 * If _wait_for_column is set, polls until that column is populated before proceeding.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, integration_key, db_column, fn_name, fn_body, _wait_for_column } = await req.json();

    if (!session_id || !fn_name || !db_column) {
      return new Response(
        JSON.stringify({ error: "session_id, fn_name, db_column required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Mark as running
    if (integration_key) {
      await sb.from("integration_runs").update({ status: "running" })
        .eq("session_id", session_id)
        .eq("integration_key", integration_key);
    }

    // If this integration depends on another column, poll until it's available
    let actualBody = fn_body;
    if (_wait_for_column) {
      const maxWaitMs = 120_000; // 2 minutes max wait
      const pollIntervalMs = 3_000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        const { data: freshSession } = await sb
          .from("crawl_sessions").select("*").eq("id", session_id).single();

        if (freshSession && freshSession[_wait_for_column] != null) {
          // Dependency is ready — rebuild the body with fresh data
          const rebuilt = rebuildBody(integration_key, freshSession);
          if (rebuilt) {
            actualBody = rebuilt;
          }
          break;
        }

        await new Promise(r => setTimeout(r, pollIntervalMs));
      }

      // If we timed out waiting, check one more time
      const { data: finalCheck } = await sb
        .from("crawl_sessions").select("*").eq("id", session_id).single();
      if (!finalCheck || finalCheck[_wait_for_column] == null) {
        // Dependency never arrived — mark done (no data available, not a failure)
        console.log(`crawl-worker: ${integration_key} timed out waiting for ${_wait_for_column}`);
        if (integration_key) {
          await sb.from("integration_runs").update({ status: "done" })
            .eq("session_id", session_id)
            .eq("integration_key", integration_key);
        }
        await maybeCompleteSession(sb, session_id);
        return new Response(
          JSON.stringify({ success: true, key: integration_key, skipped: "dependency_timeout" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Rebuild body with final data if not rebuilt above
      const rebuilt = rebuildBody(integration_key, finalCheck);
      if (rebuilt) actualBody = rebuilt;
    }

    // Call the actual integration function
    const resp = await fetch(`${supabaseUrl}/functions/v1/${fn_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        ...actualBody,
        _orchestrated: true,
        _session_id: session_id,
        _integration_key: integration_key,
        _db_column: db_column,
      }),
    });

    if (resp.ok) {
      try {
        const data = await resp.json();
        if (data && !data.error) {
          await sb.from("crawl_sessions")
            .update({ [db_column]: data } as any)
            .eq("id", session_id);
        }
        // Whether data was found or not, the integration ran successfully
        if (integration_key) {
          await sb.from("integration_runs")
            .update({ status: "done" })
            .eq("session_id", session_id)
            .eq("integration_key", integration_key);
        }
        await maybeCompleteSession(sb, session_id);
        return new Response(
          JSON.stringify({ success: true, key: integration_key }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch {
        // Non-JSON response — self-persisting function handled it
        if (integration_key) {
          await sb.from("integration_runs")
            .update({ status: "done" })
            .eq("session_id", session_id)
            .eq("integration_key", integration_key);
        }
        await maybeCompleteSession(sb, session_id);
      }
    }

    // HTTP error — the function itself broke
    if (!resp.ok && integration_key) {
      await sb.from("integration_runs")
        .update({ status: "failed" })
        .eq("session_id", session_id)
        .eq("integration_key", integration_key);
    }
    await maybeCompleteSession(sb, session_id);

    return new Response(
      JSON.stringify({ success: resp.ok, key: integration_key, status: resp.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("crawl-worker error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Worker error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
