import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Engagement = {
  id: string;
  company_id: string;
  engagement_type: string;
  subject: string | null;
  body_preview: string | null;
  direction: string | null;
  occurred_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

export function useEngagements(companyId: string | undefined) {
  return useQuery({
    queryKey: ['engagements', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engagements')
        .select('id, company_id, engagement_type, subject, body_preview, direction, occurred_at, metadata, created_at')
        .eq('company_id', companyId!)
        .order('occurred_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Engagement[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}
