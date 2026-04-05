-- pg_cron scheduled sync: automated edge function invocation + health monitoring
--
-- Prerequisites (run manually BEFORE applying this migration):
--   1. Enable pg_cron and pg_net extensions via Supabase Dashboard > Database > Extensions
--   2. Store service_role key in Vault:
--      SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY_HERE', 'service_role_key', 'Service role key for pg_cron edge function calls');

-- ============================================================================
-- 1. Helper function: invoke_edge_function()
-- ============================================================================
-- Reads the service_role key from Supabase Vault and fires an async HTTP POST
-- to the specified edge function via pg_net.

CREATE OR REPLACE FUNCTION public.invoke_edge_function(
  function_name TEXT,
  body JSONB DEFAULT '{}'::JSONB
) RETURNS BIGINT AS $$
DECLARE
  service_key TEXT;
  base_url TEXT := 'https://afgwuqpsxnglxhosczoi.supabase.co/functions/v1/';
BEGIN
  -- Read service_role key from Vault
  SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

  IF service_key IS NULL THEN
    RAISE EXCEPTION 'service_role_key not found in Vault. Run: SELECT vault.create_secret(''YOUR_KEY'', ''service_role_key'');';
  END IF;

  RETURN net.http_post(
    url := base_url || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := body
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.invoke_edge_function IS
  'Invoke a Supabase edge function via pg_net with Vault-stored service_role auth. Used by pg_cron jobs.';

-- ============================================================================
-- 2. Schedule sync jobs
-- ============================================================================

-- HubSpot deals: every 30 min at :00 and :30
SELECT cron.schedule(
  'hubspot-deals-sync',
  '0,30 * * * *',
  $$SELECT public.invoke_edge_function('hubspot-deals-sync', '{"source":"pg_cron"}'::jsonb)$$
);

-- HubSpot contacts: every 30 min at :15 and :45 (offset to avoid concurrent HubSpot API load)
SELECT cron.schedule(
  'hubspot-contacts-sync',
  '15,45 * * * *',
  $$SELECT public.invoke_edge_function('hubspot-contacts-sync', '{"source":"pg_cron"}'::jsonb)$$
);

-- Global sync: every 6 hours (cross-reference all sources, build unified company list)
SELECT cron.schedule(
  'global-sync',
  '0 */6 * * *',
  $$SELECT public.invoke_edge_function('global-sync', '{"action":"sync","source":"pg_cron"}'::jsonb)$$
);

-- Crawl recover: every 5 minutes (mark zombie sessions as failed)
SELECT cron.schedule(
  'crawl-recover',
  '*/5 * * * *',
  $$SELECT public.invoke_edge_function('crawl-recover', '{"source":"pg_cron"}'::jsonb)$$
);

-- ============================================================================
-- 3. Cleanup jobs
-- ============================================================================

-- Purge pg_cron run history older than 7 days (runs daily at midnight UTC)
SELECT cron.schedule(
  'clean-cron-history',
  '0 0 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);

-- Purge sync_runs older than 30 days (runs daily at 1 AM UTC)
SELECT cron.schedule(
  'clean-sync-runs',
  '0 1 * * *',
  $$DELETE FROM public.sync_runs WHERE started_at < now() - interval '30 days'$$
);

-- ============================================================================
-- 4. sync_health view: monitoring dashboard for sync status
-- ============================================================================

CREATE OR REPLACE VIEW public.sync_health AS
WITH expected_intervals AS (
  SELECT * FROM (VALUES
    ('hubspot-deals-sync',    interval '1 hour'),
    ('hubspot-contacts-sync', interval '1 hour'),
    ('global-sync',           interval '12 hours'),
    ('crawl-recover',         interval '10 minutes')
  ) AS t(function_name, max_interval)
),
latest_runs AS (
  SELECT DISTINCT ON (function_name)
    function_name,
    status,
    started_at,
    completed_at,
    duration_ms,
    error_message,
    records_upserted,
    records_deleted,
    records_skipped,
    metadata
  FROM public.sync_runs
  ORDER BY function_name, started_at DESC
)
SELECT
  lr.function_name,
  lr.status,
  lr.started_at AS last_run_at,
  lr.completed_at,
  lr.duration_ms,
  lr.error_message,
  lr.records_upserted,
  lr.records_deleted,
  lr.records_skipped,
  lr.metadata,
  CASE
    WHEN lr.started_at < now() - ei.max_interval THEN true
    WHEN lr.status = 'running' AND lr.started_at < now() - ei.max_interval THEN true
    ELSE false
  END AS is_overdue
FROM latest_runs lr
LEFT JOIN expected_intervals ei USING (function_name);

COMMENT ON VIEW public.sync_health IS
  'Shows last run status for each sync function with is_overdue flag when no successful run within 2x expected interval.';
