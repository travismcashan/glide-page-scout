-- ============================================================
-- Create company_source_data table
-- Stores raw API responses from synced sources (HubSpot, Harvest, Freshdesk)
-- per company. Written by global-sync, read by Source Data tab.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_source_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_id TEXT,
  raw_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, source)
);

CREATE INDEX idx_company_source_data_company_id ON public.company_source_data(company_id);
CREATE INDEX idx_company_source_data_user_id ON public.company_source_data(user_id);

ALTER TABLE public.company_source_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company source data"
  ON public.company_source_data FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own company source data"
  ON public.company_source_data FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own company source data"
  ON public.company_source_data FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own company source data"
  ON public.company_source_data FOR DELETE
  USING (user_id = auth.uid());
