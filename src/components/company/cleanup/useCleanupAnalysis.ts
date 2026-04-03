import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  type CompanyRecord,
  type DuplicateGroup,
  findDuplicates,
  looksLikeDomain,
  normalizeDomain,
} from '@/lib/companyNormalization';

export type CleanupAnalysis = {
  loading: boolean;
  companies: CompanyRecord[];
  duplicates: DuplicateGroup[];
  unlinkedHarvest: CompanyRecord[];
  unlinkedFreshdesk: CompanyRecord[];
  unlinkedAsana: CompanyRecord[];
  urlAsName: CompanyRecord[];
  missingDomain: CompanyRecord[];
  missingEnrichment: CompanyRecord[];
  stats: {
    total: number;
    withHubspot: number;
    withHarvest: number;
    withFreshdesk: number;
    withAsana: number;
    withQuickbooks: number;
    withDomain: number;
    duplicateGroups: number;
    urlAsNameCount: number;
  };
  refetch: () => void;
};

const COMPANY_COLUMNS = `
  id, name, domain, website_url, status,
  hubspot_company_id, harvest_client_id, harvest_client_name,
  freshdesk_company_id, freshdesk_company_name,
  quickbooks_client_name, quickbooks_invoice_summary,
  asana_project_gids, industry, employee_count,
  enrichment_data, created_at, last_synced_at
`;

export function useCleanupAnalysis(): CleanupAnalysis {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);

  const fetchAndAnalyze = async () => {
    setLoading(true);
    try {
      // Paginate to get ALL companies (Supabase defaults to 1000 limit)
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('companies')
          .select(COMPANY_COLUMNS)
          .order('name')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const all = allData as CompanyRecord[];
      setCompanies(all);

      // Find duplicates
      const dupes = findDuplicates(all);
      setDuplicates(dupes);
    } catch (err) {
      console.error('[useCleanupAnalysis] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAndAnalyze(); }, []);

  // Derived analysis
  const active = companies.filter(c => c.status !== 'archived');

  // Companies with Harvest ID but the Harvest company has no HubSpot link
  // (unlinked = has one system ID but not linked in the other direction)
  const harvestIds = new Set(companies.filter(c => c.harvest_client_id).map(c => c.harvest_client_id));
  const unlinkedHarvest = companies.filter(
    c => c.harvest_client_id && !c.hubspot_company_id
  );

  const unlinkedFreshdesk = companies.filter(
    c => c.freshdesk_company_id && !c.hubspot_company_id && !c.harvest_client_id
  );

  const unlinkedAsana = companies.filter(
    c => c.asana_project_gids?.length && !c.hubspot_company_id && !c.harvest_client_id
  );

  const urlAsName = companies.filter(c => looksLikeDomain(c.name));

  const missingDomain = companies.filter(
    c => !c.domain && !normalizeDomain(c.website_url) && c.status !== 'archived'
  );

  const missingEnrichment = companies.filter(
    c => (!c.enrichment_data || Object.keys(c.enrichment_data).length === 0) && c.status !== 'archived'
  );

  const stats = {
    total: companies.length,
    withHubspot: companies.filter(c => c.hubspot_company_id).length,
    withHarvest: companies.filter(c => c.harvest_client_id).length,
    withFreshdesk: companies.filter(c => c.freshdesk_company_id).length,
    withAsana: companies.filter(c => c.asana_project_gids?.length).length,
    withQuickbooks: companies.filter(c => c.quickbooks_client_name).length,
    withDomain: companies.filter(c => c.domain).length,
    duplicateGroups: duplicates.length,
    urlAsNameCount: urlAsName.length,
  };

  return {
    loading,
    companies,
    duplicates,
    unlinkedHarvest,
    unlinkedFreshdesk,
    unlinkedAsana,
    urlAsName,
    missingDomain,
    missingEnrichment,
    stats,
    refetch: fetchAndAnalyze,
  };
}
