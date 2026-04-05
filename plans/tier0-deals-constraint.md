# Plan: Fix deals status CHECK constraint mismatch

## Research Findings

### 1. The CHECK Constraint (Migration)
File: `supabase/migrations/20260402000002_company_brain_schema.sql` line 115:
```sql
status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'archived'))
```
The constraint allows exactly 4 values: `open`, `won`, `lost`, `archived`.

### 2. What hubspot-deals-sync Writes
File: `supabase/functions/hubspot-deals-sync/index.ts` line 353:
```ts
status: closedStageIds.has(stageId) ? "closed" : "open",
```
The sync writes exactly 2 values: `"closed"` or `"open"`. **`"closed"` violates the CHECK constraint.** It never writes `won`, `lost`, or `archived`.

The `closedStageIds` Set is built from pipeline stages with `closed: true` (lines 85-88). These stages include a mix of outcomes: "Closed: Won!", "Closed: Lost", "Closed: In Contract", "Closed: Drip", "Closed: Unresponsive", "Closed: Unqualified", "Closed: Declined". The sync lumps them all into one `"closed"` status.

### 3. Why It Doesn't Fail at Runtime
The sync uses `service_role` key (line 105), which **bypasses RLS but does NOT bypass CHECK constraints**. This means one of two things:
- The CHECK constraint was dropped or altered manually in production after the migration ran (most likely — the sync has been running successfully inserting 1,128 deals).
- Or the migration itself was never applied in production (less likely given other tables work).

The Supabase generated types (`src/integrations/supabase/types.ts` line 543) show `status: string` with no enum restriction, consistent with the constraint being absent in production.

### 4. What the Frontend Expects

**Reads looking for `"closed"`** (matching sync output):
- `src/hooks/useCachedQueries.ts:442` — `fetchPipelineStats()` filters `.eq('status', 'closed')` to compute closed-deal stats

**Reads looking for `"open"`** (matching sync output):
- `src/hooks/useCompanies.ts:22` — Growth workspace filters `.eq('status', 'open')` to find companies with active deals
- `src/hooks/useContacts.ts:40` — same pattern for contacts page

**Reads looking for `"won"` / `"lost"`** (NOT matching sync output):
- `src/pages/CompanyDetailPage.tsx:125-129` — `DEAL_STATUS_COLORS` maps `won`, `lost`, `open` (no `closed` entry)
- `src/pages/CompanyDetailPage.tsx:723` — inline ternary checks `deal.status === 'won'` and `deal.status === 'lost'`
- `src/components/contacts/ContactDetailContent.tsx:54-58` — same `DEAL_STATUS_COLORS` with `won`, `lost`, `open`

**Writes using `"open"`:**
- `src/lib/agencyBrain.ts:670` — manual deal creation via `.insert({ ...dealData, status: 'open' })`

### 5. The Semantic Gap

HubSpot closed stages have rich semantics the sync currently discards:
- **Won:** "Closed: Won!", "Closed: In Contract" — positive outcomes
- **Lost:** "Closed: Lost", "Closed: Declined" — negative outcomes
- **Drip/Unresponsive/Unqualified:** neither won nor lost — these are more like "archived"

The sync collapses all of these into `"closed"`, but the frontend UI has styling for `won`, `lost`, and `open` — meaning closed deals show with no color styling (the empty string fallback in `DEAL_STATUS_COLORS[deal.status] || ''`).

### 6. Other Write Paths
- `hubspot-contacts-sync/index.ts` — does NOT write to the deals table at all.
- `agencyBrain.ts` — only writes `status: 'open'` (line 670), which is valid.

## Recommendation

**Map HubSpot closed stages to semantic statuses (`won`, `lost`, `archived`)** instead of a blanket `"closed"`. This aligns the sync with the existing CHECK constraint and the frontend color mapping.

Specific mapping:
| HubSpot Stage Label Pattern | Status |
|---|---|
| "Closed: Won!" / "Closed: In Contract" / "Closed: Won" | `won` |
| "Closed: Lost" / "Closed: Declined" | `lost` |
| "Closed: Drip" / "Closed: Unresponsive" / "Closed: Unqualified" | `archived` |

Also:
- Add `"closed"` to the `DEAL_STATUS_COLORS` as a fallback (in case any `"closed"` values persist in DB from previous syncs)
- Update `fetchPipelineStats()` to query for `won`/`lost`/`archived` instead of `closed`
- Re-apply the CHECK constraint in production if it's been dropped, or create a new migration that sets the correct constraint

## Implementation Steps

- [ ] **Step 1: Add semantic outcome to pipeline stage definitions.** In `hubspot-deals-sync/index.ts`, add an `outcome` field to each closed stage: `outcome: 'won' | 'lost' | 'archived'`. Map: Won/In Contract → `won`, Lost/Declined → `lost`, Drip/Unresponsive/Unqualified → `archived`.
- [ ] **Step 2: Update status assignment.** Replace line 353 `status: closedStageIds.has(stageId) ? "closed" : "open"` with a lookup from a `stageOutcomeMap` that returns the semantic status.
- [ ] **Step 3: Update `fetchPipelineStats()`.** In `src/hooks/useCachedQueries.ts:442`, change `.eq('status', 'closed')` to `.in('status', ['won', 'lost', 'archived'])` (or `.neq('status', 'open')` for simplicity).
- [ ] **Step 4: Add `closed` to `DEAL_STATUS_COLORS`.** In `CompanyDetailPage.tsx:125` and `ContactDetailContent.tsx:54`, add `closed: 'bg-gray-500/15 text-gray-400'` as a fallback for any legacy `closed` values that haven't been re-synced yet.
- [ ] **Step 5: Verify/restore CHECK constraint in production.** Run `SELECT conname, consrc FROM pg_constraint WHERE conrelid = 'deals'::regclass;` to check current state. If missing, create a migration: `ALTER TABLE deals ADD CONSTRAINT deals_status_check CHECK (status IN ('open', 'won', 'lost', 'archived'));` — but only AFTER the sync has been redeployed and a full re-sync has been run.
- [ ] **Step 6: Re-sync deals.** After deploying the updated edge function, trigger a full `hubspot-deals-sync` to rewrite all deal statuses with the correct semantic values.

## Affected Files

- `supabase/functions/hubspot-deals-sync/index.ts` — Add `outcome` to stage definitions, build `stageOutcomeMap`, replace status assignment (lines 27-88, 353)
- `src/hooks/useCachedQueries.ts` — Change `.eq('status', 'closed')` to `.in('status', ['won', 'lost', 'archived'])` (line 442)
- `src/pages/CompanyDetailPage.tsx` — Add `closed` fallback to `DEAL_STATUS_COLORS` (line 125)
- `src/components/contacts/ContactDetailContent.tsx` — Add `closed` fallback to `DEAL_STATUS_COLORS` (line 54)
- New migration file — restore CHECK constraint (only after re-sync)

## Dependencies

- Must deploy updated `hubspot-deals-sync` edge function BEFORE restoring the CHECK constraint
- Must run a full deal re-sync BEFORE the constraint migration, otherwise existing `"closed"` rows will block the constraint
- The delete-all-then-insert pattern (Task #3) means a re-sync will naturally replace all old values

## Risks

- **Data loss during re-sync window:** The current sync deletes all deals then re-inserts. If the function crashes mid-sync after the delete, all deals are temporarily gone. This is an existing risk (Task #3), not introduced by this change.
- **Missed stage mapping:** If HubSpot stages are added in the future, they won't have an outcome mapping and will fall back to `"open"` (the default). The sync should log a warning for unmapped closed stages.
- **Legacy `closed` values in DB:** Between deploy and re-sync, some deals may still have `status: 'closed'`. The frontend fallback (Step 4) handles this gracefully. The constraint migration (Step 5) must happen AFTER re-sync.
