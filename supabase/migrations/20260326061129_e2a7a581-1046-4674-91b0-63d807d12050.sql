
-- Create chat_threads table
CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.crawl_sessions(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

-- Allow all access (matches existing pattern)
CREATE POLICY "Allow all access to chat_threads"
  ON public.chat_threads
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add thread_id to knowledge_messages (nullable for existing rows)
ALTER TABLE public.knowledge_messages
  ADD COLUMN thread_id uuid REFERENCES public.chat_threads(id) ON DELETE CASCADE;

-- Migrate existing messages: create a default thread per session that has messages
INSERT INTO public.chat_threads (session_id, title, created_at)
SELECT DISTINCT km.session_id, 'Chat History', MIN(km.created_at)
FROM public.knowledge_messages km
GROUP BY km.session_id;

-- Link existing messages to their default thread
UPDATE public.knowledge_messages km
SET thread_id = ct.id
FROM public.chat_threads ct
WHERE ct.session_id = km.session_id
  AND km.thread_id IS NULL;
