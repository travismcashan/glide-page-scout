ALTER TABLE public.project_estimates ADD COLUMN pm_percentage numeric NOT NULL DEFAULT 8;
ALTER TABLE public.project_estimates ADD COLUMN qa_percentage numeric NOT NULL DEFAULT 6;