import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Column list for the companies list page (lightweight, no enrichment_data)
const LIST_COLUMNS =
  'id, name, domain, industry, employee_count, annual_revenue, location, logo_url, status, harvest_client_id, harvest_client_name, asana_project_gids, hubspot_company_id, freshdesk_company_id, freshdesk_company_name, quickbooks_client_name, quickbooks_invoice_summary, last_synced_at, created_at, updated_at';

export type GrowthFilter = 'pipeline' | 'all' | 'active' | 'inactive';

/** Fetch companies scoped by workspace to avoid loading 2,600+ rows when only 23 are needed */
async function fetchCompanies(workspace?: string, growthFilter: GrowthFilter = 'pipeline') {
  let companyIds: string[] | null = null;

  // Growth: only fetch companies with open deals or active leads
  // Also fetch deal stage/amount and lead status for display
  const dealsByCompany = new Map<string, { stage_label: string; amount: number | null; close_date: string | null }>();
  const leadsByCompany = new Map<string, { lead_status: string; updated_at: string | null }>();

  if (workspace === 'growth' && growthFilter === 'pipeline') {
    const ids = new Set<string>();
    const [{ data: dealRows }, { data: leadRows }] = await Promise.all([
      supabase.from('deals').select('company_id, amount, close_date, properties, updated_at').eq('status', 'open').not('company_id', 'is', null),
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
        });
      }
    }
    companyIds = [...ids];
    if (companyIds.length === 0) return [];
  }

  let all: any[] = [];

  if (companyIds) {
    // Targeted fetch — only the companies we need (pipeline filter)
    const { data, error } = await supabase
      .from('companies')
      .select(LIST_COLUMNS)
      .in('id', companyIds)
      .order('name');
    if (!error && data) all = data;
  } else if (workspace === 'growth' && growthFilter === 'active') {
    const { data, error } = await supabase
      .from('companies')
      .select(LIST_COLUMNS)
      .eq('status', 'active')
      .order('name');
    if (!error && data) all = data;
  } else if (workspace === 'growth' && growthFilter === 'inactive') {
    const { data, error } = await supabase
      .from('companies')
      .select(LIST_COLUMNS)
      .eq('status', 'past')
      .order('name');
    if (!error && data) all = data;
  } else if (workspace === 'growth' && growthFilter === 'all') {
    const { data, error } = await supabase
      .from('companies')
      .select(LIST_COLUMNS)
      .neq('status', 'archived')
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

  // Fetch counts + primary contacts — only for the companies we loaded
  const ids = all.map((c) => c.id);
  const [{ data: contactRows }, { data: sessionRows }, { data: primaryContacts }] = await Promise.all([
    supabase.from('contacts').select('company_id').in('company_id', ids),
    supabase.from('crawl_sessions').select('company_id').in('company_id', ids),
    supabase.from('contacts').select('id, company_id, first_name, last_name, is_primary').in('company_id', ids).order('is_primary', { ascending: false }).order('created_at'),
  ]);

  const contactMap = new Map<string, number>();
  (contactRows || []).forEach((c: any) => {
    if (c.company_id) contactMap.set(c.company_id, (contactMap.get(c.company_id) || 0) + 1);
  });

  // Map company → first/primary contact
  const primaryContactMap = new Map<string, { id: string; name: string }>();
  for (const c of primaryContacts || []) {
    if (c.company_id && !primaryContactMap.has(c.company_id)) {
      primaryContactMap.set(c.company_id, {
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown',
      });
    }
  }

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
    primary_contact_name: primaryContactMap.get(c.id)?.name || null,
    primary_contact_id: primaryContactMap.get(c.id)?.id || null,
  }));
}

/**
 * Cached companies list, scoped by workspace.
 * Growth: fetches only pipeline companies (~20-50 rows).
 * Delivery/Admin: fetches all companies.
 */
export function useCompanies(workspace?: string, growthFilter: GrowthFilter = 'pipeline') {
  const query = useQuery({
    queryKey: ['companies', workspace || 'all', growthFilter],
    queryFn: () => fetchCompanies(workspace, growthFilter),
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
