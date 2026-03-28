/**
 * Shared orchestration helpers for edge functions.
 * When invoked by crawl-start, functions receive _orchestrated, _session_id,
 * _integration_key, and _db_column in the request body.
 *
 * Usage in an edge function:
 *   const orch = extractOrchestration(body);
 *   if (orch) await orch.markRunning();
 *   // ... do work ...
 *   if (orch) await orch.markDone(resultToSave);
 *   // or on error:
 *   if (orch) await orch.markFailed(errorMessage);
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface OrchestrationContext {
  sessionId: string;
  integrationKey: string;
  dbColumn: string;
  markRunning: () => Promise<void>;
  markDone: (result: unknown) => Promise<void>;
  markFailed: (errorMessage: string) => Promise<void>;
}

export function extractOrchestration(
  body: Record<string, unknown>
): OrchestrationContext | null {
  if (!body._orchestrated) return null;

  const sessionId = body._session_id as string;
  const integrationKey = body._integration_key as string;
  const dbColumn = body._db_column as string;

  if (!sessionId || !integrationKey || !dbColumn) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  return {
    sessionId,
    integrationKey,
    dbColumn,

    async markRunning() {
      await sb
        .from("integration_runs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("integration_key", integrationKey);
    },

    async markDone(result: unknown) {
      // Write result to crawl_sessions
      await sb
        .from("crawl_sessions")
        .update({ [dbColumn]: result } as any)
        .eq("id", sessionId);

      // Update integration_runs status
      await sb
        .from("integration_runs")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("integration_key", integrationKey);
    },

    async markFailed(errorMessage: string) {
      // Write error sentinel to crawl_sessions
      await sb
        .from("crawl_sessions")
        .update({
          [dbColumn]: { _error: true, message: errorMessage },
        } as any)
        .eq("id", sessionId);

      // Update integration_runs status
      await sb
        .from("integration_runs")
        .update({
          status: "failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("integration_key", integrationKey);
    },
  };
}
