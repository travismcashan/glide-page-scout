import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Column list for the companies list page (lightweight, no enrichment_data)
const LIST_COLUMNS =
  'id, name, domain, industry, employee_count, annual_revenue, location, logo_url, status, harvest_client_id, harvest_client_name, asana_project_gids, hubspot_company_id, freshdesk_company_id, freshdesk_company_name, quickbooks_client_name, quickbooks_invoice_summary, last_synced_at, created_at, updated_at';

async function fetchCompanies() {
  // Paginated fetch of all companies
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data: batch, error } = await supabase
      .from('companies')
      .select(LIST_COLUMNS)
      .order('name')
      .range(from, from + pageSize - 1);
    if (error || !batch) break;
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  if (all.length === 0) return [];

  // Fetch counts in parallel
  const [{ data: contactRows }, { data: sessionRows }] = await Promise.all([
    supabase.from('contacts').select('company_id'),
    supabase.from('crawl_sessions').select('company_id').not('company_id', 'is', null),
  ]);

  const contactMap = new Map<string, number>();
  (contactRows || []).forEach((c: any) => {
    if (c.company_id) contactMap.set(c.company_id, (contactMap.get(c.company_id) || 0) + 1);
  });

  const sessionMap = new Map<string, number>();
  (sessionRows || []).forEach((s: any) => {
    if (s.company_id) sessionMap.set(s.company_id, (sessionMap.get(s.company_id) || 0) + 1);
  });

  return all.map((c: any) => ({
    ...c,
    contact_count: contactMap.get(c.id) || 0,
    site_count: sessionMap.get(c.id) || 0,
  }));
}

/**
 * Cached companies list. First load hits Supabase, subsequent visits
 * within 5 min are instant from memory. After 5 min, shows cached
 * data and revalidates in the background.
 */
export function useCompanies() {
  const query = useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  });

  return {
    companies: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

/**
 * Invalidate the companies cache so the next access triggers a fresh fetch.
 * Call after mutations that change company data (status change, create, delete, etc.)
 */
export function useInvalidateCompanies() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['companies'] });
}
