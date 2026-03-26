ALTER TABLE public.knowledge_messages
ADD COLUMN IF NOT EXISTS rag_documents jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS web_citations jsonb DEFAULT NULL;