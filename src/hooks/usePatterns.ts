import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────

export type PatternType = 'conversion' | 'layout' | 'content' | 'navigation' | 'engagement' | 'seo' | 'accessibility';
export type PatternStatus = 'draft' | 'validated' | 'deprecated' | 'suggested';
export type PatternSource = 'manual' | 'detected' | 'imported' | 'ai_suggested';
export type ApplicationOutcome = 'improved' | 'neutral' | 'declined' | 'pending';

export interface Pattern {
  id: string;
  user_id: string;
  industry: string;
  vertical: string | null;
  pattern_type: PatternType;
  block_type: string | null;
  title: string;
  description: string;
  evidence: string | null;
  anti_pattern: string | null;
  implementation_notes: string | null;
  conversion_data: Record<string, any>;
  persona_mapping: Array<{ persona: string; relevance: 'primary' | 'secondary'; jtbd: string }>;
  source: PatternSource;
  confidence_score: number;
  application_count: number;
  tags: string[];
  status: PatternStatus;
  created_at: string;
  updated_at: string;
}

export interface PatternApplication {
  id: string;
  user_id: string;
  pattern_id: string;
  company_id: string;
  applied_at: string;
  applied_to: string | null;
  notes: string | null;
  outcome_measured_at: string | null;
  before_metrics: Record<string, any>;
  after_metrics: Record<string, any>;
  outcome: ApplicationOutcome | null;
  outcome_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  company?: { id: string; name: string; domain: string | null };
}

export type PatternInsert = Partial<Pattern> & { title: string; description: string; industry: string; pattern_type: PatternType };
export type PatternUpdate = Partial<Pattern> & { id: string };

export interface PatternFilters {
  industry?: string;
  pattern_type?: PatternType;
  block_type?: string;
  status?: PatternStatus;
  source?: PatternSource;
  minConfidence?: number;
  search?: string;
}

// ── Fetch helpers ──────────────────────────────────────────────

async function fetchPatterns(): Promise<Pattern[]> {
  const { data, error } = await supabase
    .from('patterns')
    .select('*')
    .order('confidence_score', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Pattern[];
}

async function fetchPattern(id: string): Promise<Pattern | null> {
  const { data, error } = await supabase
    .from('patterns')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Pattern) ?? null;
}

async function fetchPatternApplications(patternId: string): Promise<PatternApplication[]> {
  const { data, error } = await supabase
    .from('pattern_applications')
    .select('*, company:companies(id, name, domain)')
    .eq('pattern_id', patternId)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PatternApplication[];
}

async function fetchCompanyPatterns(companyId: string): Promise<(PatternApplication & { pattern: Pattern })[]> {
  const { data, error } = await supabase
    .from('pattern_applications')
    .select('*, pattern:patterns(*)')
    .eq('company_id', companyId)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (PatternApplication & { pattern: Pattern })[];
}

// ── Query hooks ────────────────────────────────────────────────

export function usePatterns(filters?: PatternFilters) {
  const query = useQuery({
    queryKey: ['patterns'],
    queryFn: fetchPatterns,
    staleTime: 5 * 60 * 1000,
  });

  // Client-side filtering (dataset is small — 15-100 patterns)
  const filtered = (query.data ?? []).filter((p) => {
    if (filters?.industry && p.industry !== filters.industry) return false;
    if (filters?.pattern_type && p.pattern_type !== filters.pattern_type) return false;
    if (filters?.block_type && p.block_type !== filters.block_type) return false;
    if (filters?.status && p.status !== filters.status) return false;
    if (filters?.source && p.source !== filters.source) return false;
    if (filters?.minConfidence && p.confidence_score < filters.minConfidence) return false;
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.industry.toLowerCase().includes(q) ||
        (p.tags as string[])?.some((t: string) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return {
    patterns: filtered,
    allPatterns: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function usePattern(id: string | undefined) {
  const query = useQuery({
    queryKey: ['patterns', id],
    queryFn: () => fetchPattern(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
  return {
    pattern: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}

export function usePatternApplications(patternId: string | undefined) {
  const query = useQuery({
    queryKey: ['pattern-applications', patternId],
    queryFn: () => fetchPatternApplications(patternId!),
    enabled: !!patternId,
    staleTime: 5 * 60 * 1000,
  });
  return {
    applications: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}

export function useCompanyPatterns(companyId: string | undefined) {
  const query = useQuery({
    queryKey: ['company-patterns', companyId],
    queryFn: () => fetchCompanyPatterns(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
  return {
    applications: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}

// ── Mutations ──────────────────────────────────────────────────

export function useCreatePattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pattern: PatternInsert) => {
      const { data, error } = await supabase
        .from('patterns')
        .insert(pattern)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Pattern;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  });
}

export function useUpdatePattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: PatternUpdate) => {
      const { data, error } = await supabase
        .from('patterns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Pattern;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['patterns'] });
      qc.invalidateQueries({ queryKey: ['patterns', data.id] });
    },
  });
}

export function useDeletePattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('patterns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  });
}

export function useRecordApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (app: {
      pattern_id: string;
      company_id: string;
      applied_to?: string;
      notes?: string;
      outcome?: ApplicationOutcome;
    }) => {
      // Insert application
      const { data, error } = await supabase
        .from('pattern_applications')
        .insert({
          pattern_id: app.pattern_id,
          company_id: app.company_id,
          applied_to: app.applied_to ?? null,
          notes: app.notes ?? null,
          outcome: app.outcome ?? 'pending',
        })
        .select()
        .single();
      if (error) throw error;

      // Increment application_count on the pattern
      const { error: updateError } = await supabase.rpc('increment_pattern_application_count' as any, {
        pattern_id_input: app.pattern_id,
      });
      // If RPC doesn't exist yet, do manual increment
      if (updateError) {
        const { data: pattern } = await supabase
          .from('patterns')
          .select('application_count')
          .eq('id', app.pattern_id)
          .single();
        if (pattern) {
          await supabase
            .from('patterns')
            .update({ application_count: ((pattern as any).application_count ?? 0) + 1 })
            .eq('id', app.pattern_id);
        }
      }

      return data as unknown as PatternApplication;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['patterns'] });
      qc.invalidateQueries({ queryKey: ['patterns', data.pattern_id] });
      qc.invalidateQueries({ queryKey: ['pattern-applications', data.pattern_id] });
    },
  });
}

// ── AI Pattern Generation ─────────────────────────────────────

export interface GeneratePatternsResult {
  success: boolean;
  patterns: Array<{ id: string; title: string; industry: string; pattern_type: string; confidence_score: number }>;
  stats: { companiesAnalyzed: number; patternsSuggested: number; industries: string[] };
  error?: string;
}

export function useGeneratePatterns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (industry?: string): Promise<GeneratePatternsResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('generate-patterns', {
        body: { industry },
      });

      if (res.error) throw new Error(res.error.message);
      const result = res.data as GeneratePatternsResult;
      if (!result.success) throw new Error(result.error ?? 'Pattern generation failed');
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patterns'] });
    },
  });
}
