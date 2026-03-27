CREATE UNIQUE INDEX IF NOT EXISTS knowledge_documents_session_source_unique 
ON knowledge_documents (session_id, source_type, source_key) 
WHERE source_key IS NOT NULL;