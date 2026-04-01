-- Add Monthly Performance Report as a named service (SKU 405)
INSERT INTO public.services (sku, name, pillar, default_duration_months, roadmap_grade, billing_type, sort_order)
VALUES (405, 'Monthly Performance Report', 'GO', 9, true, 'Retainer', 215)
ON CONFLICT (sku) DO NOTHING;
