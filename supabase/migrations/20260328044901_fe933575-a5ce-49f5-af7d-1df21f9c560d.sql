
-- Project phases for organizing estimate tasks
CREATE TABLE public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_phases" ON public.project_phases FOR ALL TO public USING (true) WITH CHECK (true);

-- Team roles with hourly rates
CREATE TABLE public.team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbreviation text NOT NULL,
  hourly_rate numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to team_roles" ON public.team_roles FOR ALL TO public USING (true) WITH CHECK (true);

-- Master task templates
CREATE TABLE public.master_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  team_role_id uuid REFERENCES public.team_roles(id) ON DELETE SET NULL,
  default_hours numeric NOT NULL DEFAULT 0,
  default_included boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.master_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to master_tasks" ON public.master_tasks FOR ALL TO public USING (true) WITH CHECK (true);

-- Task formulas for variable-driven hour calculations
CREATE TABLE public.task_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name_pattern text NOT NULL,
  variable_name text NOT NULL,
  base_hours numeric NOT NULL DEFAULT 0,
  hours_per_unit numeric NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to task_formulas" ON public.task_formulas FOR ALL TO public USING (true) WITH CHECK (true);

-- Project estimates (one per crawl session or standalone)
CREATE TABLE public.project_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.crawl_sessions(id) ON DELETE SET NULL,
  name text NOT NULL,
  client_name text,
  description text,
  status text DEFAULT 'draft',
  project_size text DEFAULT 'Medium',
  project_complexity text DEFAULT 'Standard',
  user_personas integer DEFAULT 3,
  content_pages integer DEFAULT 10,
  design_layouts integer DEFAULT 5,
  form_count integer DEFAULT 2,
  integration_count integer DEFAULT 1,
  paid_discovery text DEFAULT 'scope_only',
  pages_for_integration integer DEFAULT 20,
  custom_posts integer DEFAULT 2,
  bulk_import_amount text DEFAULT '<500',
  site_builder_acf boolean DEFAULT true,
  third_party_integrations integer DEFAULT 2,
  post_launch_services integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_estimates" ON public.project_estimates FOR ALL TO public USING (true) WITH CHECK (true);

-- Individual tasks within an estimate
CREATE TABLE public.estimate_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.project_estimates(id) ON DELETE CASCADE,
  master_task_id uuid REFERENCES public.master_tasks(id) ON DELETE SET NULL,
  task_name text NOT NULL,
  phase_name text,
  team_role_name text,
  team_role_abbreviation text,
  hours numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  is_selected boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estimate_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to estimate_tasks" ON public.estimate_tasks FOR ALL TO public USING (true) WITH CHECK (true);
