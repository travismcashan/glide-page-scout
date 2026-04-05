# Plan: Add transaction safety to sync functions

## Research Findings

### 1. hubspot-deals-sync — Operation Sequence & Blast Radius

**Current flow (post-Task #3 upsert refactor):**

| Step | Operation | Blast Radius if Fails | Recovery |
|---|---|---|---|
| 1 | Fetch all deals from HubSpot (3 pipelines) | None — read-only | Retry function |
| 2 | Batch-fetch company associations | None — read-only | Retry function |
| 3 | Batch-fetch contact associations + details | None — read-only | Retry function |
| 4 | Map HubSpot company IDs → local IDs | Read from companies table | Retry function |
| 4b | resolveCompany() for unmatched companies | **Creates companies** — partial creation if crash mid-loop | Orphaned companies with no deals. Idempotent on retry (domain/ID match) |
| 4c | Upsert deal contacts into contacts table | **Creates/updates contacts** — partial if crash | Idempotent (hubspot_contact_id upsert). No data loss. |
| 5 | Fetch owners | None — read-only | Retry |
| 6 | **Upsert deals** (batches of 100) | **Partial upsert** — some batches written, some not. Better than old delete-all. | Idempotent on retry (hubspot_deal_id conflict). Worst case: stale data on un-upserted deals. |
| 6b | **Delete stale deals** (not in HubSpot anymore) | **Premature deletion** if Step 6 failed silently (partial upsert = some deals look "stale" because they weren't upserted yet) | **DANGER**: If upsert partially fails, stale-detection sees un-upserted deals as stale and deletes them. This is the #1 risk. |
| 7 | Auto-enrich + auto-crawl | Side effects (triggers other functions) | Fire-and-forget, acceptable |
| 8 | Summary query | None — read-only | N/A |

**Key risk:** Step 6b (stale deletion) can incorrectly delete deals if Step 6 (upsert) partially failed. The `fetchedHsDealIds` set contains all fetched deals, but if some batches failed to upsert, those deals would be missing from DB and NOT detected as stale (they're in the fetched set). Actually wait — the stale detection compares `localDeals` against `fetchedHsDealIds`, so deals that failed to upsert would NOT be in local DB but WOULD be in the fetched set, meaning they'd correctly not be marked stale. The real risk is: deals that HubSpot returned but Supabase rejected (e.g., constraint violation) would never land in DB but also wouldn't be detected as stale. Not a data-loss issue, but a silent gap.

**Revised risk assessment:** With the upsert refactor, deals-sync is actually fairly safe now. The main gap is **no error aggregation** — if 3 out of 12 batches fail, the function still returns 200 with `deals_skipped: 300`. There's no mechanism to retry just the failed batches.

### 2. hubspot-contacts-sync — Operation Sequence & Blast Radius

**Current flow (also upsert-based):**

| Step | Operation | Blast Radius if Fails | Recovery |
|---|---|---|---|
| 1 | Fetch contacts by lead status | None — read-only | Retry |
| 2 | Batch-fetch company associations | None — read-only | Retry |
| 3 | Map + resolve companies | **Creates companies** — idempotent via resolveCompany() | Safe |
| 4 | Fetch owners | None — read-only | Retry |
| 5 | Fetch contact photos | None — read-only | Retry |
| 6 | **Upsert contacts** (batches of 100) | Partial upsert — some batches written, some not | Idempotent on retry |
| 6b | **Delete stale lead contacts** | Same pattern as deals — compares local vs fetched. Scoped to lead contacts only (has `lead_status` filter). | Same risk assessment: if upsert partially failed, stale contacts wouldn't be incorrectly deleted (they're in fetchedHsContactIds set). |
| 7 | Auto-enrich + auto-crawl | Side effects — fire-and-forget | Acceptable |

**Risk level: LOW.** Contacts-sync is structurally identical to deals-sync post-refactor. Upserts are idempotent. Stale deletion is correctly scoped.

### 3. global-sync — Operation Sequence & Blast Radius

**Current flow:**

| Step | Operation | Blast Radius | Recovery |
|---|---|---|---|
| 1 | Fetch from 4 APIs (Harvest, Asana, HubSpot, Freshdesk) in parallel | None — read-only | Retry |
| 2 | Load all existing companies | None — read-only | Retry |
| 3 | Cross-reference to build unified list | None — in-memory | Retry |
| 4 | For each unified client: insert/update company + store raw source data | **Individual updates** — each company is independent. Crash loses remaining companies. | Re-run function — idempotent (domain/name matching). |

**Risk level: LOW.** Each company is processed independently. No delete step. Crash loses in-progress work but doesn't corrupt existing data. Re-running is safe.

### 4. enrich-contacts / enrich-companies

**Current flow (both identical pattern):**
- Query for un-enriched records
- Loop through each, call external API, update record
- Each iteration is independent

**Risk level: VERY LOW.** Each enrichment is a single record update. No batch operations, no deletions. Crash just means fewer records enriched. Idempotent (checks `apollo_person_id IS NULL` or `ocean.enriched_at` missing).

### 5. Can Supabase Edge Functions Use Transactions?

**Short answer: No native transaction support via the JS client.**

The Supabase JS client (`@supabase/supabase-js`) does not expose `BEGIN/COMMIT/ROLLBACK`. Each `.insert()`, `.upsert()`, `.update()`, `.delete()` is an independent HTTP request to PostgREST.

**Workaround options:**

1. **`supabase.rpc()` with a plpgsql function** — Wrap multiple operations in a single database function that runs in a transaction. The function executes server-side with full transaction semantics. This is the only way to get true atomicity.
   - **Pros:** Real ACID transactions, rollback on failure
   - **Cons:** Complex to implement (must pass all data as JSON args), harder to debug, plpgsql is less flexible than TypeScript for complex logic
   - **Best for:** Critical atomic operations (e.g., "delete old + insert new" that must be all-or-nothing)

2. **Idempotent checkpoint-based recovery** — Each step checks if it already ran. On retry, previously-completed steps are skipped.
   - **Pros:** Simple, works with existing JS client, naturally handles partial failures
   - **Cons:** Not truly atomic (brief inconsistency window), requires tracking state
   - **Best for:** Long-running multi-step operations where the steps are independent

3. **Compensating actions** — After failure, undo partial changes.
   - **Pros:** Can handle complex scenarios
   - **Cons:** Hard to get right, doubles the code
   - **Not recommended** for this use case

### 6. Assessment: What Actually Needs Fixing?

With the Task #3 upsert refactor already done, the sync functions are **significantly safer** than they were. The original delete-all-then-insert pattern was the #1 risk, and it's been eliminated.

**Remaining risks ranked:**

1. **Partial batch failure with no retry** (Medium) — If 3 out of 12 upsert batches fail, we log it but don't retry. Those 300 records are silently skipped until next full sync.

2. **Stale deletion after partial upsert** (Low) — Theoretically possible but analysis shows the current logic handles it correctly. The fetched ID set is built from HubSpot response (not from what was successfully upserted), so stale detection won't incorrectly delete records.

3. **Side effect ordering** (Low) — Auto-enrich and auto-crawl fire before the summary, but they're fire-and-forget with error catching. No blast radius.

4. **No operation logging** (Low) — No persistent record of what was synced, when, and what failed. Debugging requires reading edge function logs.

## Recommendation

**Approach: Idempotent operations + batch retry + sync audit log.** NOT full transactions.

Rationale:
- The upsert refactor (Task #3) already eliminated the catastrophic failure mode
- plpgsql transactions are overkill — the operations are already idempotent
- The remaining risks are about **completeness** (did everything sync?) not **correctness** (is the data wrong?)
- A sync audit log solves observability without adding complexity

### What to build:

1. **Batch retry with backoff** — When an upsert batch fails, retry it once after 2s. Only after the retry fails, log it as skipped.

2. **Guard stale deletion** — Only run stale deletion if ALL upsert batches succeeded (`skipped === 0`). If any batch failed, skip stale deletion and log a warning. This prevents the theoretical edge case.

3. **Sync audit log table** — `sync_runs` table tracking: function name, started_at, completed_at, status (running/completed/failed/partial), records_fetched, records_synced, records_skipped, records_deleted, error_details JSONB.

4. **Apply to all sync functions** — deals-sync, contacts-sync, global-sync. Enrichment functions don't need it (already safe by design).

## Implementation Steps

- [ ] **Step 1: Create `sync_runs` table** via migration. Columns: id, function_name, user_id, started_at, completed_at, status, records_fetched, records_synced, records_skipped, records_deleted, error_details JSONB, metadata JSONB.
- [ ] **Step 2: Create `_shared/sync-logger.ts`** utility. Functions: `startSyncRun()`, `completeSyncRun()`, `failSyncRun()`. Used by all sync functions.
- [ ] **Step 3: Add batch retry to hubspot-deals-sync.** Wrap the upsert loop: on failure, wait 2s, retry once. Guard stale deletion behind `skipped === 0` check.
- [ ] **Step 4: Add batch retry to hubspot-contacts-sync.** Same pattern as Step 3.
- [ ] **Step 5: Add sync logging to hubspot-deals-sync.** Call `startSyncRun()` at entry, `completeSyncRun()` at success, `failSyncRun()` on catch.
- [ ] **Step 6: Add sync logging to hubspot-contacts-sync.** Same pattern.
- [ ] **Step 7: Add sync logging to global-sync.** Same pattern (no batch retry needed — individual company processing).
- [ ] **Step 8: Frontend sync history.** Add a "Sync History" section to the Connections/Settings page showing recent sync_runs with status badges.

## Affected Files

- New migration: `supabase/migrations/YYYYMMDD_sync_runs_table.sql` — create sync_runs table + RLS
- New shared: `supabase/functions/_shared/sync-logger.ts` — sync run CRUD helpers
- `supabase/functions/hubspot-deals-sync/index.ts` — batch retry + stale guard + sync logging
- `supabase/functions/hubspot-contacts-sync/index.ts` — batch retry + stale guard + sync logging
- `supabase/functions/global-sync/index.ts` — sync logging only
- Frontend (optional): Settings/Connections page — sync history display

## Dependencies

- Task #3 (upsert refactor) must be complete — **it is** (verified: deals-sync now uses upsert + stale deletion)
- Contacts-sync also uses upsert (verified in Step 6, line 205)
- Global-sync uses individual insert/update (no batch, no deletion) — already safe

## Risks

1. **sync_runs table growth** — Could accumulate thousands of rows if syncs run frequently (especially if pg_cron is added per Task #7/#8). Add a retention policy: delete runs older than 90 days.
2. **Batch retry masking real errors** — If a batch consistently fails (e.g., constraint violation), retrying won't help. The error_details JSONB should capture the specific Supabase error for each failed batch.
3. **Stale deletion guard could accumulate stale records** — If upsert batches fail repeatedly, stale deletion never runs, and deleted-in-HubSpot deals accumulate. The sync audit log makes this visible so it can be manually resolved.
