
-- site_groups table
CREATE TABLE public.site_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to site_groups"
  ON public.site_groups FOR ALL TO public
  USING (true) WITH CHECK (true);

-- site_group_members join table
CREATE TABLE public.site_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.site_groups(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  priority integer DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, session_id)
);

ALTER TABLE public.site_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to site_group_members"
  ON public.site_group_members FOR ALL TO public
  USING (true) WITH CHECK (true);
