CREATE TABLE public.knowledge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.crawl_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  sources text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to knowledge_messages" ON public.knowledge_messages
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX idx_knowledge_messages_session ON public.knowledge_messages(session_id, created_at);
