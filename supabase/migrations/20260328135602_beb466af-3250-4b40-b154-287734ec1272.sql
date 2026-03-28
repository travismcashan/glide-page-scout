
CREATE TABLE public.integration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.crawl_sessions(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, integration_key)
);

ALTER TABLE public.integration_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to integration_runs" ON public.integration_runs FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.integration_runs;
