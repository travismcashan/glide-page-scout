/**
 * TanStack Query hook for Projects page.
 * Reads from local asana_projects + project_mappings + harvest_project_budgets view.
 * No external API calls — data-first architecture.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LocalAsanaProject {
  id: string;
  asana_project_gid: string;
  company_id: string | null;
  name: string;
  status_color: string | null;
  status_text: string | null;
  owner: string | null;
  team_members: string[] | null;
  num_completed_tasks: number | null;
  num_incomplete_tasks: number | null;
  num_tasks: number | null;
  portfolio_gid: string | null;
  portfolio_name: string | null;
  milestone_gid: string | null;
  milestone_name: string | null;
  custom_fields: Record<string, string | number | null> | null;
  is_archived: boolean | null;
  start_date: string | null;
  due_date: string | null;
}

export interface LocalProjectMapping {
  asana_project_gid: string;
  harvest_project_id: number | null;
  harvest_project_name: string | null;
  client_display_name: string | null;
  match_confidence: number | null;
  company_id: string | null;
}

export interface LocalProjectBudget {
  harvest_project_id: string;
  budget: number | null;
  budget_by: string | null;
  budget_spent: number;
  budget_remaining: number | null;
}

async function fetchProjects() {
  // Fetch all three data sources in parallel from local DB
  const [projectsRes, mappingsRes, budgetsRes] = await Promise.all([
    supabase
      .from('asana_projects')
      .select('id, asana_project_gid, company_id, name, status_color, status_text, owner, team_members, num_completed_tasks, num_incomplete_tasks, num_tasks, portfolio_gid, portfolio_name, milestone_gid, milestone_name, custom_fields, is_archived, start_date, due_date')
      .eq('is_archived', false)
      .order('name'),
    supabase
      .from('project_mappings')
      .select('asana_project_gid, harvest_project_id, harvest_project_name, client_display_name, match_confidence, company_id'),
    supabase
      .from('harvest_project_budgets' as any)
      .select('harvest_project_id, budget, budget_by, budget_spent, budget_remaining'),
  ]);

  if (projectsRes.error) throw projectsRes.error;

  return {
    projects: (projectsRes.data ?? []) as LocalAsanaProject[],
    mappings: (mappingsRes.data ?? []) as LocalProjectMapping[],
    budgets: (budgetsRes.data ?? []) as LocalProjectBudget[],
  };
}

export function useProjects() {
  const query = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    projects: query.data?.projects ?? [],
    mappings: query.data?.mappings ?? [],
    budgets: query.data?.budgets ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function useInvalidateProjects() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['projects'] });
}
