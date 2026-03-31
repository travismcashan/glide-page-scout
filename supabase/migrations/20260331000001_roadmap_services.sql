-- Services catalog table
CREATE TABLE IF NOT EXISTS public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku INTEGER UNIQUE,
  name TEXT NOT NULL,
  pillar TEXT NOT NULL CHECK (pillar IN ('IS', 'FB', 'GO', 'TS')),
  default_duration_months INTEGER NOT NULL DEFAULT 1,
  roadmap_grade BOOLEAN NOT NULL DEFAULT true,
  billing_type TEXT,
  min_fixed NUMERIC,
  max_fixed NUMERIC,
  min_retainer NUMERIC,
  max_retainer NUMERIC,
  min_hourly NUMERIC,
  max_hourly NUMERIC,
  hourly_rate_external NUMERIC DEFAULT 150,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view services" ON public.services
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service steps (phases & recurring cycles per service)
CREATE TABLE IF NOT EXISTS public.service_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('phase', 'cycle')),
  frequency TEXT CHECK (frequency IN ('monthly', 'quarterly')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_onramp BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.service_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view service_steps" ON public.service_steps
  FOR SELECT USING (auth.role() = 'authenticated');

-- Roadmaps table — tied to a crawl session
CREATE TABLE IF NOT EXISTS public.roadmaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.crawl_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL DEFAULT 'Client',
  start_month INTEGER NOT NULL DEFAULT 0,
  total_months INTEGER NOT NULL DEFAULT 12,
  ideal_start_date DATE,
  ideal_end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;

-- Check ownership directly via roadmaps.user_id
CREATE OR REPLACE FUNCTION public.owns_roadmap(_roadmap_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roadmaps r
    WHERE r.id = _roadmap_id
      AND r.user_id = auth.uid()
  )
$$;

CREATE POLICY "Users can view own roadmaps" ON public.roadmaps
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own roadmaps" ON public.roadmaps
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own roadmaps" ON public.roadmaps
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own roadmaps" ON public.roadmaps
  FOR DELETE USING (user_id = auth.uid());

-- Roadmap items
CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  roadmap_id UUID NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  sku INTEGER NOT NULL,
  start_month INTEGER NOT NULL DEFAULT 0,
  duration NUMERIC NOT NULL DEFAULT 1,
  custom_name TEXT,
  sort_order NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC,
  billing_type TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  estimated_ad_spend NUMERIC,
  discount_type TEXT CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roadmap items" ON public.roadmap_items
  FOR SELECT USING (public.owns_roadmap(roadmap_id));
CREATE POLICY "Users can insert own roadmap items" ON public.roadmap_items
  FOR INSERT WITH CHECK (public.owns_roadmap(roadmap_id));
CREATE POLICY "Users can update own roadmap items" ON public.roadmap_items
  FOR UPDATE USING (public.owns_roadmap(roadmap_id));
CREATE POLICY "Users can delete own roadmap items" ON public.roadmap_items
  FOR DELETE USING (public.owns_roadmap(roadmap_id));

-- updated_at trigger for roadmaps
CREATE OR REPLACE FUNCTION public.update_roadmaps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_roadmaps_updated_at
  BEFORE UPDATE ON public.roadmaps
  FOR EACH ROW EXECUTE FUNCTION public.update_roadmaps_updated_at();

-- Seed initial services from the standard GLIDE catalog
INSERT INTO public.services (sku, name, pillar, default_duration_months, roadmap_grade, billing_type, sort_order) VALUES
  -- Insight & Strategy
  (101, 'Paid Discovery',            'IS', 2,  true,  'Fixed',   10),
  (110, 'QA Audit',                  'IS', 1,  true,  'Fixed',   20),
  (102, 'SEO Audit',                 'IS', 1,  true,  'Fixed',   30),
  (103, 'PPC Audit',                 'IS', 1,  true,  'Fixed',   40),
  (104, 'Accessibility Audit',       'IS', 1,  false, 'Fixed',   50),
  (105, 'Security Audit',            'IS', 1,  false, 'Fixed',   60),
  (106, 'Compliance Audit',          'IS', 1,  false, 'Fixed',   70),
  (107, 'Performance Audit',         'IS', 1,  false, 'Fixed',   80),
  (108, 'Analytics Tracking Audit',  'IS', 1,  false, 'Fixed',   90),
  (109, 'Usability Audit',           'IS', 1,  false, 'Fixed',   100),
  -- Foundation & Build
  (201, 'Website Redesign',          'FB', 4,  true,  'Fixed',   110),
  (204, 'New Website',               'FB', 4,  true,  'Fixed',   120),
  (301, 'Design Only',               'FB', 2,  false, 'Fixed',   130),
  (302, 'Development Only',          'FB', 3,  false, 'Fixed',   140),
  (303, 'CMS Replatform',            'FB', 3,  false, 'Fixed',   150),
  (304, 'Single Page Website',       'FB', 1,  false, 'Fixed',   160),
  (305, 'Landing Page',              'FB', 1,  true,  'Fixed',   170),
  -- Growth & Optimization
  (401, 'Search Engine Optimization','GO', 9,  true,  'Retainer',180),
  (402, 'PPC Management',            'GO', 9,  true,  'Retainer',190),
  (403, 'Continuous Improvement',    'GO', 8,  true,  'Retainer',200),
  (404, 'Analytics Maintenance',     'GO', 9,  true,  'Retainer',210),
  -- Technical & Support
  (501, 'On-Demand Support',         'TS', 8,  true,  'T&M',     220),
  (502, 'Quarterly Maintenance',     'TS', 9,  true,  'Retainer',230),
  (503, 'Legacy Retainer',           'TS', 12, false, 'Retainer',240)
ON CONFLICT (sku) DO NOTHING;
