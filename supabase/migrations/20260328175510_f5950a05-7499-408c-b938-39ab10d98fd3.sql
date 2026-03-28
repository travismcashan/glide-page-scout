CREATE OR REPLACE FUNCTION public.count_integrations(session_ids uuid[])
RETURNS TABLE(session_id uuid, integration_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH run_counts AS (
    SELECT ir.session_id, count(*)::bigint AS integration_count
    FROM public.integration_runs ir
    WHERE ir.session_id = ANY(session_ids)
      AND ir.status = 'done'
    GROUP BY ir.session_id
  ),
  legacy_counts AS (
    SELECT
      cs.id AS session_id,
      (
        CASE WHEN cs.builtwith_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.semrush_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.psi_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.wappalyzer_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.carbon_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.crux_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.wave_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.observatory_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.ocean_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.ssllabs_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.httpstatus_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.linkcheck_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.w3c_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.schema_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.readable_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.yellowlab_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.deep_research_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.avoma_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.apollo_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.content_types_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.sitemap_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.forms_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.detectzestack_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.tech_analysis_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.hubspot_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.gmail_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.apollo_team_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.ga4_data IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN cs.search_console_data IS NOT NULL THEN 1 ELSE 0 END
      )::bigint AS integration_count
    FROM public.crawl_sessions cs
    WHERE cs.id = ANY(session_ids)
  )
  SELECT
    lc.session_id,
    COALESCE(rc.integration_count, lc.integration_count) AS integration_count
  FROM legacy_counts lc
  LEFT JOIN run_counts rc ON rc.session_id = lc.session_id;
$$;