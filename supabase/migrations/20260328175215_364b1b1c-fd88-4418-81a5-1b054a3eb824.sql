CREATE OR REPLACE FUNCTION public.count_integrations(session_ids uuid[])
RETURNS TABLE(session_id uuid, integration_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT ir.session_id, count(*)::bigint AS integration_count
  FROM public.integration_runs ir
  WHERE ir.session_id = ANY(session_ids)
    AND ir.status = 'done'
  GROUP BY ir.session_id;
$$;