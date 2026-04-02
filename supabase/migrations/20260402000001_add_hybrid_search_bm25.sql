
-- Add tsvector column for full-text search (BM25-style ranking)
ALTER TABLE public.knowledge_chunks ADD COLUMN IF NOT EXISTS search_text tsvector;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_search_text
  ON public.knowledge_chunks USING gin(search_text);

-- Auto-populate tsvector on insert/update via trigger
CREATE OR REPLACE FUNCTION public.knowledge_chunks_search_text_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := to_tsvector('english', COALESCE(NEW.chunk_text, ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_knowledge_chunks_search_text
  BEFORE INSERT OR UPDATE OF chunk_text ON public.knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.knowledge_chunks_search_text_trigger();

-- Backfill existing rows
UPDATE public.knowledge_chunks
SET search_text = to_tsvector('english', COALESCE(chunk_text, ''))
WHERE search_text IS NULL;

-- ============================================================
-- Hybrid search: combines vector similarity + BM25 text ranking
-- Uses Reciprocal Rank Fusion (RRF) to merge the two rankings
-- ============================================================

-- 1. Single-session hybrid search
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks_hybrid(
  p_session_id UUID,
  p_embedding vector(768),
  p_query TEXT,
  p_match_count INTEGER DEFAULT 20,
  p_match_threshold FLOAT DEFAULT 0.2,
  p_vector_weight FLOAT DEFAULT 0.7,
  p_text_weight FLOAT DEFAULT 0.3,
  p_rrf_k INTEGER DEFAULT 60
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
  WITH vector_results AS (
    SELECT
      kc.id,
      kc.document_id,
      kc.chunk_index,
      kc.chunk_text,
      kd.name AS document_name,
      kd.source_type,
      1 - (kc.embedding <=> p_embedding) AS vec_similarity,
      ROW_NUMBER() OVER (ORDER BY kc.embedding <=> p_embedding) AS vec_rank
    FROM public.knowledge_chunks kc
    JOIN public.knowledge_documents kd ON kd.id = kc.document_id
    WHERE kc.session_id = p_session_id
      AND kc.embedding IS NOT NULL
      AND 1 - (kc.embedding <=> p_embedding) > p_match_threshold
    ORDER BY kc.embedding <=> p_embedding
    LIMIT p_match_count * 3
  ),
  text_results AS (
    SELECT
      kc.id,
      kc.document_id,
      kc.chunk_index,
      kc.chunk_text,
      kd.name AS document_name,
      kd.source_type,
      ts_rank_cd(kc.search_text, websearch_to_tsquery('english', p_query)) AS text_rank_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kc.search_text, websearch_to_tsquery('english', p_query)) DESC) AS text_rank
    FROM public.knowledge_chunks kc
    JOIN public.knowledge_documents kd ON kd.id = kc.document_id
    WHERE kc.session_id = p_session_id
      AND kc.search_text IS NOT NULL
      AND kc.search_text @@ websearch_to_tsquery('english', p_query)
    ORDER BY ts_rank_cd(kc.search_text, websearch_to_tsquery('english', p_query)) DESC
    LIMIT p_match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, t.id) AS id,
      COALESCE(v.document_id, t.document_id) AS document_id,
      COALESCE(v.chunk_index, t.chunk_index) AS chunk_index,
      COALESCE(v.chunk_text, t.chunk_text) AS chunk_text,
      COALESCE(v.document_name, t.document_name) AS document_name,
      COALESCE(v.source_type, t.source_type) AS source_type,
      COALESCE(v.vec_similarity, 0) AS vec_similarity,
      -- RRF: 1/(k + rank) for each result set, weighted
      (p_vector_weight * COALESCE(1.0 / (p_rrf_k + v.vec_rank), 0)) +
      (p_text_weight * COALESCE(1.0 / (p_rrf_k + t.text_rank), 0)) AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id
  )
  SELECT
    combined.id,
    combined.document_id,
    combined.chunk_index,
    combined.chunk_text,
    combined.document_name,
    combined.source_type,
    combined.vec_similarity AS similarity
  FROM combined
  ORDER BY combined.rrf_score DESC
  LIMIT p_match_count;
$$;

-- 2. Source-filtered hybrid search
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks_hybrid_by_source(
  p_session_id UUID,
  p_embedding vector(768),
  p_query TEXT,
  p_source_types TEXT[],
  p_match_count INTEGER DEFAULT 25,
  p_match_threshold FLOAT DEFAULT 0.1,
  p_vector_weight FLOAT DEFAULT 0.7,
  p_text_weight FLOAT DEFAULT 0.3,
  p_rrf_k INTEGER DEFAULT 60
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
  WITH vector_results AS (
    SELECT
      kc.id,
      kc.document_id,
      kc.chunk_index,
      kc.chunk_text,
      kd.name AS document_name,
      kd.source_type,
      1 - (kc.embedding <=> p_embedding) AS vec_similarity,
      ROW_NUMBER() OVER (ORDER BY kc.embedding <=> p_embedding) AS vec_rank
    FROM public.knowledge_chunks kc
    JOIN public.knowledge_documents kd ON kd.id = kc.document_id
    WHERE kc.session_id = p_session_id
      AND kc.embedding IS NOT NULL
      AND kd.source_type = ANY(p_source_types)
      AND 1 - (kc.embedding <=> p_embedding) > p_match_threshold
    ORDER BY kc.embedding <=> p_embedding
    LIMIT p_match_count * 3
  ),
  text_results AS (
    SELECT
      kc.id,
      kc.document_id,
      kc.chunk_index,
      kc.chunk_text,
      kd.name AS document_name,
      kd.source_type,
      ts_rank_cd(kc.search_text, websearch_to_tsquery('english', p_query)) AS text_rank_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kc.search_text, websearch_to_tsquery('english', p_query)) DESC) AS text_rank
    FROM public.knowledge_chunks kc
    JOIN public.knowledge_documents kd ON kd.id = kc.document_id
    WHERE kc.session_id = p_session_id
      AND kc.search_text IS NOT NULL
      AND kd.source_type = ANY(p_source_types)
      AND kc.search_text @@ websearch_to_tsquery('english', p_query)
    ORDER BY ts_rank_cd(kc.search_text, websearch_to_tsquery('english', p_query)) DESC
    LIMIT p_match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, t.id) AS id,
      COALESCE(v.document_id, t.document_id) AS document_id,
      COALESCE(v.chunk_index, t.chunk_index) AS chunk_index,
      COALESCE(v.chunk_text, t.chunk_text) AS chunk_text,
      COALESCE(v.document_name, t.document_name) AS document_name,
      COALESCE(v.source_type, t.source_type) AS source_type,
      COALESCE(v.vec_similarity, 0) AS vec_similarity,
      (p_vector_weight * COALESCE(1.0 / (p_rrf_k + v.vec_rank), 0)) +
      (p_text_weight * COALESCE(1.0 / (p_rrf_k + t.text_rank), 0)) AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id
  )
  SELECT
    combined.id,
    combined.document_id,
    combined.chunk_index,
    combined.chunk_text,
    combined.document_name,
    combined.source_type,
    combined.vec_similarity AS similarity
  FROM combined
  ORDER BY combined.rrf_score DESC
  LIMIT p_match_count;
$$;

-- 3. Multi-session hybrid search
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks_hybrid_multi(
  p_session_ids UUID[],
  p_embedding vector(768),
  p_query TEXT,
  p_match_count INTEGER DEFAULT 25,
  p_match_threshold FLOAT DEFAULT 0.2,
  p_vector_weight FLOAT DEFAULT 0.7,
  p_text_weight FLOAT DEFAULT 0.3,
  p_rrf_k INTEGER DEFAULT 60
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
  WITH vector_results AS (
    SELECT
      kc.id,
      kc.document_id,
      kc.chunk_index,
      kc.chunk_text,
      kd.name AS document_name,
      kd.source_type,
      1 - (kc.embedding <=> p_embedding) AS vec_similarity,
      ROW_NUMBER() OVER (ORDER BY kc.embedding <=> p_embedding) AS vec_rank
    FROM public.knowledge_chunks kc
    JOIN public.knowledge_documents kd ON kd.id = kc.document_id
    WHERE kc.session_id = ANY(p_session_ids)
      AND kc.embedding IS NOT NULL
      AND 1 - (kc.embedding <=> p_embedding) > p_match_threshold
    ORDER BY kc.embedding <=> p_embedding
    LIMIT p_match_count * 3
  ),
  text_results AS (
    SELECT
      kc.id,
      kc.document_id,
      kc.chunk_index,
      kc.chunk_text,
      kd.name AS document_name,
      kd.source_type,
      ts_rank_cd(kc.search_text, websearch_to_tsquery('english', p_query)) AS text_rank_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kc.search_text, websearch_to_tsquery('english', p_query)) DESC) AS text_rank
    FROM public.knowledge_chunks kc
    JOIN public.knowledge_documents kd ON kd.id = kc.document_id
    WHERE kc.session_id = ANY(p_session_ids)
      AND kc.search_text IS NOT NULL
      AND kc.search_text @@ websearch_to_tsquery('english', p_query)
    ORDER BY ts_rank_cd(kc.search_text, websearch_to_tsquery('english', p_query)) DESC
    LIMIT p_match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, t.id) AS id,
      COALESCE(v.document_id, t.document_id) AS document_id,
      COALESCE(v.chunk_index, t.chunk_index) AS chunk_index,
      COALESCE(v.chunk_text, t.chunk_text) AS chunk_text,
      COALESCE(v.document_name, t.document_name) AS document_name,
      COALESCE(v.source_type, t.source_type) AS source_type,
      COALESCE(v.vec_similarity, 0) AS vec_similarity,
      (p_vector_weight * COALESCE(1.0 / (p_rrf_k + v.vec_rank), 0)) +
      (p_text_weight * COALESCE(1.0 / (p_rrf_k + t.text_rank), 0)) AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id
  )
  SELECT
    combined.id,
    combined.document_id,
    combined.chunk_index,
    combined.chunk_text,
    combined.document_name,
    combined.source_type,
    combined.vec_similarity AS similarity
  FROM combined
  ORDER BY combined.rrf_score DESC
  LIMIT p_match_count;
$$;
