# Company Data Cleanup System -- Implementation Plan

## Overview

Build a 4-phase wizard-style cleanup page at `/companies/cleanup` that systematically resolves data quality issues in the 1,287-row `companies` table. Each phase surfaces problems, lets the user review, then executes fixes.

---

## Architecture Decisions

1. **No TanStack Query** -- the codebase does not use `useQuery` anywhere in pages. All pages use `useState` + `useEffect` with direct `supabase` calls. This plan follows that established pattern.
2. **Edge functions** for server-side logic (merging, domain validation, bulk enrichment). Client-side for read-only analysis (duplicate detection, fuzzy matching) since the full dataset is only ~1,287 rows and already loaded client-side in CompaniesPage.
3. **Stepper UI** built from scratch using custom step indicators with existing Tailwind + shadcn patterns. No external stepper library needed.
4. **Preview-then-execute** pattern matches the existing `global-sync` approach (`action: 'preview'` vs `action: 'sync'`).

---

## 1. Database Migration

**File:** `supabase/migrations/YYYYMMDD000001_company_cleanup_log.sql`

Creates an audit log for all cleanup operations (merges, links, archives, enrichments). No schema changes to the `companies` table itself -- all existing columns are sufficient. The cleanup log provides audit trail and potential undo capability.

Columns: id, user_id, phase, action, source_company_id, target_company_id, details (JSONB), created_at. RLS scoped to user.

---

## 2. File Structure

### New Files to Create

```
src/lib/companyNormalization.ts               -- Client-side ports of normalizeDomain, normalizeCompanyName, similarity scorer
src/pages/CompanyCleanupPage.tsx              -- Main page with stepper
src/components/company/cleanup/
  CleanupStepper.tsx                          -- Horizontal 4-step indicator
  Phase1Deduplicate.tsx                       -- Duplicate detection and merge UI
  Phase2MatchLink.tsx                         -- Unlinked Harvest/Asana matching UI
  Phase3Validate.tsx                          -- Domain validation and triage UI
  Phase4Enrich.tsx                            -- Enrichment and normalization UI
  DuplicateReviewTable.tsx                    -- Table for reviewing duplicate pairs
  MatchReviewTable.tsx                        -- Table for reviewing match suggestions
  ValidationResultsTable.tsx                  -- Table for triage results
  MergePreviewDialog.tsx                      -- Dialog showing merge preview before execution
  useCleanupAnalysis.ts                       -- Hook: loads companies and runs client-side analysis
supabase/functions/company-cleanup/index.ts   -- Edge function for server-side cleanup operations
supabase/migrations/YYYYMMDD000001_company_cleanup_log.sql
```

### Files to Modify

```
src/App.tsx                                   -- Add /companies/cleanup route (1 line + import)
src/pages/CompaniesPage.tsx                   -- Add "Cleanup" button in toolbar (3-5 lines)
```

---

## 3. Component Hierarchy

```
CompanyCleanupPage
  AppHeader
  CleanupStepper (phase: 1|2|3|4, status per phase)
  [Conditionally rendered based on active phase:]
  Phase1Deduplicate
    Summary card (X exact name dupes, Y domain dupes found)
    DuplicateReviewTable
      Per pair: keep/merge preview, approve/skip
    MergePreviewDialog (triggered per pair)
    "Execute Approved Merges" button
  Phase2MatchLink
    Summary card (X unlinked Harvest, Y unlinked Asana)
    Tabs: "Harvest" | "Asana"
    MatchReviewTable
      Per unlinked record: suggested matches with confidence, approve/reject
    "Execute Approved Links" button
  Phase3Validate
    Summary card (X valid, Y suspect, Z dead)
    Tabs: "Valid" | "Suspect" | "Dead"
    ValidationResultsTable
    Bulk action buttons ("Archive all Dead", "Archive all Suspect")
  Phase4Enrich
    Summary card (X URL-as-name, Y missing enrichment)
    Cost estimate
    Action buttons with progress bars
```

---

## 4. Detailed Component Specifications

### 4.1 CompanyCleanupPage.tsx

State management:
- `phase`: number 1-4
- `phaseStatus`: Record<1|2|3|4, 'pending'|'active'|'complete'|'skipped'>
- Companies loaded once via `useCleanupAnalysis` hook, shared to all phase components

Layout follows CompaniesPage pattern: `AppHeader` at top, content with `max-w-7xl mx-auto` padding. Back button linking to `/companies`.

### 4.2 CleanupStepper.tsx

Horizontal 4-step indicator:
- Steps: "Deduplicate" / "Match & Link" / "Validate" / "Enrich"  
- Icons: Layers, Link2, Shield, Sparkles (from lucide-react)
- States: pending (muted), active (primary ring), complete (green check), skipped (dashed)
- Each step shows count of items found in that phase
- Clicking a completed step allows revisiting

### 4.3 useCleanupAnalysis.ts

Custom hook that:
1. Fetches all companies using the same pagination pattern from CompaniesPage (lines 404-456)
2. Runs client-side analysis:
   - **Duplicate detection:** Group by `normalizeCompanyName(name)` -- groups of 2+ are name dupes. Group by normalized `domain` -- groups of 2+ are domain dupes.
   - **Unlinked identification:** Companies with `harvest_client_id` but no `hubspot_company_id` (or vice versa). Companies with Harvest data but no link to an existing HubSpot company.
   - **URL-as-name detection:** Companies where `name` matches `/^[a-z0-9.-]+\.[a-z]{2,}$/i`
   - **Missing enrichment:** Companies where `enrichment_data` is empty/null AND `domain` exists AND status is not archived
3. Returns: `{ duplicates, unlinkedHarvest, unlinkedAsana, urlAsNameCompanies, unenrichedCompanies, loading, refetch }`

### 4.4 src/lib/companyNormalization.ts

Port the following from `supabase/functions/global-sync/index.ts` to client-side TypeScript:
- `normalizeDomain(input)` -- strip protocol, www, trailing slash, lowercase
- `normalizeCompanyName(name)` -- strip suffixes (Inc, LLC, etc), lowercase, remove special chars
- New: `computeSimilarity(a, b)` -- Jaro-Winkler string similarity returning 0-1 score
- New: `looksLikeDomain(name)` -- returns true if name looks like a domain/URL
- New: `findBestMatch(company, candidates)` -- returns best match with confidence score

### 4.5 Phase1Deduplicate.tsx

**Detection (client-side via useCleanupAnalysis):**
- For each duplicate group, compute a "keep" recommendation:
  - Count cross-system IDs (hubspot_company_id, harvest_client_id, asana_project_gids length)
  - Prefer the record with more IDs; tie-break by most recent `updated_at`
  - The other record is the "merge source"

**UI:**
- Summary Card: "Found 46 duplicate pairs (42 by name, 4 by domain)"
- DuplicateReviewTable with columns: Pair #, Company A (with source badges), Company B (with source badges), Recommended Keep, Action
- Each row has "Preview Merge" button opening MergePreviewDialog
- Batch select via checkboxes, "Approve Selected" and "Execute Approved Merges" buttons
- Execution progress shown via Progress component

**MergePreviewDialog:**
- Two-column layout: "Will Keep" vs "Will Merge In"
- Shows which fields come from which record
- Shows the final merged result
- "Confirm Merge" / "Cancel" buttons

**Execution:**
- Calls `company-cleanup` edge function with `action: 'merge'`
- Processes sequentially to avoid conflicts
- Shows toast per merge result
- Refetches companies when done

### 4.6 Phase2MatchLink.tsx

**Matching tiers (client-side):**
1. **Exact domain match** (confidence: 95%): Unlinked company's domain === HubSpot company's domain (after normalization)
2. **Normalized domain match** (confidence: 90%): Strip www, compare
3. **Fuzzy name match** (confidence: similarity * 100): `computeSimilarity(normalizeCompanyName(a), normalizeCompanyName(b))` > 0.8

With ~1,287 companies, the O(n*m) comparison (232 unlinked * 1040 HubSpot) is ~240K comparisons -- trivial for client-side.

**UI:**
- Two tabs: "Harvest (232)" and "Asana (77)"
- MatchReviewTable columns: Unlinked Company, Sources, Best Match, Confidence, Action
- Confidence badge colors: green (>90%), yellow (70-90%), red (<70%), gray (no match found)
- Batch approve for high-confidence (>90%) matches
- "No Match" button marks as reviewed-and-skipped

**Execution:**
- Calls `company-cleanup` edge function with `action: 'link'`
- Merges the unlinked company's IDs into the matched company
- Optionally deletes the now-redundant record (or keeps both with a note)

### 4.7 Phase3Validate.tsx

**Detection (edge function -- requires DNS resolution):**
- Calls `company-cleanup` edge function with `action: 'validate'`
- Classification logic:
  - **Valid**: has domain AND (domain resolves OR has harvest_client_id OR has asana_project_gids with entries)
  - **Suspect**: no domain, no Harvest/Asana links, HubSpot-only record
  - **Dead**: has domain but domain does not resolve AND no active cross-system links
- DNS check: `fetch('https://{domain}', { method: 'HEAD', redirect: 'follow' })` with 5s timeout, fallback to `http://`

**Batching for edge function timeout:**
- Process 20 companies per invocation (parallel fetch with 5s timeout each)
- Client orchestrates: calls edge function repeatedly with batches of company IDs
- Shows progress bar: "Validating 50 of 231 domains..."

**UI:**
- Three tab sections with counts in badges
- ValidationResultsTable: Company name, Domain, Sources, Classification, Reason, Override button
- Bulk actions: "Archive All Dead (133)", "Archive All Suspect (312)" with confirmation dialog
- Individual reclassify dropdown per row

**Execution:**
- Calls `company-cleanup` edge function with `action: 'bulk_archive'`
- Sets `status = 'archived'` for selected company IDs
- Logs each archival to `company_cleanup_log`

### 4.8 Phase4Enrich.tsx

**Detection (client-side):**
- URL-as-name: `looksLikeDomain(company.name)` returns true
- Missing enrichment: `enrichment_data` is null/empty AND domain exists AND status !== 'archived'

**UI:**
- Two sections:
  1. "Fix Company Names (221)" -- companies where name IS the domain
     - Shows current name and suggested fix (from existing enrichment_data.ocean.companyName if available)
     - "Auto-fix from existing data" button for companies that already have enrichment
     - "Enrich to get names" for the rest
  2. "Bulk Enrichment (N)" -- companies needing Ocean.io data
     - Cost estimate based on count
     - "Start Enrichment" button
     - Progress bar during execution
  3. "Normalize Domains" -- lowercase, strip www for all companies
     - Preview of changes
     - "Normalize All" button

**Execution:**
- URL-name fix: direct Supabase update for companies with existing enrichment data
- Bulk enrichment: reuses existing `ocean-enrich` edge function, processes 5 at a time
- Domain normalization: calls `company-cleanup` edge function with `action: 'normalize_domains'`

---

## 5. Edge Function: company-cleanup/index.ts

**Location:** `supabase/functions/company-cleanup/index.ts`

**Actions supported:**

| Action | Purpose | Server-side because |
|--------|---------|-------------------|
| `merge` | Merge duplicate companies | Needs service role for FK updates across tables |
| `link` | Link unlinked company to matched company | Needs service role for cross-table updates |
| `validate` | DNS resolution for domains | Deno fetch required, not available client-side |
| `bulk_archive` | Archive companies in bulk | Simple but benefits from atomic transaction |
| `normalize_domains` | Normalize all domain values | Bulk update |
| `fix_url_names` | Replace URL-as-name with real names from enrichment_data | Bulk update |

**Merge implementation detail:**
1. Load both records with service role key
2. Compute merged record (keep record's values win conflicts, merge nulls from source)
3. For IDs: if keep has no harvest_client_id but source does, copy it over. Same for hubspot_company_id, asana_project_gids (merge arrays).
4. Update FK references: `contacts.company_id`, `deals.company_id`, `engagements.company_id`, `crawl_sessions.company_id`
5. Delete source record
6. Insert cleanup log entry with full details (both original records in JSONB for audit)

**Validate implementation detail:**
- Receives batch of company IDs (max 20 per call)
- Fetches company records
- For each with a domain: parallel HEAD requests with AbortController timeout (5s)
- Returns array: `[{ id, domain, classification, reason }]`
- Client calls this repeatedly for the full set

---

## 6. Implementation Order

### Sprint 1: Foundation + Phase 1 (Deduplicate) -- Priority

1. `src/lib/companyNormalization.ts` -- port normalize functions, add similarity scorer
2. Migration: `company_cleanup_log` table
3. `src/components/company/cleanup/useCleanupAnalysis.ts` -- data loading + analysis hook
4. `src/components/company/cleanup/CleanupStepper.tsx` -- step UI
5. `src/pages/CompanyCleanupPage.tsx` -- main page shell
6. `src/App.tsx` -- add route
7. `src/pages/CompaniesPage.tsx` -- add Cleanup button
8. `src/components/company/cleanup/DuplicateReviewTable.tsx`
9. `src/components/company/cleanup/MergePreviewDialog.tsx`
10. `src/components/company/cleanup/Phase1Deduplicate.tsx`
11. `supabase/functions/company-cleanup/index.ts` -- merge action only
12. Test end-to-end

### Sprint 2: Phase 2 (Match & Link)

1. Extend `useCleanupAnalysis.ts` with fuzzy matching
2. `src/components/company/cleanup/MatchReviewTable.tsx`
3. `src/components/company/cleanup/Phase2MatchLink.tsx`
4. Add `link` action to `company-cleanup` edge function
5. Test linking flow

### Sprint 3: Phase 3 (Validate)

1. Add `validate` and `bulk_archive` actions to `company-cleanup` edge function
2. `src/components/company/cleanup/ValidationResultsTable.tsx`
3. `src/components/company/cleanup/Phase3Validate.tsx`
4. Test validation and archival flow

### Sprint 4: Phase 4 (Enrich) -- Can defer

1. `src/components/company/cleanup/Phase4Enrich.tsx`
2. Add `fix_url_names` and `normalize_domains` actions to edge function
3. Integrate with existing `ocean-enrich` edge function
4. Add progress tracking

---

## 7. Key Codebase Patterns to Follow

| Pattern | Source Reference | How to Apply |
|---------|-----------------|-------------|
| Data fetching | CompaniesPage.tsx lines 404-456 | `useState` + `useEffect` + `supabase.from().select()` with pagination |
| Edge function calls | ConnectionsPage.tsx line 520 | `fetch(VITE_SUPABASE_URL + '/functions/v1/company-cleanup', ...)` |
| Toasts | ConnectionsPage.tsx lines 531-534 | `toast.success()` / `toast.error()` from sonner |
| Tables | CompaniesPage.tsx | shadcn Table/TableHeader/TableBody/TableRow/TableCell |
| Badges | CompaniesPage.tsx lines 100-118 | STATUS_COLORS and SOURCE_BADGE_STYLES patterns |
| Dialogs | shadcn Dialog component | For merge preview |
| Progress | GlobalProgressBar.tsx | For bulk operation progress |
| Page layout | CompaniesPage.tsx | AppHeader + content area |
| Company type | CompaniesPage.tsx lines 59-78 | Reuse same Company type definition |

---

## 8. Route Addition Detail

In `src/App.tsx`, add BEFORE the `/companies/:id` route (line 86) to prevent "cleanup" from matching as an `:id`:

```
<Route path="/companies/cleanup" element={<ProtectedRoute><CompanyCleanupPage /></ProtectedRoute>} />
```

---

## 9. Risk Mitigations

1. **Merge is destructive** -- MergePreviewDialog shows exactly what will happen. Cleanup log stores both original records in JSONB for potential recovery. Consider soft-delete (archive) the loser initially instead of hard delete.
2. **Edge function timeouts (60s)** -- DNS validation batches limited to 20 domains per invocation. Client orchestrates multiple calls with progress tracking.
3. **Ocean.io rate limits** -- Existing `fetchWithRetry` in `ocean-enrich` handles 429s. Bulk enrichment processes 5 at a time with 2s delays between batches.
4. **RLS** -- Edge function uses service role key for cross-table FK updates during merges. All cleanup log writes go through client with user's auth token.
5. **Concurrent edits** -- If another user modifies a company during cleanup, the edge function should check `updated_at` hasn't changed before executing (optimistic locking).
