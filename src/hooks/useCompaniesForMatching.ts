import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const MATCH_COLUMNS = `
  id, name, domain, website_url, status,
  hubspot_company_id, harvest_client_id, harvest_client_name,
  freshdesk_company_id, freshdesk_company_name,
  quickbooks_client_name, quickbooks_invoice_summary,
  asana_project_gids, industry, employee_count, enrichment_data, created_at
`;

export function useCompaniesForMatching() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const all: any[] = [];
    const PAGE_SIZE = 1000;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('companies')
        .select(MATCH_COLUMNS)
        .order('name')
        .range(offset, offset + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    setCompanies(all);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  return { companies, loading, refetch: fetch };
}
