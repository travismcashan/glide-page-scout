/**
 * Hook for Code Council plan reviews.
 * Triggers review-plan edge function and reads cached reviews from plan.reviews JSONB.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReviewScores {
  feasibility: number;
  impact: number;
  risk: number;
  overall: number;
}

export interface PlanReview {
  reviewer_id: string;
  reviewer_name: string;
  reviewer_role: string;
  icon: string;
  scores: ReviewScores;
  verdict: 'approve' | 'revise' | 'rethink' | 'error';
  summary: string;
  strengths: string[];
  concerns: string[];
  suggestions: string[];
  status: 'completed' | 'failed';
}

export interface ReviewConsensus {
  scores: ReviewScores;
  verdict: string;
  reviewers_completed: number;
  reviewers_total: number;
}

export interface PlanReviewData {
  reviews: PlanReview[];
  consensus: ReviewConsensus;
  reviewed_at: string;
  plan_version: { title: string; status: string };
}

export function useRequestReview() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase.functions.invoke('review-plan', {
        body: { planId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as PlanReviewData;
    },
    onSuccess: (_data, planId) => {
      qc.invalidateQueries({ queryKey: ['plan', planId] });
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
