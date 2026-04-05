# Plan: Implement scheduled sync via pg_cron

## Research Findings

### pg_cron + pg_net Availability

Both `pg_cron` and `pg_net` extensions are available on Supabase Pro plan. Must be enabled via **Dashboard > Database > Extensions**. pg_cron runs in the `postgres` database only. pg_net is the HTTP extension that lets SQL make outbound HTTP calls.

### How Edge Functions Are Called Today

| Function | Request Body | Invoked From |
|----------|-------------|--------------|
| `hubspot-deals-sync` | No body needed (ignores request body) | Frontend: ConnectionsPage manual button |
| `hubspot-contacts-sync` | No body needed (ignores request body) | Frontend: ConnectionsPage manual button |
| `global-sync` | `{ action: 'preview'|'execute', userId, sources?: string[] }` | Frontend: ConnectionsPage, Phase0Map, PhaseCleanup |
| `crawl-recover` | Optional `{ session_id }` — no body = scan all stuck sessions | Frontend: ResultsPage watchdog timer |

All four functions use `SUPABASE_SERVICE_ROLE_KEY` internally (from env vars). When called via pg_net, the Authorization header with service_role key is needed to pass Supabase's gateway auth.

### pg_net Behavior

- `net.http_post()` is **async and fire-and-forget** — queues the request and returns immediately
- Response available in `net._http_response` table (for monitoring)
- Default 5s connection timeout (configurable), but edge function can run longer
- Returns a `bigint` request ID that can be used to check `net._http_response`

### Core SQL Pattern

```sql
select cron.schedule(
  'job-name',
  '*/30 * * * *',  -- cron expression
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/<function-name>',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Security: Service Role Key Storage

The service_role key must be accessible to pg_cron. Options:
1. **Vault secrets** (recommended) — `select vault.create_secret('<key>', 'service_role_key')`, then `(select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')`
2. **App settings** — `ALTER DATABASE postgres SET app.settings.service_role_key = '<key>'` (readable only by postgres role)
3. **Hardcoded in SQL** — simplest but least secure (visible in `cron.job.command`)

Recommendation: Use **Vault secrets** for production, **app settings** for simplicity.

### Cron History

`cron.job_run_details` grows unbounded. Needs a self-cleaning job. Fields: `jobid`, `runid`, `job_pid`, `database`, `username`, `command`, `status`, `return_message`, `start_time`, `end_time`.

## Recommendation

### Architecture: pg_cron + pg_net + sync_runs Log Table

1. **pg_cron** schedules jobs on cron expressions
2. **pg_net** fires HTTP POST to edge functions (fire-and-forget)
3. **`sync_runs` table** logs every execution with status, duration, record counts (written by edge functions themselves, not by pg_cron)
4. **Health monitoring** via a SQL view that flags overdue syncs

### Why Edge Functions Log (Not pg_cron)

pg_net is fire-and-forget — it can't capture the edge function's response body or record counts. Instead, each sync function should write its own log entry to `sync_runs` at start and completion. This gives us richer data (records_affected, error details) than pg_cron's built-in `job_run_details`.

### Schedule

| Function | Interval | Cron Expression | Rationale |
|----------|----------|-----------------|-----------|
| `hubspot-deals-sync` | 30 min | `*/30 * * * *` | Deals change frequently during business hours |
| `hubspot-contacts-sync` | 30 min | `15,45 * * * *` | Offset by 15 min to avoid concurrent HubSpot API load |
| `global-sync` | 6 hours | `0 */6 * * *` | Heavy operation, company list changes slowly |
| `crawl-recover` | 5 min | `*/5 * * * *` | Already designed for pg_cron (see its JSDoc) |
| `clean-cron-history` | Daily | `0 0 * * *` | Prune `cron.job_run_details` older than 7 days |
| `clean-sync-runs` | Daily | `0 1 * * *` | Prune `sync_runs` older than 30 days |

## Implementation Steps

### Phase 1: Create sync_runs Table

- [ ] **Step 1: Migration — create `sync_runs` table**
  ```sql
  CREATE TABLE IF NOT EXISTS public.sync_runs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    function_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    records_affected JSONB DEFAULT '{}'::jsonb,
    error TEXT,
    triggered_by TEXT NOT NULL DEFAULT 'pg_cron' CHECK (triggered_by IN ('pg_cron', 'manual', 'webhook')),
    metadata JSONB DEFAULT '{}'::jsonb
  );
  
  CREATE INDEX idx_sync_runs_function ON public.sync_runs(function_name, started_at DESC);
  CREATE INDEX idx_sync_runs_status ON public.sync_runs(status) WHERE status = 'running';
  
  ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
  
  -- Service role only — no user access needed
  CREATE POLICY "Service role can manage sync_runs"
    ON public.sync_runs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  
  -- Admin read access
  CREATE POLICY "Admins can view sync_runs"
    ON public.sync_runs FOR SELECT
    USING (auth.uid() IS NOT NULL);
  ```

- [ ] **Step 2: Create health monitoring view**
  ```sql
  CREATE OR REPLACE VIEW public.sync_health AS
  WITH latest_runs AS (
    SELECT DISTINCT ON (function_name)
      function_name,
      status,
      started_at,
      completed_at,
      duration_ms,
      error,
      records_affected
    FROM public.sync_runs
    ORDER BY function_name, started_at DESC
  )
  SELECT
    function_name,
    status,
    started_at AS last_run_at,
    completed_at,
    duration_ms,
    error,
    records_affected,
    CASE
      WHEN function_name = 'crawl-recover' AND started_at < now() - interval '10 minutes' THEN true
      WHEN function_name IN ('hubspot-deals-sync', 'hubspot-contacts-sync') AND started_at < now() - interval '1 hour' THEN true
      WHEN function_name = 'global-sync' AND started_at < now() - interval '12 hours' THEN true
      ELSE false
    END AS is_overdue
  FROM latest_runs;
  ```

### Phase 2: Add Logging to Sync Functions

- [ ] **Step 3: Create shared sync logging utility**
  
  New file: `supabase/functions/_shared/sync-logger.ts`
  ```ts
  export async function startSyncRun(supabase, functionName: string, triggeredBy = 'pg_cron') {
    const { data } = await supabase.from('sync_runs').insert({
      function_name: functionName,
      status: 'running',
      triggered_by: triggeredBy,
    }).select('id').single();
    return data?.id;
  }
  
  export async function completeSyncRun(supabase, runId: string, recordsAffected: Record<string, number>) {
    const { data: run } = await supabase.from('sync_runs').select('started_at').eq('id', runId).single();
    const durationMs = run ? Date.now() - new Date(run.started_at).getTime() : null;
    await supabase.from('sync_runs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      records_affected: recordsAffected,
    }).eq('id', runId);
  }
  
  export async function failSyncRun(supabase, runId: string, error: string) {
    const { data: run } = await supabase.from('sync_runs').select('started_at').eq('id', runId).single();
    const durationMs = run ? Date.now() - new Date(run.started_at).getTime() : null;
    await supabase.from('sync_runs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      error,
    }).eq('id', runId);
  }
  ```

- [ ] **Step 4: Add logging to `hubspot-deals-sync`**
  - Import sync-logger
  - At function start: `const runId = await startSyncRun(supabase, 'hubspot-deals-sync', triggeredBy)`
  - Determine `triggeredBy` from request body: `const { source = 'manual' } = await req.json().catch(() => ({}))`
  - At success: `await completeSyncRun(supabase, runId, { deals_synced: synced, deals_skipped: skipped, stale_deleted: staleDeleted, companies_created: companiesCreated })`
  - At catch: `await failSyncRun(supabase, runId, e.message)`

- [ ] **Step 5: Add logging to `hubspot-contacts-sync`** — same pattern

- [ ] **Step 6: Add logging to `global-sync`** — same pattern, records_affected = companies matched/created

- [ ] **Step 7: Add logging to `crawl-recover`** — same pattern, records_affected = sessions recovered

### Phase 3: Store Service Role Key in Vault

- [ ] **Step 8: Store key in Vault** (run once via SQL editor)
  ```sql
  -- Enable vault extension if not already
  CREATE EXTENSION IF NOT EXISTS supabase_vault;
  
  -- Store the service role key
  SELECT vault.create_secret(
    '<SUPABASE_SERVICE_ROLE_KEY>',
    'service_role_key',
    'Service role key for pg_cron edge function calls'
  );
  ```

### Phase 4: Schedule pg_cron Jobs

- [ ] **Step 9: Enable extensions** (via Dashboard or migration)
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  ```

- [ ] **Step 10: Create cron jobs** (migration or SQL editor)
  ```sql
  -- Helper function to call edge functions with auth
  CREATE OR REPLACE FUNCTION public.invoke_edge_function(
    function_name TEXT,
    body JSONB DEFAULT '{}'::JSONB
  ) RETURNS BIGINT AS $$
  DECLARE
    project_url TEXT;
    service_key TEXT;
  BEGIN
    project_url := current_setting('app.settings.supabase_url', true);
    service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
    
    RETURN net.http_post(
      url := project_url || '/functions/v1/' || function_name,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := body
    );
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Schedule sync jobs
  SELECT cron.schedule('hubspot-deals-sync', '*/30 * * * *',
    $$SELECT public.invoke_edge_function('hubspot-deals-sync', '{"source":"pg_cron"}'::jsonb)$$);

  SELECT cron.schedule('hubspot-contacts-sync', '15,45 * * * *',
    $$SELECT public.invoke_edge_function('hubspot-contacts-sync', '{"source":"pg_cron"}'::jsonb)$$);

  SELECT cron.schedule('global-sync', '0 */6 * * *',
    $$SELECT public.invoke_edge_function('global-sync', '{"action":"execute","source":"pg_cron"}'::jsonb)$$);

  SELECT cron.schedule('crawl-recover', '*/5 * * * *',
    $$SELECT public.invoke_edge_function('crawl-recover', '{"source":"pg_cron"}'::jsonb)$$);

  -- Cleanup jobs
  SELECT cron.schedule('clean-cron-history', '0 0 * * *',
    $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$);

  SELECT cron.schedule('clean-sync-runs', '0 1 * * *',
    $$DELETE FROM public.sync_runs WHERE started_at < now() - interval '30 days'$$);
  ```

### Phase 5: Frontend Sync Health Dashboard (optional, future)

- [ ] **Step 11: Add sync health to Settings/Connections page** — query `sync_health` view, show last run time + status per function, highlight overdue syncs in red

## Affected Files

- **`supabase/migrations/NEW.sql`** — sync_runs table, sync_health view, invoke_edge_function helper, cron.schedule calls
- **`supabase/functions/_shared/sync-logger.ts`** — new shared logging utility
- **`supabase/functions/hubspot-deals-sync/index.ts`** — add sync-logger calls (start/complete/fail)
- **`supabase/functions/hubspot-contacts-sync/index.ts`** — add sync-logger calls
- **`supabase/functions/global-sync/index.ts`** — add sync-logger calls
- **`supabase/functions/crawl-recover/index.ts`** — add sync-logger calls

## Dependencies

1. **pg_cron and pg_net extensions must be enabled** via Supabase Dashboard before migration runs
2. **Vault extension** must be enabled and service_role key stored before cron jobs work
3. **`app.settings.supabase_url`** must be set on the database: `ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<ref>.supabase.co'`
4. **Plan #3 (upsert sync)** should be deployed first — the sync functions being scheduled should be the upsert versions, not the delete-all versions
5. **global-sync requires `userId`** in its request body — need to either: (a) make userId optional and have global-sync look it up internally (like deals-sync does), or (b) store a default userId in vault/app settings

## Risks

1. **global-sync userId dependency** — global-sync currently requires `userId` from the request body. pg_cron can't provide a dynamic userId. Need to modify global-sync to fall back to looking up the first user (like hubspot-deals-sync does) when userId is missing. This is the only code change required beyond adding logging.

2. **Service role key rotation** — If the key is rotated, the vault secret must be updated or all cron jobs break silently. Mitigation: sync_health view will flag overdue syncs.

3. **Concurrent execution** — If a sync takes longer than its interval (e.g., global-sync takes >6 hours), pg_cron will start a new instance. Mitigation: add a guard at function start — check sync_runs for a `running` entry for this function, skip if one exists within the last N minutes.

4. **pg_net is fire-and-forget** — If an edge function fails, pg_cron won't know. All failure detection depends on the sync_runs table (written by the edge function itself). If the function crashes before writing, the `running` entry becomes a stuck sentinel. Mitigation: the health view treats `running` entries older than 2x the expected interval as overdue.

5. **Cost** — 4 functions running on schedule will consume edge function invocations. At the defined intervals: ~48 deals-sync/day + ~48 contacts-sync/day + 4 global-sync/day + 288 crawl-recover/day = ~388 invocations/day. Well within Pro plan limits (500K/month).
