-- Fix deals.status: backfill "closed" → semantic values and restore CHECK constraint
-- Must run AFTER hubspot-deals-sync is redeployed with outcome mapping

-- Backfill any remaining "closed" rows to "archived" (safe default)
UPDATE public.deals SET status = 'archived' WHERE status = 'closed';

-- Drop existing CHECK if present (may have been dropped manually)
DO $$
BEGIN
  ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_status_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- Restore the CHECK constraint
ALTER TABLE public.deals ADD CONSTRAINT deals_status_check
  CHECK (status IN ('open', 'won', 'lost', 'archived'));
