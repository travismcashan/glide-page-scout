import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Plan = {
  id: string;
  title: string;
  status: 'draft' | 'ready' | 'in-progress' | 'shipped' | 'archived';
  category: 'feature' | 'infrastructure' | 'refactor' | 'integration';
  summary: string | null;
  plan_content: string | null;
  research_notes: string | null;
  session_id: string | null;
  computer_name: string | null;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  effort_estimate: 'small' | 'medium' | 'large' | 'xl' | null;
  related_files: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
  user_id: string | null;
};

export type PlanInsert = Partial<Plan> & { title: string };
export type PlanUpdate = Partial<Plan> & { id: string };

async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('claude_code_plans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Plan[];
}

async function fetchPlan(id: string): Promise<Plan | null> {
  const { data, error } = await supabase
    .from('claude_code_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Plan) ?? null;
}

export function usePlans() {
  const query = useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
  });
  return {
    plans: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function usePlan(id: string | undefined) {
  const query = useQuery({
    queryKey: ['plans', id],
    queryFn: () => fetchPlan(id!),
    enabled: !!id,
  });
  return {
    plan: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: PlanInsert) => {
      const { data, error } = await supabase
        .from('claude_code_plans')
        .insert(plan)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Plan;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: PlanUpdate) => {
      const { data, error } = await supabase
        .from('claude_code_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Plan;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['plans', data.id] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('claude_code_plans')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}
