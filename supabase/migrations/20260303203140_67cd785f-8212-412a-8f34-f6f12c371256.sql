
-- Add GTmetrix columns to crawl_pages
ALTER TABLE public.crawl_pages ADD COLUMN gtmetrix_grade text;
ALTER TABLE public.crawl_pages ADD COLUMN gtmetrix_scores jsonb;
ALTER TABLE public.crawl_pages ADD COLUMN gtmetrix_pdf_url text;
ALTER TABLE public.crawl_pages ADD COLUMN gtmetrix_test_id text;

-- Add BuiltWith column to crawl_sessions (tech stack is per-domain, not per-page)
ALTER TABLE public.crawl_sessions ADD COLUMN builtwith_data jsonb;
