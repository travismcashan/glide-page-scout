CREATE TABLE public.knowledge_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.crawl_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.knowledge_messages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to knowledge_favorites"
  ON public.knowledge_favorites
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);