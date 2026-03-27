CREATE TABLE public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'feature',
  status text NOT NULL DEFAULT 'wishlist',
  priority text NOT NULL DEFAULT 'medium',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to wishlist_items" ON public.wishlist_items FOR ALL TO public USING (true) WITH CHECK (true);