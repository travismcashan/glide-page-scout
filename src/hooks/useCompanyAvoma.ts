import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { avomaApi } from '@/lib/api/firecrawl';

type AvomaProgress = {
  page: number;
  meetingsScanned: number;
  totalMeetings: number;
  matchesFound: number;
  phase: string;
};

type AvomaData = {
  domain: string;
  totalMatches: number;
  meetings: any[];
  matchBreakdown?: { emailDomain: number; attendeeName: number; subject: number };
  excludedMeetings?: string[];
};

export function useCompanyAvoma(companyId: string, companyDomain: string | null, contactEmails: string[]) {
  const [data, setData] = useState<AvomaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<AvomaProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Load cached data from companies.enrichment_data.avoma
  const loadCached = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const { data: row } = await supabase
      .from('companies')
      .select('enrichment_data')
      .eq('id', companyId)
      .single();
    const cached = (row as any)?.enrichment_data?.avoma;
    if (cached?.meetings?.length) {
      setData(cached);
    }
  }, [companyId]);

  const search = useCallback(async (overrideDomain?: string) => {
    const domain = overrideDomain || companyDomain;
    if (!domain) {
      setError('No domain available for this company.');
      return;
    }
    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      const result = await avomaApi.lookupStreaming(
        domain,
        undefined,
        (p) => setProgress(p),
        contactEmails.length > 0 ? contactEmails : undefined,
      );

      if (!result.success) {
        setError(result.error || 'Avoma lookup failed');
        setLoading(false);
        return;
      }

      const avomaData: AvomaData = {
        domain: result.domain || domain,
        totalMatches: result.totalMatches || 0,
        meetings: result.meetings || [],
        matchBreakdown: result.matchBreakdown,
      };

      setData(avomaData);

      // Save to companies.enrichment_data.avoma via JSONB merge
      const { data: current } = await supabase
        .from('companies')
        .select('enrichment_data')
        .eq('id', companyId)
        .single();

      const existing = (current as any)?.enrichment_data || {};
      await supabase
        .from('companies')
        .update({
          enrichment_data: { ...existing, avoma: avomaData },
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', companyId);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [companyId, companyDomain, contactEmails]);

  return { data, loading, progress, error, search, loadCached };
}
