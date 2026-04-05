import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Column list for the companies list page (lightweight, no enrichment_data)
const LIST_COLUMNS =
  'id, name, domain, industry, employee_count, annual_revenue, location, logo_url, status, harvest_client_id, harvest_client_name, asana_project_gids, hubspot_company_id, freshdesk_company_id, freshdesk_company_name, quickbooks_client_name, quickbooks_invoice_summary, hubspot_lifecycle_stage, hubspot_has_active_deal, last_synced_at, created_at, updated_at';

/** Fetch companies scoped by workspace to avoid loading 2,600+ rows when only 23 are needed */
async function fetchCompanies(workspace?: string) {
  let companyIds: string[] | null = null;

  // Growth: only fetch companies with open deals or active leads
  // Also fetch deal stage/amount and lead status for display
  const dealsByCompany = new Map<string, { stage_label: string; amount: number | null; close_date: string | null }>();
  const leadsByCompany = new Map<string, { lead_status: string; updated_at: string | null }>();

  if (workspace === 'growth') {
    const ids = new Set<string>();
    const [{ data: dealRows }, { data: leadRows }] = await Promise.all([
      supabase.from('deals').select('company_id, amount, close_date, contact_name, properties, updated_at').eq('status', 'open').not('company_id', 'is', null),
      supabase.from('contacts').select('company_id, lead_status, first_name, last_name, updated_at').not('lead_status', 'is', null).not('company_id', 'is', null),
    ]);
    for (const r of dealRows || []) {
      if (!r.company_id) continue;
      ids.add(r.company_id);
      if (!dealsByCompany.has(r.company_id) || (r.amount && (!dealsByCompany.get(r.company_id)!.amount || r.amount > dealsByCompany.get(r.company_id)!.amount!))) {
        dealsByCompany.set(r.company_id, {
          stage_label: r.properties?.stage_label || 'Open',
          amount: r.amount ? parseFloat(r.amount) : null,
          close_date: r.close_date,
          contact_name: r.contact_name || null,
        });
      }
    }
    for (const r of leadRows || []) {
      if (!r.company_id) continue;
      ids.add(r.company_id);
      if (!leadsByCompany.has(r.company_id)) {
        leadsByCompany.set(r.company_id, {
          lead_status: r.lead_status,
          updated_at: r.updated_at,
          contact_name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
        });
      }
    }
    companyIds = [...ids];
    if (companyIds.length === 0) return [];
  }

  let all: any[] = [];

  if (companyIds) {
    // Targeted fetch — only the companies we need
    const { data, error } = await supabase
      .from('companies')
      .select(LIST_COLUMNS)
      .in('id', companyIds)
      .order('name');
    if (!error && data) all = data;
  } else if (workspace === 'delivery') {
    // Delivery: only active clients
    const { data, error } = await supabase
      .from('companies')
      .select(LIST_COLUMNS)
      .eq('status', 'active')
      .order('name');
    if (!error && data) all = data;
  } else if (workspace === 'admin') {
    // Admin: all non-archived
    const { data, error } = await supabase
      .from('companies')
      .select(LIST_COLUMNS)
      .neq('status', 'archived')
      .order('name');
    if (!error && data) all = data;
  } else {
    // No workspace specified (e.g. ProjectsPage) — fetch all
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
  }

  if (all.length === 0) return [];

  // Fetch counts — only for the companies we loaded
  const ids = all.map((c) => c.id);
  const [{ data: contactRows }, { data: sessionRows }] = await Promise.all([
    supabase.from('contacts').select('company_id').in('company_id', ids),
    supabase.from('crawl_sessions').select('company_id').in('company_id', ids),
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
    // Growth pipeline data
    deal_stage_label: dealsByCompany.get(c.id)?.stage_label || null,
    deal_amount: dealsByCompany.get(c.id)?.amount || null,
    deal_close_date: dealsByCompany.get(c.id)?.close_date || null,
    lead_status: leadsByCompany.get(c.id)?.lead_status || null,
    lead_updated_at: leadsByCompany.get(c.id)?.updated_at || null,
    primary_contact_name: dealsByCompany.get(c.id)?.contact_name || leadsByCompany.get(c.id)?.contact_name || null,
  }));
}

/**
 * Cached companies list, scoped by workspace.
 * Growth: fetches only pipeline companies (~20-50 rows).
 * Delivery/Admin: fetches all companies.
 */
export function useCompanies(workspace?: string) {
  const query = useQuery({
    queryKey: ['companies', workspace || 'all'],
    queryFn: () => fetchCompanies(workspace),
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
