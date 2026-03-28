ALTER TABLE public.project_estimates ADD COLUMN template_tier text DEFAULT NULL;
ALTER TABLE public.project_estimates ADD COLUMN page_tier text DEFAULT NULL;
ALTER TABLE public.project_estimates ADD COLUMN content_tier text DEFAULT NULL;
ALTER TABLE public.project_estimates ADD COLUMN tech_tier text DEFAULT NULL;
ALTER TABLE public.project_estimates ADD COLUMN forms_tier text DEFAULT NULL;