# Plan: Create or remove company_source_data table

## Research Findings

### Migration Status
**No migration exists.** Searched all files in `supabase/migrations/` — zero references to `company_source_data`. The table is also **absent from the generated Supabase types** (`src/integrations/supabase/types.ts`), confirming it was never created via migration or the Supabase dashboard (or if it was created manually, types were never regenerated to include it).

### Write Path (1 location)
**`supabase/functions/global-sync/index.ts`** — `storeRawSourceData()` function (lines 445-495):
- Called on both existing company updates (line 629) and new company inserts (line 665)
- Upserts rows with `onConflict: 'company_id,source'`
- Columns written: `company_id` (UUID FK), `source` (string: 'hubspot'|'harvest'|'freshdesk'), `source_id` (string), `raw_data` (JSONB — full API response), `fetched_at` (timestamp)
- Uses `service_role` key, so RLS is bypassed

### Read Path (1 location)
**`src/pages/CompanyDetailPage.tsx`** — "Source Data" tab (lines 278-313, 1080-1200):
- Queries `company_source_data` filtered by `company_id`, ordered by `source`
- Displays each source as an expandable card showing: source label (HubSpot/Harvest/Freshdesk), source_id, field count, fetched_at timestamp, and raw JSON data table
- Has a "Refresh" button that re-fetches
- This tab exists in **all three workspaces** (Growth, Delivery, Admin) per `workspace-nav.ts` lines 74, 86, 92

### Feature Assessment: ALIVE but BROKEN
This is a **living feature** — actively coded in both backend and frontend, shown in all workspaces. However, it **silently fails** because:
1. The table doesn't exist → upserts in global-sync fail silently (Supabase returns error, but the function doesn't check/log it)
2. The frontend query returns empty → the Source Data tab shows nothing (but doesn't error because `data || []` handles null)
3. The feature is **architecturally redundant** with `companies.enrichment_data` JSONB — both store raw API responses per source, but `enrichment_data` stores crawl-phase data (Apollo, Ocean, SEMrush) while `company_source_data` was intended for sync-phase data (HubSpot, Harvest, Freshdesk)

### Overlap Analysis
The `companies.enrichment_data` JSONB column already stores:
- `apollo_org`, `apollo_team`, `ocean`, `avoma`, `semrush`, `hubspot` (per company-centric architecture docs)

The `company_source_data` table would store:
- `hubspot` (full company record), `harvest` (full client record), `freshdesk` (full company record)

There IS overlap on HubSpot — `enrichment_data.hubspot` and `company_source_data` where `source='hubspot'` would store the same data. Harvest and Freshdesk raw data is NOT stored anywhere else currently.

## Recommendation

**Option A (Recommended): Create the table via migration.** The feature is intentional, actively coded, and serves a real purpose — giving users visibility into raw source data from all connected systems. The Source Data tab is already wired into all three workspaces. The `enrichment_data` JSONB is a different concern (crawl-phase enrichment) vs. this table (sync-phase raw records).

**Option B (Alternative): Remove all references and consolidate into enrichment_data.** This would mean storing Harvest/Freshdesk raw data in `enrichment_data.harvest` and `enrichment_data.freshdesk`, and removing the separate table concept entirely. Simpler schema, but loses the per-source querying and the clean separation of sync vs. enrichment data.

**Why Option A:** The table schema is simple, the code is already written for both read and write paths, and the Source Data tab provides unique debugging/transparency value for Travis to see exactly what each integration returned. Creating the table is a 5-minute migration vs. a larger refactor to consolidate.

## Implementation Steps

- [ ] **Step 1: Create migration** — Add `supabase/migrations/YYYYMMDDHHMMSS_create_company_source_data.sql` with:
  ```sql
  CREATE TABLE company_source_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_id TEXT,
    raw_data JSONB,
    fetched_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, source)
  );

  -- RLS
  ALTER TABLE company_source_data ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view company source data"
    ON company_source_data FOR SELECT
    USING (auth.uid() IS NOT NULL);
  CREATE POLICY "Service role can manage company source data"
    ON company_source_data FOR ALL
    USING (auth.role() = 'service_role');

  -- Index for company lookups
  CREATE INDEX idx_company_source_data_company_id ON company_source_data(company_id);
  ```
- [ ] **Step 2: Apply migration** — Run via Supabase CLI or dashboard
- [ ] **Step 3: Regenerate types** — Run `supabase gen types typescript` to add `company_source_data` to `types.ts`
- [ ] **Step 4: Add error logging to global-sync** — After the upsert call (line 492-494), check for errors and log them so future failures aren't silent
- [ ] **Step 5: Test** — Run global-sync, verify Source Data tab populates on a company detail page
- [ ] **Step 6 (Optional): Deduplicate HubSpot** — Decide if `enrichment_data.hubspot` and `company_source_data` `source='hubspot'` should coexist or if one should be removed. Low priority — they serve different access patterns.

## Affected Files

- `supabase/migrations/YYYYMMDDHHMMSS_create_company_source_data.sql` — **NEW** migration file
- `src/integrations/supabase/types.ts` — regenerated to include new table type
- `supabase/functions/global-sync/index.ts` — add error logging after upsert (lines 491-495)
- No changes needed to `CompanyDetailPage.tsx` or `workspace-nav.ts` — they're already correct

## Dependencies

- Supabase CLI access or dashboard access to apply migration
- `companies` table must exist with `id` UUID primary key (it does — 2102 rows)
- No blocking dependencies on other Tier 0 tasks

## Risks

- **Low risk:** Simple table creation, no existing data to migrate
- **Silent data loss:** Until this migration runs, every global-sync execution silently discards raw source data. This is the current state and has been happening since the feature was written.
- **RLS policy:** The SELECT policy uses `auth.uid() IS NOT NULL` (any authenticated user can read). This matches the pattern used by other tables in the project. If more restrictive access is needed later, the policy can be tightened.
- **HubSpot duplication:** Both `enrichment_data.hubspot` and this table will store HubSpot data. Not a breaking issue — they serve different UI surfaces — but should be documented/decided on eventually.
