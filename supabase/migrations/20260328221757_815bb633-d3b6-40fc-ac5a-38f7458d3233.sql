ALTER TABLE public.master_tasks ADD COLUMN is_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.estimate_tasks ADD COLUMN is_required boolean NOT NULL DEFAULT false;