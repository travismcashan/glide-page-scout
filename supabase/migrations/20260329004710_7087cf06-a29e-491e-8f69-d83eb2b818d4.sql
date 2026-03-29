
ALTER TABLE public.master_tasks ADD COLUMN IF NOT EXISTS formula_config jsonb DEFAULT NULL;

COMMENT ON COLUMN public.master_tasks.formula_config IS 'JSON formula definition: calc_type, bucket values, multipliers, variable references';
