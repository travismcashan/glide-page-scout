
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks_by_source(
  p_session_id uuid,
  p_embedding extensions.vector,
  p_source_types text[],
  p_match_count integer DEFAULT 25,
  p_match_threshold double precision DEFAULT 0.15
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
LANGUAGE sql
STABLE
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
    AND kd.source_type = ANY(p_source_types)
    AND 1 - (kc.embedding <=> p_embedding) > p_match_threshold
  ORDER BY kc.embedding <=> p_embedding
  LIMIT p_match_count;
$$;
