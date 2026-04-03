-- ============================================================
-- Company Brain Schema (Phase 1)
-- Adds companies, contacts, deals, engagements tables
-- Adds company_id FK to crawl_sessions
-- All new tables have user-scoped RLS
-- ============================================================

-- 1. Companies table — the relationship entity / "company brain"
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  name TEXT NOT NULL,
  domain TEXT,
  logo_url TEXT,
  industry TEXT,
  employee_count TEXT,
  annual_revenue TEXT,
  location TEXT,
  description TEXT,
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'past', 'archived')),
  hubspot_company_id TEXT,
  enrichment_data JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_user_id ON public.companies(user_id);
CREATE INDEX idx_companies_domain ON public.companies(domain);
CREATE INDEX idx_companies_hubspot_id ON public.companies(hubspot_company_id);
CREATE INDEX idx_companies_status ON public.companies(status);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own companies"
  ON public.companies FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own companies"
  ON public.companies FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own companies"
  ON public.companies FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own companies"
  ON public.companies FOR DELETE
  USING (user_id = auth.uid());

-- 2. Contacts table — people, linked to companies, not sites
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  department TEXT,
  linkedin_url TEXT,
  photo_url TEXT,
  seniority TEXT,
  role_type TEXT CHECK (role_type IN ('decision_maker', 'champion', 'end_user', 'influencer', 'economic_buyer', 'technical_buyer', 'other')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  hubspot_contact_id TEXT,
  apollo_person_id TEXT,
  enrichment_data JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contacts_hubspot_id ON public.contacts(hubspot_contact_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts"
  ON public.contacts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own contacts"
  ON public.contacts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own contacts"
  ON public.contacts FOR DELETE
  USING (user_id = auth.uid());

-- 3. Deals table — persisted locally, synced from HubSpot
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  hubspot_deal_id TEXT,
  name TEXT NOT NULL,
  amount NUMERIC,
  stage TEXT,
  pipeline TEXT,
  deal_type TEXT,
  priority TEXT,
  close_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'archived')),
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_user_id ON public.deals(user_id);
CREATE INDEX idx_deals_company_id ON public.deals(company_id);
CREATE INDEX idx_deals_contact_id ON public.deals(contact_id);
CREATE INDEX idx_deals_hubspot_id ON public.deals(hubspot_deal_id);
CREATE INDEX idx_deals_status ON public.deals(status);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deals"
  ON public.deals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own deals"
  ON public.deals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own deals"
  ON public.deals FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own deals"
  ON public.deals FOR DELETE
  USING (user_id = auth.uid());

-- 4. Engagements table — meetings, emails, calls, notes, tasks
CREATE TABLE IF NOT EXISTS public.engagements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('meeting', 'email', 'call', 'note', 'task')),
  hubspot_engagement_id TEXT,
  subject TEXT,
  body_preview TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  occurred_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_engagements_user_id ON public.engagements(user_id);
CREATE INDEX idx_engagements_company_id ON public.engagements(company_id);
CREATE INDEX idx_engagements_contact_id ON public.engagements(contact_id);
CREATE INDEX idx_engagements_deal_id ON public.engagements(deal_id);
CREATE INDEX idx_engagements_type ON public.engagements(engagement_type);
CREATE INDEX idx_engagements_occurred_at ON public.engagements(occurred_at DESC);

ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own engagements"
  ON public.engagements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own engagements"
  ON public.engagements FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own engagements"
  ON public.engagements FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own engagements"
  ON public.engagements FOR DELETE
  USING (user_id = auth.uid());

-- 5. Add company_id FK to crawl_sessions (nullable — existing rows unaffected)
ALTER TABLE public.crawl_sessions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crawl_sessions_company_id ON public.crawl_sessions(company_id);

-- 6. Add company_id FK to roadmaps (nullable — gradual migration)
ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 7. Add company_id FK to proposals (nullable — gradual migration)
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 8. Add company_id FK to project_estimates (nullable — gradual migration)
ALTER TABLE public.project_estimates
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 9. Add outcomes_data to roadmaps if not exists (referenced in schema but may be missing)
ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS outcomes_data JSONB DEFAULT '{}'::jsonb;

-- 10. Service account access for edge functions
CREATE POLICY "Service role can manage companies"
  ON public.companies FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage contacts"
  ON public.contacts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage deals"
  ON public.deals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage engagements"
  ON public.engagements FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
