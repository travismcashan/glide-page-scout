import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CompanyMessage = {
  id: string;
  company_id: string;
  channel_id: string | null;
  channel_name: string | null;
  message_ts: string | null;
  author: string | null;
  text: string | null;
  thread_ts: string | null;
  permalink: string | null;
  created_at: string;
};

export function useCompanyMessages(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-messages', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_messages' as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CompanyMessage[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}
