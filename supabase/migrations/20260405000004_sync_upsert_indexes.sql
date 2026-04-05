-- ============================================================
-- Add partial unique indexes for upsert-based sync
-- Add missing columns written by sync functions but never migrated
-- ============================================================

-- 1. Add missing columns that sync functions write
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS hubspot_owner_id TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS lead_status TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS hubspot_owner_id TEXT;

-- 2. Deduplicate before adding unique indexes
-- Keep the most recently updated row per hubspot_deal_id (tiebreak on id)
DELETE FROM public.deals a USING public.deals b
WHERE a.hubspot_deal_id = b.hubspot_deal_id
  AND a.hubspot_deal_id IS NOT NULL
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id));

DELETE FROM public.contacts a USING public.contacts b
WHERE a.hubspot_contact_id = b.hubspot_contact_id
  AND a.hubspot_contact_id IS NOT NULL
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id));

-- 3. Drop old non-unique indexes (will be replaced by unique partial indexes)
DROP INDEX IF EXISTS idx_deals_hubspot_id;
DROP INDEX IF EXISTS idx_contacts_hubspot_id;

-- 4. Add partial unique indexes (only on non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_hubspot_deal_id_unique
  ON public.deals (hubspot_deal_id) WHERE hubspot_deal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_hubspot_contact_id_unique
  ON public.contacts (hubspot_contact_id) WHERE hubspot_contact_id IS NOT NULL;
