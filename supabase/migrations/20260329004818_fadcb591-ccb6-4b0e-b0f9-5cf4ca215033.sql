
ALTER TABLE public.estimate_tasks ADD COLUMN IF NOT EXISTS formula_config jsonb DEFAULT NULL;
