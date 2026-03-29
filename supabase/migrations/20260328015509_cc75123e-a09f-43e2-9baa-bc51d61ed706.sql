-- Global chat threads table (not tied to a single session)
CREATE TABLE public.global_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.global_chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to global_chat_threads"
  ON public.global_chat_threads FOR ALL
  TO public
  USING (true) WITH CHECK (true);

-- Junction table: which sessions (sites) are attached to a global thread
CREATE TABLE public.global_chat_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.global_chat_threads(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.crawl_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id, session_id)
);

ALTER TABLE public.global_chat_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to global_chat_sources"
  ON public.global_chat_sources FOR ALL
  TO public
  USING (true) WITH CHECK (true);

-- Messages for global chat threads
CREATE TABLE public.global_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.global_chat_threads(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  sources text[] DEFAULT '{}'::text[],
  rag_documents jsonb,
  web_citations jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.global_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to global_chat_messages"
  ON public.global_chat_messages FOR ALL
  TO public
  USING (true) WITH CHECK (true);

-- Multi-session vector search function
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks_multi(
  p_session_ids uuid[],
  p_embedding vector,
  p_match_count integer DEFAULT 25,
  p_match_threshold double precision DEFAULT 0.25
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  chunk_index integer,
  chunk_text text,
  document_name text,
  source_type text,
  similarity double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.document_id,
    kc.chunk_index,
    kc.chunk_text,
    kd.name AS document_name,
    kd.source_type,
    1 - (kc.embedding <=> p_embedding) AS similarity
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.session_id = ANY(p_session_ids)
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> p_embedding) > p_match_threshold
  ORDER BY kc.embedding <=> p_embedding
  LIMIT p_match_count;
$$;

-- Auto-update updated_at trigger
CREATE TRIGGER update_global_chat_threads_updated_at
  BEFORE UPDATE ON public.global_chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();