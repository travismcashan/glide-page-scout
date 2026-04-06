import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FormSubmission = {
  id: string;
  company_id: string;
  contact_id: string | null;
  form_name: string | null;
  page_url: string | null;
  page_title: string | null;
  submitted_at: string | null;
  contact_email: string | null;
  contact_name: string | null;
  form_values: Record<string, any> | null;
  created_at: string;
};

export function useFormSubmissions(companyId: string | undefined) {
  return useQuery({
    queryKey: ['form-submissions', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_submissions' as any)
        .select('id, company_id, contact_id, form_name, page_url, page_title, submitted_at, contact_email, contact_name, form_values, created_at')
        .eq('company_id', companyId!)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as FormSubmission[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}
