-- Add 'suggested' status to patterns table for AI-generated pattern suggestions
ALTER TABLE public.patterns DROP CONSTRAINT IF EXISTS patterns_status_check;
ALTER TABLE public.patterns ADD CONSTRAINT patterns_status_check
  CHECK (status IN ('draft', 'validated', 'deprecated', 'suggested'));
