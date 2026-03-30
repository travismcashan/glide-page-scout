import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * crawl-worker: Calls a single integration edge function, reads the response,
 * and persists the result to crawl_sessions + integration_runs.
 *
 * This runs as its own edge function invocation, so each integration gets
 * its own timeout window (no shared timeout with other integrations).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, integration_key, db_column, fn_name, fn_body } = await req.json();

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

    // Call the actual integration function
    const resp = await fetch(`${supabaseUrl}/functions/v1/${fn_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        ...fn_body,
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
          if (integration_key) {
            await sb.from("integration_runs")
              .update({ status: "done" })
              .eq("session_id", session_id)
              .eq("integration_key", integration_key);
          }
          return new Response(
            JSON.stringify({ success: true, key: integration_key }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch {
        // Non-JSON response — self-persisting function handled it
      }
    }

    // If we get here, the function either failed or self-persisted
    if (!resp.ok && integration_key) {
      await sb.from("integration_runs")
        .update({ status: "failed" })
        .eq("session_id", session_id)
        .eq("integration_key", integration_key);
    }

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
