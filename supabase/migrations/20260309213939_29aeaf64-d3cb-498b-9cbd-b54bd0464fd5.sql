CREATE TABLE public.crawl_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.crawl_sessions(id) ON DELETE CASCADE,
  url text NOT NULL,
  screenshot_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crawl_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to crawl_screenshots"
  ON public.crawl_screenshots
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);