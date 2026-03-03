
-- Move GTmetrix data to session level (one test per domain, on homepage)
ALTER TABLE public.crawl_sessions ADD COLUMN gtmetrix_grade text;
ALTER TABLE public.crawl_sessions ADD COLUMN gtmetrix_scores jsonb;
ALTER TABLE public.crawl_sessions ADD COLUMN gtmetrix_test_id text;
