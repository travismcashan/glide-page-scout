# Plan: Move crawl-recover from client-side watchdog to pg_cron

## Research Findings

### What crawl-recover does
`supabase/functions/crawl-recover/index.ts` (128 lines) is a watchdog edge function that recovers zombie crawl sessions. It operates in two modes:

**Scan mode** (no body — designed for pg_cron): Queries ALL sessions stuck in `analyzing` >10min or `pending` >2min based on `updated_at`/`created_at` timestamps.

**Targeted mode** (body: `{ session_id }` — used by client): Recovers a specific session.

**Recovery logic per session:**
1. Find all `integration_runs` with status `pending` or `running` for the session
2. Mark them `failed` with error `"timeout — pipeline stalled"` and set `completed_at`
3. Determine final session status: `failed` (no runs at all), `completed_with_errors` (any failed runs), or `completed` (all successful)
4. Update session status

Uses `service_role` key — no auth required. Already built to be called by pg_cron (the comment on line 5 says so explicitly).

### Client-side watchdog (the thing to replace)
`src/pages/ResultsPage.tsx` lines 680-704 — a single `useEffect` hook:

- **Trigger:** Runs when a session is in `pending` or `analyzing` status
- **Logic:** Calculates remaining time from `session.created_at` (2min for pending, 10min for analyzing). If already past timeout, calls immediately. Otherwise, sets a `setTimeout` for the remaining duration.
- **Calls:** `supabase.functions.invoke('crawl-recover', { body: { session_id: sessionId } })` — targeted mode
- **Limitation:** Only works if the user has the ResultsPage open in a browser tab for that specific session. If the tab is closed, no watchdog runs. Batch crawls with no active ResultsPage tab get no recovery.

This is the **ONLY** frontend reference to `crawl-recover` (confirmed by grep).

### Current timeout thresholds
| Status | Timeout | Based on |
|--------|---------|----------|
| `pending` | 2 minutes | `created_at` (client uses this too) |
| `analyzing` | 10 minutes | `updated_at` (edge function) / `created_at` (client — slight mismatch) |

Note: The edge function uses `updated_at` for `analyzing` timeout, but the client uses `created_at`. This is a minor inconsistency — `updated_at` is more correct since the session transitions to `analyzing` after `pending`.

### pg_cron + pg_net infrastructure
- **pg_cron** is available on all Supabase Pro+ plans (GLIDE is on Pro based on the feature set in use)
- **pg_net** extension is needed to make HTTP calls from within PostgreSQL to invoke edge functions
- Neither `pg_cron` nor `pg_net` is currently enabled in this project (no migrations reference them, no existing cron jobs)
- Charlie (Task #7) is researching the same pg_cron pattern for scheduled sync — the infrastructure setup (enabling extensions, creating the cron invocation pattern) should be shared

### How pg_cron would call crawl-recover
```sql
-- Enable extensions (one-time)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule: every 5 minutes, call crawl-recover with no body (scan mode)
SELECT cron.schedule(
  'crawl-recover-watchdog',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/crawl-recover',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Alternative: Pure SQL approach** (no edge function call needed):
Instead of pg_cron calling the edge function via HTTP, the recovery logic could be implemented as a pure SQL function called directly by pg_cron. This avoids the pg_net dependency entirely. However, the edge function approach is simpler (code already exists) and more observable (logs in Supabase dashboard).

## Recommendation

**Phase 1: Add pg_cron job calling the existing edge function.** The edge function already supports scan mode with no body. pg_cron + pg_net is the standard Supabase pattern for scheduled tasks.

**Phase 2: Keep the client-side watchdog as a belt-and-suspenders fallback**, but simplify it. The client watchdog provides faster recovery for the active user's session (immediate on timeout) vs. the pg_cron 5-minute interval. However, the client code should be simplified to just a targeted nudge, not the primary recovery mechanism.

**Phase 3: Add monitoring** via a `recovery_log` table or simply query `integration_runs` for `error_message = 'timeout — pipeline stalled'` to track zombie frequency.

## Implementation Steps

### Phase 1: pg_cron setup (migration)
- [ ] **Step 1: Create migration** — `supabase/migrations/YYYYMMDDHHMMSS_crawl_recover_pgcron.sql` that:
  - Enables `pg_cron` extension (if not already enabled)
  - Enables `pg_net` extension in `extensions` schema (if not already enabled)
  - Creates the cron job `crawl-recover-watchdog` running every 5 minutes
  - Uses `net.http_post` to call the edge function with `service_role_key`
- [ ] **Step 2: Configure Supabase secrets** — Ensure `app.settings.supabase_url` and `app.settings.service_role_key` are set as database settings (or hardcode the project URL in the migration since it's not sensitive)
- [ ] **Step 3: Apply migration** — Via Supabase CLI or dashboard
- [ ] **Step 4: Verify** — Check `cron.job` table to confirm job is scheduled, monitor `cron.job_run_details` for successful executions

### Phase 2: Simplify client-side watchdog
- [ ] **Step 5: Simplify ResultsPage watchdog** — Keep the `useEffect` but reduce it to: if session is stuck past timeout AND user is viewing, invoke crawl-recover targeted. This provides faster recovery for the active session while pg_cron handles abandoned sessions.
- [ ] **Step 6: Add a comment** — Note that pg_cron is the primary watchdog, client-side is the fast-path fallback

### Phase 3: Monitoring
- [ ] **Step 7: Create monitoring query** — SQL query to track zombie frequency:
  ```sql
  SELECT DATE(completed_at) as day, COUNT(*) as zombies
  FROM integration_runs
  WHERE error_message = 'timeout — pipeline stalled'
  GROUP BY DATE(completed_at)
  ORDER BY day DESC;
  ```
- [ ] **Step 8 (Optional): Add recovery_events logging** — Add a `console.log` summary in crawl-recover that could be queried via Supabase logs, or create a lightweight `recovery_log` table if more structured monitoring is needed

## Affected Files

- `supabase/migrations/YYYYMMDDHHMMSS_crawl_recover_pgcron.sql` — **NEW** migration enabling pg_cron + pg_net and scheduling the job
- `supabase/functions/crawl-recover/index.ts` — **NO CHANGES** needed (already supports scan mode)
- `src/pages/ResultsPage.tsx` — **MINOR EDIT** lines 680-704: add comment noting pg_cron is primary, keep as fast-path fallback

## Dependencies

- **Supabase Pro plan** — pg_cron is only available on Pro+ plans (should already be on Pro)
- **pg_net extension** — must be enabled to make HTTP calls from SQL. Available on all Supabase plans.
- **Service role key accessible from SQL** — needs to be stored as a database setting (`ALTER DATABASE postgres SET app.settings.service_role_key = '...'`) or the migration needs to hardcode the edge function URL with the key. The recommended Supabase pattern is to use `vault.secrets` or `app.settings`.
- **Shared infrastructure with Task #7** (scheduled sync pg_cron) — both tasks need pg_cron + pg_net enabled. The extension enablement should be in one shared migration, not duplicated. Coordinate with charlie's plan.

## Risks

- **pg_net reliability:** pg_net HTTP calls are fire-and-forget by default. If the edge function is down or cold-starting, the call may timeout. Mitigation: the 5-minute interval means it will retry on the next cycle.
- **Service role key in SQL:** Storing the service role key as a database setting is the standard Supabase pattern but should be done via the dashboard (not committed to migration files). The migration should reference `current_setting('app.settings.service_role_key')`, and the actual value set via `ALTER DATABASE` in the dashboard.
- **Double recovery:** Both pg_cron and client watchdog could fire for the same session. This is safe — crawl-recover is idempotent (marking already-failed runs as failed is a no-op, and session status updates are also idempotent).
- **Clock skew:** pg_cron runs on the database server clock, client watchdog on the user's browser clock. Minor differences are acceptable given the 2/10 minute thresholds.
- **Cold start latency:** Edge functions on free/Pro have cold starts up to ~5s. For a recovery watchdog this is fine.
- **Cost:** pg_cron + pg_net are free Supabase extensions. The edge function invocation every 5 minutes is negligible (288 calls/day, most returning "no stuck sessions" immediately).
