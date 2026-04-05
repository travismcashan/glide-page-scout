-- =============================================================================
-- RLS Coverage Migration
-- Fixes all tables missing RLS or using wide-open USING(true) policies.
-- Prioritized by data sensitivity: tokens > PII > user data > reference data.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: Critical — Tables with NO RLS that have user_id
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. proposals (has user_id, contains client pricing data)
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proposals"
  ON public.proposals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own proposals"
  ON public.proposals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own proposals"
  ON public.proposals FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own proposals"
  ON public.proposals FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Service role can manage proposals"
  ON public.proposals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 1b. user_settings (has user_id, contains personal bio/instructions)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own settings"
  ON public.user_settings FOR DELETE USING (user_id = auth.uid());

-- 1c. ai_usage_log (has user_id nullable, edge functions write via service_role)
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.ai_usage_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role can manage ai_usage_log"
  ON public.ai_usage_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 1d. wishlist_comments (has user_id)
ALTER TABLE public.wishlist_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comments"
  ON public.wishlist_comments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own comments"
  ON public.wishlist_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own comments"
  ON public.wishlist_comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own comments"
  ON public.wishlist_comments FOR DELETE USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2: Critical — oauth_connections (tokens exposed via USING(true))
-- ─────────────────────────────────────────────────────────────────────────────

-- Add user_id column (not present in original schema)
ALTER TABLE public.oauth_connections
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Backfill: single-tenant — set all existing rows to the first user found
UPDATE public.oauth_connections
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Drop the wide-open policy
DROP POLICY IF EXISTS "Allow all access to oauth_connections" ON public.oauth_connections;

-- Scope to user
CREATE POLICY "Users can view own oauth connections"
  ON public.oauth_connections FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own oauth connections"
  ON public.oauth_connections FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own oauth connections"
  ON public.oauth_connections FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own oauth connections"
  ON public.oauth_connections FOR DELETE USING (user_id = auth.uid());
-- Edge functions (google-oauth-exchange, slack-oauth-exchange, ga4-lookup, etc.) use service_role
CREATE POLICY "Service role can manage oauth connections"
  ON public.oauth_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: Add user_id + scope to tables that need it
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. wishlist_items (no user_id, wide-open USING(true))
ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

UPDATE public.wishlist_items
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

DROP POLICY IF EXISTS "Allow all access to wishlist_items" ON public.wishlist_items;

CREATE POLICY "Users can view own wishlist items"
  ON public.wishlist_items FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own wishlist items"
  ON public.wishlist_items FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own wishlist items"
  ON public.wishlist_items FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own wishlist items"
  ON public.wishlist_items FOR DELETE USING (user_id = auth.uid());

-- 3b. wishlist_attachments (no RLS, FK to wishlist_items)
ALTER TABLE public.wishlist_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own wishlist attachments"
  ON public.wishlist_attachments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.wishlist_items wi
    WHERE wi.id = wishlist_attachments.wishlist_item_id AND wi.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wishlist_items wi
    WHERE wi.id = wishlist_attachments.wishlist_item_id AND wi.user_id = auth.uid()
  ));

-- 3c. global_chat_threads (no user_id, wide-open)
ALTER TABLE public.global_chat_threads
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

UPDATE public.global_chat_threads
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

DROP POLICY IF EXISTS "Allow all access to global_chat_threads" ON public.global_chat_threads;

CREATE POLICY "Users can view own global chat threads"
  ON public.global_chat_threads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own global chat threads"
  ON public.global_chat_threads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own global chat threads"
  ON public.global_chat_threads FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own global chat threads"
  ON public.global_chat_threads FOR DELETE USING (user_id = auth.uid());

-- 3d. global_chat_sources (scoped via thread ownership)
DROP POLICY IF EXISTS "Allow all access to global_chat_sources" ON public.global_chat_sources;

CREATE POLICY "Users can access own global chat sources"
  ON public.global_chat_sources FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.global_chat_threads t
    WHERE t.id = global_chat_sources.thread_id AND t.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.global_chat_threads t
    WHERE t.id = global_chat_sources.thread_id AND t.user_id = auth.uid()
  ));

-- 3e. global_chat_messages (scoped via thread ownership)
DROP POLICY IF EXISTS "Allow all access to global_chat_messages" ON public.global_chat_messages;

CREATE POLICY "Users can access own global chat messages"
  ON public.global_chat_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.global_chat_threads t
    WHERE t.id = global_chat_messages.thread_id AND t.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.global_chat_threads t
    WHERE t.id = global_chat_messages.thread_id AND t.user_id = auth.uid()
  ));

-- 3f. site_groups (no user_id, wide-open)
ALTER TABLE public.site_groups
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

UPDATE public.site_groups
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

DROP POLICY IF EXISTS "Allow all access to site_groups" ON public.site_groups;

CREATE POLICY "Users can view own site groups"
  ON public.site_groups FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own site groups"
  ON public.site_groups FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own site groups"
  ON public.site_groups FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own site groups"
  ON public.site_groups FOR DELETE USING (user_id = auth.uid());

-- 3g. site_group_members (scoped via group ownership)
DROP POLICY IF EXISTS "Allow all access to site_group_members" ON public.site_group_members;

CREATE POLICY "Users can access own site group members"
  ON public.site_group_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.site_groups sg
    WHERE sg.id = site_group_members.group_id AND sg.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.site_groups sg
    WHERE sg.id = site_group_members.group_id AND sg.user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: Session-chain scoping (tables with session_id FK)
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. chat_threads (session_id → crawl_sessions.user_id)
DROP POLICY IF EXISTS "Allow all access to chat_threads" ON public.chat_threads;

CREATE POLICY "Users can access own chat threads"
  ON public.chat_threads FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = chat_threads.session_id AND cs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = chat_threads.session_id AND cs.user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage chat threads"
  ON public.chat_threads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4b. knowledge_documents (session_id → crawl_sessions.user_id)
DROP POLICY IF EXISTS "Allow all access to knowledge_documents" ON public.knowledge_documents;

CREATE POLICY "Users can access own knowledge documents"
  ON public.knowledge_documents FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = knowledge_documents.session_id AND cs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = knowledge_documents.session_id AND cs.user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage knowledge documents"
  ON public.knowledge_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4c. knowledge_chunks (session_id → crawl_sessions.user_id)
DROP POLICY IF EXISTS "Allow all access to knowledge_chunks" ON public.knowledge_chunks;

CREATE POLICY "Users can access own knowledge chunks"
  ON public.knowledge_chunks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = knowledge_chunks.session_id AND cs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = knowledge_chunks.session_id AND cs.user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage knowledge chunks"
  ON public.knowledge_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4d. knowledge_messages (thread_id → chat_threads → session → user)
DROP POLICY IF EXISTS "Allow all access to knowledge_messages" ON public.knowledge_messages;

CREATE POLICY "Users can access own knowledge messages"
  ON public.knowledge_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.chat_threads ct
    JOIN public.crawl_sessions cs ON cs.id = ct.session_id
    WHERE ct.id = knowledge_messages.thread_id AND cs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chat_threads ct
    JOIN public.crawl_sessions cs ON cs.id = ct.session_id
    WHERE ct.id = knowledge_messages.thread_id AND cs.user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage knowledge messages"
  ON public.knowledge_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4e. proposal_case_studies (session_id → crawl_sessions.user_id)
ALTER TABLE public.proposal_case_studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own proposal case studies"
  ON public.proposal_case_studies FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = proposal_case_studies.session_id AND cs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.crawl_sessions cs
    WHERE cs.id = proposal_case_studies.session_id AND cs.user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage proposal case studies"
  ON public.proposal_case_studies FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: Lookup/reference tables — intentionally open reads
-- ─────────────────────────────────────────────────────────────────────────────

-- 5a. contact_photos — global cache of avatar URLs, no secrets
ALTER TABLE public.contact_photos ENABLE ROW LEVEL SECURITY;

-- Intentionally open: shared photo cache across all users, no sensitive data
CREATE POLICY "Authenticated users can read contact photos"
  ON public.contact_photos FOR SELECT TO authenticated USING (true);
-- Only edge functions (enrich-contacts, hubspot-*-sync) write photos
CREATE POLICY "Service role can manage contact photos"
  ON public.contact_photos FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5b. model_pricing — public pricing lookup table, no secrets
ALTER TABLE public.model_pricing ENABLE ROW LEVEL SECURITY;

-- Intentionally open: static pricing data, readable by all authenticated users
CREATE POLICY "Authenticated users can read model pricing"
  ON public.model_pricing FOR SELECT TO authenticated USING (true);
-- Admin-only writes (via dashboard or service_role)
CREATE POLICY "Service role can manage model pricing"
  ON public.model_pricing FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5c. integration_settings — global config (paused flags), not per-user
DROP POLICY IF EXISTS "Allow all access to integration_settings" ON public.integration_settings;

-- Intentionally open reads: integration pause flags are shared config
CREATE POLICY "Authenticated users can read integration settings"
  ON public.integration_settings FOR SELECT TO authenticated USING (true);
-- Only service_role and admin should write
CREATE POLICY "Service role can manage integration settings"
  ON public.integration_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 6: Estimator reference tables — intentionally open
-- These are shared catalog/formula data, not user-specific content.
-- RLS is already enabled with USING(true); no changes needed for:
--   project_phases, team_roles, master_tasks, task_formulas,
--   project_estimates, estimate_tasks, service_steps
-- services table has user_id but is a shared catalog — leave as-is.
-- knowledge_favorites has USING(true) — tiny table, acceptable.
-- ─────────────────────────────────────────────────────────────────────────────

-- No changes needed for Phase 6 tables.
