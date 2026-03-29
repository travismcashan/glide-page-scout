ALTER TABLE public.master_tasks ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'task';
ALTER TABLE public.estimate_tasks ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'task';