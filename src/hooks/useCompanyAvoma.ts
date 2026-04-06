import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
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

/**
 * Hook for syncing Avoma meetings to the local company_meetings table.
 * Reading is handled by useCompanyMeetings; this hook handles the sync/search action.
 */
export function useCompanyAvoma(companyId: string, companyDomain: string | null, contactEmails: string[]) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<AvomaProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

      const meetings = result.meetings || [];

      // Get current user for RLS
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Store meetings locally in company_meetings table
      if (meetings.length > 0) {
        const rows = meetings.map((m: any) => ({
          company_id: companyId,
          external_id: m.uuid || m.id || null,
          source: 'avoma',
          title: m.subject || m.title || null,
          date: m.scheduled_at || m.date || null,
          duration_minutes: m.duration ? Math.round(m.duration / 60) : null,
          attendees: m.attendees || [],
          summary: m.summary || null,
          recording_url: m.transcript_url || m.recording_url || null,
          raw_data: m,
          user_id: user.id,
        }));

        const { error: insertError } = await supabase
          .from('company_meetings' as any)
          .upsert(rows as any, { onConflict: 'external_id,source,user_id' });

        if (insertError) console.error('[avoma] Insert error:', insertError);
      }

      // Also save to enrichment_data for backwards compat
      const avomaData: AvomaData = {
        domain: result.domain || domain,
        totalMatches: result.totalMatches || 0,
        meetings,
        matchBreakdown: result.matchBreakdown,
      };

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

      // Refresh local meetings query
      queryClient.invalidateQueries({ queryKey: ['company-meetings', companyId] });
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [companyId, companyDomain, contactEmails, queryClient]);

  return { loading, progress, error, search };
}
