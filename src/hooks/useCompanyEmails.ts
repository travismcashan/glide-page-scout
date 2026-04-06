import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CompanyEmail = {
  id: string;
  company_id: string;
  gmail_id: string | null;
  thread_id: string | null;
  subject: string | null;
  sender: string | null;
  recipient: string | null;
  body: string | null;
  snippet: string | null;
  date: string | null;
  attachments: any[];
  created_at: string;
};

export function useCompanyEmails(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-emails', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_emails' as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as CompanyEmail[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}
