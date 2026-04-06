import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PatternSuggestion {
  pattern_id: string;
  confidence_score: number;
  reasoning: string;
  suggested_customizations: string;
}

export interface PatternSuggestionsCache {
  suggestions: PatternSuggestion[];
  generated_at: string;
  patterns_analyzed: number;
  had_crawl_data: boolean;
}

// Read cached suggestions from companies.enrichment_data.pattern_suggestions
async function fetchCachedSuggestions(companyId: string): Promise<PatternSuggestionsCache | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('enrichment_data')
    .eq('id', companyId)
    .single();

  if (error || !data) return null;
  return (data.enrichment_data as any)?.pattern_suggestions ?? null;
}

export function usePatternSuggestions(companyId: string | undefined) {
  const query = useQuery({
    queryKey: ['pattern-suggestions', companyId],
    queryFn: () => fetchCachedSuggestions(companyId!),
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000, // 10 min stale
  });

  return {
    data: query.data ?? null,
    suggestions: query.data?.suggestions ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function useGeneratePatternSuggestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (companyId: string): Promise<PatternSuggestion[]> => {
      const res = await supabase.functions.invoke('generate-pattern-suggestions', {
        body: { company_id: companyId },
      });

      if (res.error) throw new Error(res.error.message);
      const result = res.data as { success: boolean; suggestions: PatternSuggestion[]; error?: string };
      if (!result.success) throw new Error(result.error ?? 'Generation failed');
      return result.suggestions;
    },
    onSuccess: (_data, companyId) => {
      qc.invalidateQueries({ queryKey: ['pattern-suggestions', companyId] });
      // Also invalidate the company query since enrichment_data changed
      qc.invalidateQueries({ queryKey: ['company', companyId] });
    },
  });
}
