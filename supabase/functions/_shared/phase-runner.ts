/**
 * Shared helpers for the 3-phase crawl pipeline.
 * Each phase function calls integration edge functions directly via fetch,
 * persists results to DB, and dispatches the next phase.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface Integration {
  key: string;
  fn: string;
  column: string;
  buildBody: (session: any) => Record<string, unknown>;
}

export function getSupabase() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return { sb: createClient(supabaseUrl, serviceKey), supabaseUrl, anonKey };
}

/**
 * Check if session has been cancelled. Returns true if cancelled.
 * Phase functions should call this before running integrations and before dispatching next phase.
 */
export async function isSessionCancelled(sb: any, sessionId: string): Promise<boolean> {
  const { data } = await sb.from("crawl_sessions").select("status").eq("id", sessionId).single();
  return data?.status === "cancelled";
}

/**
 * Run a single integration: call its edge function, persist result, update status.
 * Returns true if data was successfully written, false otherwise.
 */
export async function runIntegration(
  int: Integration,
  session: any,
  sb: any,
  supabaseUrl: string,
  anonKey: string,
): Promise<boolean> {
  const sessionId = session.id;
  try {
    // Check for cancellation before starting
    if (await isSessionCancelled(sb, sessionId)) {
      console.log(`  ⊘ ${int.key} skipped (session cancelled)`);
      await sb.from("integration_runs").update({
        status: "failed",
        error_message: "session cancelled",
        completed_at: new Date().toISOString(),
      }).eq("session_id", sessionId).eq("integration_key", int.key);
      return false;
    }

    // Mark as running
    await sb.from("integration_runs").update({ status: "running", started_at: new Date().toISOString() })
      .eq("session_id", sessionId).eq("integration_key", int.key);

    // Call the integration function with 120s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    const resp = await fetch(`${supabaseUrl}/functions/v1/${int.fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({
        ...int.buildBody(session),
        _orchestrated: true,
        _session_id: sessionId,
        _integration_key: int.key,
        _db_column: int.column,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      let selfPersisted = false;
      try {
        const data = await resp.json();
        if (data && !data.error) {
          // Skip DB write if the function already persisted its own data
          // (indicated by _self_persisted flag or orchestration markDone)
          if (data._self_persisted) {
            selfPersisted = true;
          } else {
            await sb.from("crawl_sessions").update({ [int.column]: data } as any).eq("id", sessionId);
            // Update local session cache so subsequent integrations can read it
            (session as any)[int.column] = data;
          }
        }
      } catch {
        // Non-JSON response = self-persisting function handled everything
        selfPersisted = true;
      }

      // Mark done (self-persisting functions already did this, but idempotent)
      if (!selfPersisted) {
        await sb.from("integration_runs").update({ status: "done", completed_at: new Date().toISOString() })
          .eq("session_id", sessionId).eq("integration_key", int.key);
      }

      console.log(`  ✓ ${int.key} done`);
      return true;
    } else {
      // HTTP error from the integration function
      const errText = await resp.text().catch(() => `HTTP ${resp.status}`);
      console.error(`  ✗ ${int.key} failed: ${resp.status} ${errText.slice(0, 200)}`);
      await sb.from("integration_runs").update({
        status: "failed",
        error_message: `HTTP ${resp.status}`,
        completed_at: new Date().toISOString(),
      }).eq("session_id", sessionId).eq("integration_key", int.key);
      return false;
    }
  } catch (e: any) {
    // Fetch timeout or network error
    const msg = e?.name === "AbortError" ? "timeout (120s)" : (e?.message || "unknown error");
    console.error(`  ✗ ${int.key} error: ${msg}`);
    await sb.from("integration_runs").update({
      status: "failed",
      error_message: msg,
      completed_at: new Date().toISOString(),
    }).eq("session_id", sessionId).eq("integration_key", int.key);
    return false;
  }
}

/**
 * Promise pool: run tasks with a concurrency limit.
 * Returns array of settled results.
 */
export async function runPool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: Promise<T>[] = [];
  const executing = new Set<Promise<T>>();

  for (const task of tasks) {
    const p = task().then(
      (v) => { executing.delete(p); return v; },
      (e) => { executing.delete(p); throw e; },
    );
    executing.add(p);
    results.push(p);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}

/**
 * Dispatch the next phase edge function with retry.
 * Tries once, waits 2s, tries again on failure.
 */
export async function dispatchNextPhase(
  phaseFn: string,
  sessionId: string,
  supabaseUrl: string,
  anonKey: string,
) {
  const doFetch = () => fetch(`${supabaseUrl}/functions/v1/${phaseFn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify({ session_id: sessionId }),
  });

  try {
    const resp = await doFetch();
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  } catch (e) {
    console.error(`Failed to dispatch ${phaseFn} (attempt 1):`, e);
    // Retry after 2s
    await new Promise(r => setTimeout(r, 2000));
    try {
      await doFetch();
    } catch (e2) {
      console.error(`Failed to dispatch ${phaseFn} (attempt 2):`, e2);
    }
  }
}

/**
 * Sync company-level enrichment data from a crawl session to the company.
 * Extracts company intelligence (Apollo org, Ocean, Avoma, SEMrush, HubSpot)
 * from crawl_sessions columns and merges into companies.enrichment_data.
 * Site-specific audit data (PSI, WAVE, W3C, etc.) stays on crawl_sessions.
 */
export async function syncEnrichmentToCompany(session: any, sb: any): Promise<void> {
  if (!session.company_id) return;

  const patch: Record<string, any> = {};

  // Apollo org: extract organization-prefixed fields from mixed person+org response
  if (session.apollo_data && typeof session.apollo_data === 'object' && !session.apollo_data._error) {
    const orgFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(session.apollo_data)) {
      if (k.startsWith('organization')) orgFields[k] = v;
    }
    if (Object.keys(orgFields).length > 0) patch.apollo_org = orgFields;
  }

  // Apollo team: full response
  if (session.apollo_team_data && typeof session.apollo_team_data === 'object' && !session.apollo_team_data._error) {
    patch.apollo_team = session.apollo_team_data;
  }

  // Ocean.io: full response
  if (session.ocean_data && typeof session.ocean_data === 'object' && !session.ocean_data._error) {
    patch.ocean = session.ocean_data;
  }

  // Avoma: full response
  if (session.avoma_data && typeof session.avoma_data === 'object' && !session.avoma_data._error) {
    patch.avoma = session.avoma_data;
  }

  // SEMrush: full response
  if (session.semrush_data && typeof session.semrush_data === 'object' && !session.semrush_data._error) {
    patch.semrush = session.semrush_data;
  }

  // HubSpot: full response
  if (session.hubspot_data && typeof session.hubspot_data === 'object' && !session.hubspot_data._error) {
    patch.hubspot = session.hubspot_data;
  }

  if (Object.keys(patch).length === 0) return;

  // Merge into existing enrichment_data (existing keys preserved, new keys added)
  const { data: company } = await sb.from("companies").select("enrichment_data").eq("id", session.company_id).single();
  const existing = company?.enrichment_data || {};
  const merged = { ...existing, ...patch };

  await sb.from("companies").update({
    enrichment_data: merged,
    updated_at: new Date().toISOString(),
  }).eq("id", session.company_id);

  console.log(`  ⟶ synced ${Object.keys(patch).join(', ')} to company ${session.company_id}`);
}

/** Extract URL list from session's discovered_urls */
export function extractUrls(session: any): string[] {
  const d = session.discovered_urls;
  if (Array.isArray(d)) return d;
  if (d?.links && Array.isArray(d.links)) return d.links;
  if (d?.urls && Array.isArray(d.urls)) return d.urls;
  return [];
}
