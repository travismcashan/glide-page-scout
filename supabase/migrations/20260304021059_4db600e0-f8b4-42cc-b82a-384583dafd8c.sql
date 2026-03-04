
CREATE TABLE public.integration_settings (
  id text PRIMARY KEY,
  paused boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to integration_settings"
ON public.integration_settings
FOR ALL
USING (true)
WITH CHECK (true);
