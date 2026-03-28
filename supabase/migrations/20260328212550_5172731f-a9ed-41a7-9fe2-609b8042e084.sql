ALTER TABLE public.project_estimates
  ADD COLUMN IF NOT EXISTS form_count_s integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS form_count_m integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS form_count_l integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complexity_score integer DEFAULT 0;