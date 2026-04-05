import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type CompanyRow = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: string | null;
  annual_revenue: string | null;
  location: string | null;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  status: string;
  enrichment_data: any;
  tags: string[];
  notes: string | null;
  created_at: string;
  hubspot_company_id: string | null;
  harvest_client_id: string | null;
  freshdesk_company_id: string | null;
};

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  seniority: string | null;
  role_type: string | null;
  is_primary: boolean;
  created_at: string;
};

type SiteRow = {
  id: string;
  domain: string;
  base_url: string;
  status: string;
  created_at: string;
};

const COMPANY_DETAIL_COLUMNS = 'id, name, domain, industry, employee_count, annual_revenue, location, logo_url, description, website_url, status, enrichment_data, tags, notes, created_at, hubspot_company_id, harvest_client_id, freshdesk_company_id, quickbooks_client_name, quickbooks_invoice_summary, last_synced_at, updated_at';

async function fetchCompanyBundle(id: string) {
  const [companyRes, contactsRes, sitesRes] = await Promise.all([
    supabase.from('companies').select(COMPANY_DETAIL_COLUMNS).eq('id', id).single(),
    supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, title, linkedin_url, photo_url, seniority, role_type, is_primary, enrichment_data, created_at')
      .eq('company_id', id)
      .order('is_primary', { ascending: false })
      .order('created_at'),
    supabase
      .from('crawl_sessions')
      .select('id, domain, base_url, status, created_at')
      .eq('company_id', id)
      .order('created_at', { ascending: false }),
  ]);

  return {
    company: companyRes.data as CompanyRow | null,
    contacts: (contactsRes.data ?? []) as ContactRow[],
    sites: (sitesRes.data ?? []) as SiteRow[],
  };
}

/**
 * Cached company detail bundle (company + contacts + sites).
 * First load hits Supabase, subsequent visits within 5 min are instant.
 */
export function useCompany(id: string | undefined) {
  const query = useQuery({
    queryKey: ['company', id],
    queryFn: () => fetchCompanyBundle(id!),
    enabled: !!id,
  });

  return {
    company: query.data?.company ?? null,
    contacts: query.data?.contacts ?? [],
    sites: query.data?.sites ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

/**
 * Update the cached company data locally (optimistic) and optionally refetch.
 */
export function useUpdateCompanyCache() {
  const qc = useQueryClient();

  return {
    /** Patch the company in cache without refetching */
    patch(id: string, updates: Partial<CompanyRow>) {
      qc.setQueryData(['company', id], (old: any) => {
        if (!old?.company) return old;
        return { ...old, company: { ...old.company, ...updates } };
      });
    },
    /** Replace contacts in cache */
    setContacts(id: string, contacts: ContactRow[]) {
      qc.setQueryData(['company', id], (old: any) => {
        if (!old) return old;
        return { ...old, contacts };
      });
    },
    /** Full invalidate — next access triggers fresh fetch */
    invalidate(id: string) {
      qc.invalidateQueries({ queryKey: ['company', id] });
    },
  };
}
