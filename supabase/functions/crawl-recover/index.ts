/**
 * crawl-recover: Watchdog for zombie crawl sessions.
 *
 * Can be called:
 * 1. By a pg_cron job every 5 minutes (no body needed — scans all stuck sessions)
 * 2. By the client for a specific session_id (targeted recovery)
 *
 * Finds sessions stuck in 'analyzing' or 'pending' for too long,
 * marks their zombie integration_runs as failed, and completes the session.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** How long before a session is considered stuck */
const ANALYZING_TIMEOUT_MINUTES = 10;
const PENDING_TIMEOUT_MINUTES = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    let sessionIds: string[] = [];

    // Parse optional body for targeted recovery
    try {
      const body = await req.json();
      if (body?.session_id) {
        sessionIds = [body.session_id];
      }
    } catch {
      // No body = scan mode
    }

    // If no specific session, find all stuck sessions
    if (sessionIds.length === 0) {
      // Stuck in 'analyzing' for > 10 minutes
      const { data: stuckAnalyzing } = await sb
        .from("crawl_sessions")
        .select("id")
        .eq("status", "analyzing")
        .lt("updated_at", new Date(Date.now() - ANALYZING_TIMEOUT_MINUTES * 60_000).toISOString());

      // Stuck in 'pending' for > 2 minutes (crawl-start never completed)
      const { data: stuckPending } = await sb
        .from("crawl_sessions")
        .select("id")
        .eq("status", "pending")
        .lt("created_at", new Date(Date.now() - PENDING_TIMEOUT_MINUTES * 60_000).toISOString());

      sessionIds = [
        ...(stuckAnalyzing || []).map(s => s.id),
        ...(stuckPending || []).map(s => s.id),
      ];
    }

    if (sessionIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, recovered: 0, message: "No stuck sessions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`crawl-recover: recovering ${sessionIds.length} stuck sessions`);

    let recovered = 0;
    for (const sessionId of sessionIds) {
      // Mark zombie integration_runs as failed
      const { data: zombies } = await sb
        .from("integration_runs")
        .select("integration_key")
        .eq("session_id", sessionId)
        .in("status", ["pending", "running"]);

      if (zombies && zombies.length > 0) {
        const keys = zombies.map((z: any) => z.integration_key);
        console.log(`  Session ${sessionId}: marking ${keys.length} zombie runs as failed: ${keys.join(", ")}`);

        await sb.from("integration_runs")
          .update({
            status: "failed",
            error_message: "timeout — pipeline stalled",
            completed_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId)
          .in("status", ["pending", "running"]);
      }

      // Check final status
      const { data: allRuns } = await sb
        .from("integration_runs")
        .select("status")
        .eq("session_id", sessionId);

      const hasFailed = (allRuns || []).some((r: any) => r.status === "failed");
      const hasNoRuns = !allRuns || allRuns.length === 0;
      const finalStatus = hasNoRuns ? "failed" : hasFailed ? "completed_with_errors" : "completed";

      await sb.from("crawl_sessions")
        .update({ status: finalStatus })
        .eq("id", sessionId);

      console.log(`  Session ${sessionId}: marked ${finalStatus}`);
      recovered++;
    }

    return new Response(
      JSON.stringify({ success: true, recovered, sessionIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("crawl-recover error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Recovery failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
