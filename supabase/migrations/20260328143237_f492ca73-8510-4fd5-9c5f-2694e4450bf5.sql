
-- Add new columns to master_tasks
ALTER TABLE public.master_tasks
  ADD COLUMN IF NOT EXISTS roles text,
  ADD COLUMN IF NOT EXISTS hours_per_person numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variable_label text,
  ADD COLUMN IF NOT EXISTS default_variable_qty integer;

-- Add new columns to estimate_tasks
ALTER TABLE public.estimate_tasks
  ADD COLUMN IF NOT EXISTS roles text,
  ADD COLUMN IF NOT EXISTS hours_per_person numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variable_label text,
  ADD COLUMN IF NOT EXISTS variable_qty integer;
