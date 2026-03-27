ALTER TABLE public.crawl_sessions ADD COLUMN IF NOT EXISTS ga4_data jsonb DEFAULT NULL;
ALTER TABLE public.crawl_sessions ADD COLUMN IF NOT EXISTS search_console_data jsonb DEFAULT NULL;