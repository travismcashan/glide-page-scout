-- Add user_id to crawl_sessions for data ownership
ALTER TABLE public.crawl_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Set default for new rows so user_id is auto-populated
ALTER TABLE public.crawl_sessions ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Drop the wide-open policy
DROP POLICY IF EXISTS "Allow all access to crawl_sessions" ON public.crawl_sessions;

-- User-scoped RLS: users can only see/modify their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.crawl_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
  ON public.crawl_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
  ON public.crawl_sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
  ON public.crawl_sessions FOR DELETE
  USING (user_id = auth.uid());

-- Also scope crawl_pages via session ownership (they reference crawl_sessions)
DROP POLICY IF EXISTS "Allow all access to crawl_pages" ON public.crawl_pages;

CREATE POLICY "Users can access own crawl pages"
  ON public.crawl_pages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = crawl_pages.session_id AND cs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = crawl_pages.session_id AND cs.user_id = auth.uid()
  ));

-- Scope crawl_screenshots via session ownership
DROP POLICY IF EXISTS "Allow all access to crawl_screenshots" ON public.crawl_screenshots;

CREATE POLICY "Users can access own crawl screenshots"
  ON public.crawl_screenshots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = crawl_screenshots.session_id AND cs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = crawl_screenshots.session_id AND cs.user_id = auth.uid()
  ));

-- Scope integration_runs via session ownership
DROP POLICY IF EXISTS "Allow all access to integration_runs" ON public.integration_runs;

CREATE POLICY "Users can access own integration runs"
  ON public.integration_runs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = integration_runs.session_id AND cs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = integration_runs.session_id AND cs.user_id = auth.uid()
  ));
