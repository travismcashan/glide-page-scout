
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Knowledge documents table - metadata for each document
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.crawl_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'upload', -- 'upload', 'integration', 'scrape'
  source_key TEXT, -- e.g. 'semrush_data', 'psi_data' for integration sources
  content_hash TEXT, -- to avoid re-ingesting identical content
  chunk_count INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'ready', 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Knowledge chunks table - text chunks with vector embeddings
CREATE TABLE public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.crawl_sessions(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_knowledge_documents_session ON public.knowledge_documents(session_id);
CREATE INDEX idx_knowledge_documents_source ON public.knowledge_documents(session_id, source_type);
CREATE INDEX idx_knowledge_chunks_document ON public.knowledge_chunks(document_id);
CREATE INDEX idx_knowledge_chunks_session ON public.knowledge_chunks(session_id);

-- Vector similarity search index (IVFFlat for performance)
CREATE INDEX idx_knowledge_chunks_embedding ON public.knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS policies - open access (matches existing pattern)
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to knowledge_documents"
  ON public.knowledge_documents FOR ALL TO public
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to knowledge_chunks"
  ON public.knowledge_chunks FOR ALL TO public
  USING (true) WITH CHECK (true);

-- Update trigger for knowledge_documents
CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Vector similarity search function
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  p_session_id UUID,
  p_embedding vector(768),
  p_match_count INTEGER DEFAULT 20,
  p_match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_index INTEGER,
  chunk_text TEXT,
  document_name TEXT,
  source_type TEXT,
  similarity FLOAT
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
  WHERE kc.session_id = p_session_id
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> p_embedding) > p_match_threshold
  ORDER BY kc.embedding <=> p_embedding
  LIMIT p_match_count;
$$;
