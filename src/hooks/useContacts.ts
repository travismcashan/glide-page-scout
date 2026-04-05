import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GrowthFilter } from './useCompanies';

export type ContactListRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  department: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  seniority: string | null;
  role_type: string | null;
  is_primary: boolean;
  lead_status: string | null;
  lifecycle_stage: string | null;
  enrichment_data: any;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined from companies
  company_name: string | null;
  company_domain: string | null;
  company_logo: string | null;
};

const CONTACT_COLUMNS = 'id, first_name, last_name, email, phone, title, department, linkedin_url, photo_url, seniority, role_type, is_primary, lead_status, lifecycle_stage, enrichment_data, company_id, created_at, updated_at';

async function fetchContacts(workspace?: string, growthFilter: GrowthFilter = 'pipeline'): Promise<ContactListRow[]> {
  let companyIds: string[] | null = null;

  // Growth: scope contacts to the same company set as the companies page filter
  if (workspace === 'growth') {
    if (growthFilter === 'pipeline') {
      const ids = new Set<string>();
      const [{ data: dealRows }, { data: leadRows }] = await Promise.all([
        supabase.from('deals').select('company_id').eq('status', 'open').not('company_id', 'is', null),
        supabase.from('contacts').select('company_id').not('lead_status', 'is', null).not('company_id', 'is', null),
      ]);
      for (const r of dealRows || []) if (r.company_id) ids.add(r.company_id);
      for (const r of leadRows || []) if (r.company_id) ids.add(r.company_id);
      companyIds = [...ids];
      if (companyIds.length === 0) return [];
    } else if (growthFilter === 'active') {
      const { data } = await supabase.from('companies').select('id').eq('status', 'active');
      companyIds = (data || []).map(c => c.id);
      if (companyIds.length === 0) return [];
    } else if (growthFilter === 'inactive') {
      const { data } = await supabase.from('companies').select('id').eq('status', 'past');
      companyIds = (data || []).map(c => c.id);
      if (companyIds.length === 0) return [];
    }
    // 'all' = no companyIds filter, fetch all contacts
  }

  // Fetch contacts — Supabase doesn't support JOIN, so fetch contacts then companies
  let query = supabase.from('contacts').select(CONTACT_COLUMNS).order('updated_at', { ascending: false });

  if (companyIds) {
    query = query.in('company_id', companyIds);
  }

  const { data: contacts, error } = await query;
  if (error || !contacts) return [];

  // Fetch company names for the contacts
  const uniqueCompanyIds = [...new Set(contacts.map(c => c.company_id).filter(Boolean))] as string[];
  const companyMap = new Map<string, { name: string; domain: string | null; logo_url: string | null }>();

  if (uniqueCompanyIds.length > 0) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, domain, logo_url')
      .in('id', uniqueCompanyIds);
    for (const c of companies || []) {
      companyMap.set(c.id, { name: c.name, domain: c.domain, logo_url: c.logo_url });
    }
  }

  return contacts.map(c => ({
    ...c,
    company_name: c.company_id ? companyMap.get(c.company_id)?.name || null : null,
    company_domain: c.company_id ? companyMap.get(c.company_id)?.domain || null : null,
    company_logo: c.company_id ? companyMap.get(c.company_id)?.logo_url || null : null,
  }));
}

export function useContacts(workspace?: string, growthFilter: GrowthFilter = 'pipeline') {
  const query = useQuery({
    queryKey: ['contacts-list', workspace, growthFilter],
    queryFn: () => fetchContacts(workspace, growthFilter),
    staleTime: 5 * 60 * 1000,
  });

  return {
    contacts: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
