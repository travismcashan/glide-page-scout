# Plan: Replace delete-all-then-insert sync with upsert

## Research Findings

### Current Delete Patterns

**`hubspot-deals-sync/index.ts` (line 331):**
```ts
await supabase.from("deals").delete().not("hubspot_deal_id", "is", null);
```
Deletes ALL rows in `deals` that have a `hubspot_deal_id` (i.e., all HubSpot-synced deals). Then batch-inserts fresh rows in chunks of 100 (lines 372-381).

**`hubspot-contacts-sync/index.ts` (line 169):**
```ts
await supabase.from("contacts").delete().not("hubspot_contact_id", "is", null).not("lead_status", "is", null);
```
Deletes all contacts that have BOTH a `hubspot_contact_id` AND a `lead_status` (i.e., lead contacts specifically — not deal contacts or manually-created contacts). Then batch-inserts fresh rows in chunks of 100 (lines 203-209).

### Table Schemas (from migration `20260402000002_company_brain_schema.sql`)

**deals table:**
- `id` UUID PK (auto-generated)
- `hubspot_deal_id` TEXT — indexed (`idx_deals_hubspot_id`) but **NOT UNIQUE**
- `company_id` UUID FK → companies(id) ON DELETE SET NULL
- `contact_id` UUID FK → contacts(id) ON DELETE SET NULL
- `status` TEXT with CHECK constraint: `('open', 'won', 'lost', 'archived')`
- `hubspot_owner_id` — written by sync but **not in migration or types file** (added directly to prod DB)

**contacts table:**
- `id` UUID PK (auto-generated)
- `hubspot_contact_id` TEXT — indexed (`idx_contacts_hubspot_id`) but **NOT UNIQUE**
- `company_id` UUID FK → companies(id) ON DELETE SET NULL
- `lead_status`, `lifecycle_stage`, `hubspot_owner_id` — written by sync but **not in migration or types file** (added directly to prod DB)

### Foreign Key Dependencies

When deals are deleted:
- `engagements.deal_id` → SET NULL (line 151 of migration) — **engagement links to deals are destroyed on every sync run**

When contacts are deleted:
- `deals.contact_id` → SET NULL (line 106 of migration) — **deal-to-contact links are destroyed on every sync run**
- `engagements.contact_id` → SET NULL (line 150 of migration) — **engagement links to contacts are destroyed on every sync run**

**This is a silent data loss bug.** Every time contacts-sync runs, it NULLs out `deals.contact_id` for all synced deals. The deals-sync then has to re-resolve contact_id. If deals-sync runs before contacts-sync re-inserts, the contact_id mapping is permanently lost until the next deals-sync.

### HubSpot Deletion Handling

The current delete-all approach implicitly handles records deleted in HubSpot — they simply aren't re-inserted. An upsert approach needs explicit cleanup: after upserting all current records, delete any local records whose `hubspot_deal_id` / `hubspot_contact_id` is NOT in the fetched set.

### Other Sync Functions Using Delete Patterns

Only these two functions use the delete-all pattern. Other sync functions (`global-sync`, `freshdesk-sync`, `hubspot-sync`, `harvest-sync`) already use `.upsert()` with `onConflict`.

### Contacts-Sync Also Does Manual Upsert for Deal Contacts

Notably, `hubspot-deals-sync` already does a manual find-or-update pattern for deal contacts (lines 288-311) — checking by `hubspot_contact_id`, updating if exists, inserting if not. This proves the pattern works. The irony is that the contacts-sync then deletes all lead contacts and re-inserts them.

## Recommendation

### Strategy: Upsert + Soft-Delete Stale Records

1. **Add UNIQUE constraints** on `hubspot_deal_id` (deals) and `hubspot_contact_id` (contacts) — these are the natural upsert keys
2. **Replace delete+insert with `.upsert()`** using `onConflict: 'hubspot_deal_id'` / `onConflict: 'hubspot_contact_id'`
3. **After upsert, delete stale records** — records whose HubSpot ID is NOT in the fetched set (handles HubSpot-side deletions)
4. **Add missing columns via migration** — `hubspot_owner_id` on deals, `lead_status` + `lifecycle_stage` + `hubspot_owner_id` on contacts

### Why This Is Better
- **Zero downtime** — tables are never empty during sync
- **FK preservation** — `deals.contact_id` and `engagements.deal_id` survive sync runs
- **Idempotent** — safe to re-run, safe to run concurrently
- **Matches existing patterns** — other sync functions already use upsert

## Implementation Steps

### Phase 1: Schema Migration

- [ ] **Step 1: Create migration to add missing columns + unique constraints**
  ```sql
  -- Add columns that sync writes but migration never created
  ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS hubspot_owner_id TEXT;
  ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS lead_status TEXT;
  ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT;
  ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS hubspot_owner_id TEXT;
  
  -- Deduplicate any existing duplicates before adding UNIQUE constraint
  -- (keep the most recently updated row per hubspot_deal_id)
  DELETE FROM public.deals a USING public.deals b
  WHERE a.hubspot_deal_id = b.hubspot_deal_id
    AND a.hubspot_deal_id IS NOT NULL
    AND a.updated_at < b.updated_at;
  
  DELETE FROM public.contacts a USING public.contacts b
  WHERE a.hubspot_contact_id = b.hubspot_contact_id
    AND a.hubspot_contact_id IS NOT NULL
    AND a.updated_at < b.updated_at;
  
  -- Add UNIQUE constraints (partial — only non-null values)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_hubspot_deal_id_unique
    ON public.deals (hubspot_deal_id) WHERE hubspot_deal_id IS NOT NULL;
  
  CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_hubspot_contact_id_unique
    ON public.contacts (hubspot_contact_id) WHERE hubspot_contact_id IS NOT NULL;
  ```

- [ ] **Step 2: Drop the old non-unique indexes** (now redundant)
  ```sql
  DROP INDEX IF EXISTS idx_deals_hubspot_id;
  DROP INDEX IF EXISTS idx_contacts_hubspot_id;
  ```

### Phase 2: Update hubspot-deals-sync

- [ ] **Step 3: Collect all fetched HubSpot deal IDs** into a Set before DB operations
- [ ] **Step 4: Replace delete + batch-insert with `.upsert()`**
  - Change line 331 (`delete().not(...)`) → remove entirely
  - Change lines 372-381 (batch insert) → `.upsert(batch, { onConflict: 'hubspot_deal_id' })`
- [ ] **Step 5: After upsert, delete stale deals**
  ```ts
  const fetchedHsDealIds = allDeals.map(d => d.id);
  // Delete deals that exist locally but weren't in HubSpot fetch
  await supabase
    .from("deals")
    .delete()
    .not("hubspot_deal_id", "is", null)
    .not("hubspot_deal_id", "in", `(${fetchedHsDealIds.join(",")})`);
  ```
  Note: Supabase JS `.not("col", "in", ...)` may need the filter formatted as a PostgREST filter. Alternative: use `.rpc()` with a SQL function, or batch the delete by selecting stale IDs first.

### Phase 3: Update hubspot-contacts-sync

- [ ] **Step 6: Collect all fetched HubSpot contact IDs** into a Set
- [ ] **Step 7: Replace delete + batch-insert with `.upsert()`**
  - Change line 169 (`delete().not(...)`) → remove entirely
  - Change lines 203-209 (batch insert) → `.upsert(batch, { onConflict: 'hubspot_contact_id' })`
- [ ] **Step 8: After upsert, delete stale lead contacts**
  ```ts
  // Only delete lead contacts not in the fetched set
  // Must scope to lead_status IS NOT NULL to avoid touching deal contacts
  const fetchedHsContactIds = allContacts.map(c => c.id);
  // Fetch local lead contact hubspot_ids, filter out fetched ones, delete remainder
  ```

### Phase 4: Regenerate Types

- [ ] **Step 9: Regenerate Supabase TypeScript types** to pick up new columns (`hubspot_owner_id`, `lead_status`, `lifecycle_stage`)

## Affected Files

- **`supabase/migrations/NEW_migration.sql`** — new migration adding columns + unique partial indexes
- **`supabase/functions/hubspot-deals-sync/index.ts`** — replace delete+insert with upsert+stale-cleanup (lines 331, 372-381)
- **`supabase/functions/hubspot-contacts-sync/index.ts`** — replace delete+insert with upsert+stale-cleanup (lines 169, 203-209)
- **`src/integrations/supabase/types.ts`** — regenerate to include new columns

## Dependencies

1. **No duplicate `hubspot_deal_id` or `hubspot_contact_id` values in production** — the migration includes dedup logic, but should be verified first with a SELECT query:
   ```sql
   SELECT hubspot_deal_id, COUNT(*) FROM deals WHERE hubspot_deal_id IS NOT NULL GROUP BY hubspot_deal_id HAVING COUNT(*) > 1;
   SELECT hubspot_contact_id, COUNT(*) FROM contacts WHERE hubspot_contact_id IS NOT NULL GROUP BY hubspot_contact_id HAVING COUNT(*) > 1;
   ```
2. **Task #1 (deals status CHECK constraint)** should ideally be resolved first or simultaneously, since this plan touches the same insert/upsert path that writes `status: 'closed'`
3. **Missing columns must exist before upsert** — the migration must run before deploying the updated edge functions

## Risks

1. **Duplicate key violation on migration** — If duplicates exist in production, the `CREATE UNIQUE INDEX` will fail. The dedup DELETE handles this, but if rows have identical `updated_at` timestamps, both rows survive and the index creation fails. Mitigation: add a tiebreaker (`AND a.id < b.id`) to the dedup query.

2. **Stale record deletion scope** — The contacts-sync delete must be scoped to only lead contacts (`lead_status IS NOT NULL`), not all contacts with a `hubspot_contact_id`. The deals-sync writes deal contacts with `hubspot_contact_id` too — those must not be deleted by the contacts-sync stale cleanup. Current delete pattern already scopes correctly (`.not("lead_status", "is", null)`), so the stale cleanup must preserve this filter.

3. **PostgREST filter limitations** — Supabase JS client's `.not("col", "in", ...)` with 1000+ IDs may hit URL length limits. Safer approach: query all local HubSpot IDs, compute the diff in JS, then delete by primary key `id` in batches.

4. **Race condition during stale cleanup** — If a new deal is created in HubSpot between the fetch and the stale-delete, it could be deleted. Risk is minimal (sync runs are infrequent, window is seconds) and self-healing (next sync re-creates it).

5. **Engagement FK preservation** — This is actually a **benefit** of the change. Currently, every sync run SETs NULL on `engagements.deal_id` and `engagements.contact_id`. After this change, those FKs survive. However, if an engagement references a deal that gets deleted as stale, the FK still SETs NULL — which is correct behavior (the deal no longer exists in HubSpot).
