-- sync_config: Maps integration credentials to user_id for sync functions.
-- Enables pg_cron and automation to resolve user_id without a JWT or request body.

CREATE TABLE IF NOT EXISTS public.sync_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_key TEXT NOT NULL DEFAULT 'default',
  default_user_id UUID NOT NULL REFERENCES auth.users(id),
  label TEXT NOT NULL DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only one active config at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_config_active
  ON public.sync_config (is_active) WHERE is_active = true;

ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;

-- Service role can manage sync_config
CREATE POLICY "Service role can manage sync_config"
  ON public.sync_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read sync_config
CREATE POLICY "Authenticated users can read sync_config"
  ON public.sync_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed with Travis's user_id
INSERT INTO public.sync_config (integration_key, default_user_id, label)
VALUES ('default', '0cfce3d7-ae14-40d9-82e0-76c30464cfef', 'Travis (primary)');
