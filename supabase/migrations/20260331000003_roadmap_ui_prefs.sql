-- Persist UI preferences on roadmap: CTA visibility and service catalog sidebar
ALTER TABLE public.roadmaps ADD COLUMN IF NOT EXISTS show_ctas BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.roadmaps ADD COLUMN IF NOT EXISTS catalog_visible BOOLEAN NOT NULL DEFAULT true;
