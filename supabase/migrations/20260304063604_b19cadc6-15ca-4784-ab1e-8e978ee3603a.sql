
ALTER TABLE public.crawl_sessions
ADD COLUMN deep_research_data jsonb DEFAULT NULL,
ADD COLUMN observations_data jsonb DEFAULT NULL;
