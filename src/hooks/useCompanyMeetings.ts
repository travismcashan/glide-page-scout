import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CompanyMeeting = {
  id: string;
  company_id: string;
  external_id: string | null;
  source: string;
  title: string | null;
  date: string | null;
  duration_minutes: number | null;
  attendees: any[];
  summary: string | null;
  transcript: string | null;
  recording_url: string | null;
  created_at: string;
};

export function useCompanyMeetings(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-meetings', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_meetings' as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as CompanyMeeting[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}
