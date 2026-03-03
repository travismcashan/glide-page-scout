
-- Crawl sessions table
CREATE TABLE public.crawl_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  base_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crawl_sessions ENABLE ROW LEVEL SECURITY;

-- Public access (no auth required per plan)
CREATE POLICY "Allow all access to crawl_sessions"
  ON public.crawl_sessions FOR ALL
  USING (true) WITH CHECK (true);

-- Crawled pages table
CREATE TABLE public.crawl_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.crawl_sessions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  raw_content TEXT,
  ai_outline TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crawl_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to crawl_pages"
  ON public.crawl_pages FOR ALL
  USING (true) WITH CHECK (true);

-- Timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_crawl_sessions_updated_at
  BEFORE UPDATE ON public.crawl_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
