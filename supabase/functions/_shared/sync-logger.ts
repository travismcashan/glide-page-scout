/**
 * Sync run audit logger.
 *
 * Tracks sync function execution in the sync_runs table for observability.
 * Usage:
 *   const run = await startSyncRun(supabase, 'hubspot-deals-sync');
 *   // ... do work ...
 *   await completeSyncRun(supabase, run.id, { recordsUpserted: 100, recordsDeleted: 5 });
 *   // or on error:
 *   await failSyncRun(supabase, run.id, error);
 */

export interface SyncRun {
  id: string;
  startedAt: number; // Date.now() for duration calc
}

export interface SyncRunStats {
  recordsUpserted?: number;
  recordsDeleted?: number;
  recordsSkipped?: number;
  metadata?: Record<string, any>;
}

export async function startSyncRun(
  supabase: any,
  functionName: string
): Promise<SyncRun> {
  const startedAt = Date.now();
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      function_name: functionName,
      status: "running",
      started_at: new Date(startedAt).toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[sync-logger] Failed to start sync run for ${functionName}:`, error?.message);
    // Return a stub so callers don't crash — completeSyncRun/failSyncRun will no-op
    return { id: "", startedAt };
  }

  return { id: data.id, startedAt };
}

export async function completeSyncRun(
  supabase: any,
  runId: string,
  stats: SyncRunStats,
  startedAt?: number
): Promise<void> {
  if (!runId) return;
  const now = Date.now();
  const { error } = await supabase
    .from("sync_runs")
    .update({
      status: "completed",
      completed_at: new Date(now).toISOString(),
      records_upserted: stats.recordsUpserted ?? 0,
      records_deleted: stats.recordsDeleted ?? 0,
      records_skipped: stats.recordsSkipped ?? 0,
      duration_ms: startedAt ? now - startedAt : null,
      metadata: stats.metadata ?? null,
    })
    .eq("id", runId);

  if (error) {
    console.error(`[sync-logger] Failed to complete sync run ${runId}:`, error.message);
  }
}

export async function failSyncRun(
  supabase: any,
  runId: string,
  error: unknown
): Promise<void> {
  if (!runId) return;
  const errorMessage =
    error instanceof Error ? error.message : String(error);

  const { error: dbError } = await supabase
    .from("sync_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage.substring(0, 2000),
    })
    .eq("id", runId);

  if (dbError) {
    console.error(`[sync-logger] Failed to log sync failure ${runId}:`, dbError.message);
  }
}
