-- sync_runs: Audit log for sync function executions.
-- Tracks what ran, when, how many records, and any errors.

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  records_upserted INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB
);

-- Index for querying recent runs by function
CREATE INDEX IF NOT EXISTS idx_sync_runs_function_started
  ON public.sync_runs (function_name, started_at DESC);

-- Index for finding stuck/running jobs
CREATE INDEX IF NOT EXISTS idx_sync_runs_status
  ON public.sync_runs (status) WHERE status = 'running';

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

-- Service role can manage sync_runs (edge functions use service_role)
CREATE POLICY "Service role can manage sync_runs"
  ON public.sync_runs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read sync_runs (for Settings/Connections page)
CREATE POLICY "Authenticated users can read sync_runs"
  ON public.sync_runs FOR SELECT
  USING (auth.uid() IS NOT NULL);
