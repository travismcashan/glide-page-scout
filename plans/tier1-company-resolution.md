# Plan: Strengthen company-resolution with all external IDs

## Research Findings

### 1. Current `resolveCompany()` Matching Logic

File: `supabase/functions/_shared/company-resolution.ts` (lines 140-213)

**Matching cascade (2 steps only):**
1. `hubspot_company_id` → exact match on `companies.hubspot_company_id`
2. `domain` → exact match on `companies.domain`
3. If neither matches → **create new company**

**Missing:** No matching on `harvest_client_id`, `freshdesk_company_id`, or normalized name. No fuzzy matching at all.

### 2. External ID Columns on Companies Table

From global-sync queries (line 556) and the production schema:

| Column | Source | Indexed? | In Types File? |
|---|---|---|---|
| `hubspot_company_id` | HubSpot | Yes (migration) | Yes |
| `harvest_client_id` | Harvest | Unknown | **No** (added via dashboard) |
| `harvest_client_name` | Harvest | No | **No** |
| `freshdesk_company_id` | Freshdesk | Unknown | **No** |
| `freshdesk_company_name` | Freshdesk | No | **No** |
| `asana_project_gids` | Asana | No | **No** |

**5 out of 6 external columns are missing from the migration schema.** They were added via Supabase dashboard. This means they lack indexes and aren't in the TypeScript types.

### 3. Who Calls `resolveCompany()`?

| Caller | What it passes | Gap |
|---|---|---|
| `hubspot-deals-sync` (line 238) | `hubspot_company_id`, name, domain, industry, employee_count, location, website | Only passes HubSpot data — can't match Harvest/Freshdesk |
| `hubspot-contacts-sync` (line 131) | Same as above | Same gap |

**Neither caller has access to Harvest/Freshdesk IDs** (they're HubSpot sync functions), but the resolution layer could still match by domain or normalized name to find companies that were previously created by global-sync with those external IDs.

### 4. Global-Sync's Separate Matching System

`global-sync/index.ts` has its own `crossReference()` function (lines 270-441) with a **completely different matching algorithm**:

**Global-sync cascade:**
1. HubSpot pass: domain → hubspot_company_id → normalized name
2. Harvest pass: harvest_client_id → domain extraction from name → normalized name → unified map
3. Asana pass: domain match → client name match (no company creation for unmatched)
4. Freshdesk pass: freshdesk_company_id → domain (multiple) → normalized name

**Key difference:** Global-sync matches across ALL sources in a single pass with a unified in-memory map. `resolveCompany()` is called per-company with only one source's data.

**This means two parallel matching systems exist:**
- `resolveCompany()` — used by HubSpot sync functions. Only HubSpot ID + domain.
- `crossReference()` — used by global-sync. All 4 sources with name matching.

Companies created by global-sync (with harvest/freshdesk IDs) can't be found by `resolveCompany()` unless they have a domain match — leading to **duplicates**.

### 5. `company-match-ai` — AI Fuzzy Matching

A third matching system exists: `company-match-ai/index.ts` uses Claude Haiku to fuzzy-match company names across sources. It handles abbreviations, legal suffixes, word variations, and domain matching.

**Status:** Deployed but not wired into any automated pipeline (per CLAUDE.md: "deployed but not wired into Phase0Map UI").

### 6. Duplicate Risk Assessment

**Scenario 1: HubSpot company without domain**
- Global-sync creates company with `harvest_client_id` and `freshdesk_company_id`
- HubSpot-deals-sync runs, finds a deal for same company
- `resolveCompany()` checks `hubspot_company_id` → no match (global-sync didn't set it)
- Checks `domain` → no match (company has no domain, or HubSpot has a different domain)
- Creates a duplicate

**Scenario 2: Name variation**
- Global-sync creates "Acme Corporation" from Harvest
- HubSpot has "Acme Corp" (abbreviated name, same company)
- `resolveCompany()` → no hubspot_company_id match, no domain match → creates duplicate "Acme Corp"

**Scenario 3: Domain mismatch**
- Harvest has "Acme" with no domain
- HubSpot has "Acme Corp" with domain "acme.com"
- Global-sync creates company without domain
- HubSpot sync creates second company with domain
- Two companies, same real entity

### 7. Current `CompanyCandidate` Interface

Only accepts:
```ts
hubspot_company_id, domain, name, industry, employee_count,
annual_revenue, location, website_url, status, user_id
```

No fields for `harvest_client_id`, `freshdesk_company_id`, or `asana_project_gids`.

## Recommendation

**Extend `resolveCompany()` to be the single matching authority for ALL sync functions**, including global-sync. The matching cascade should check all external IDs, then domain, then normalized name. Global-sync should migrate to use `resolveCompany()` instead of its own `crossReference()`.

### Extended Matching Cascade (5 steps):

```
1. hubspot_company_id    → exact match
2. harvest_client_id     → exact match
3. freshdesk_company_id  → exact match
4. domain                → exact normalized match
5. normalized name       → exact match on normalizeCompanyName()
6. No match              → create new company
```

Each step that matches should **opportunistically link** the other external IDs. For example, if a company matches by domain, also set its `hubspot_company_id` if the candidate has one and the existing record doesn't.

### Name matching considerations:
- `normalizeCompanyName()` already strips legal suffixes (Inc, LLC, Corp, etc.), lowercases, and removes punctuation
- This handles "Acme Corp" vs "Acme Corporation" vs "Acme, Inc."
- **NOT** fuzzy — won't catch typos, abbreviations, or completely different names for the same entity
- Fuzzy/AI matching (`company-match-ai`) should remain a separate opt-in tool, not part of the hot path

## Implementation Steps

### Phase 1: Schema — add missing columns to migration
- [ ] **Step 1:** Create migration adding `harvest_client_id TEXT`, `freshdesk_company_id TEXT`, `harvest_client_name TEXT`, `freshdesk_company_name TEXT`, `asana_project_gids TEXT[]`, `last_synced_at TIMESTAMPTZ` to companies table (with `IF NOT EXISTS` safety for columns that may already exist in production).
- [ ] **Step 2:** Add indexes on `harvest_client_id` and `freshdesk_company_id` for lookup performance.

### Phase 2: Extend CompanyCandidate interface
- [ ] **Step 3:** Add optional fields to `CompanyCandidate`: `harvest_client_id`, `freshdesk_company_id`, `harvest_client_name`, `freshdesk_company_name`, `asana_project_gids`.
- [ ] **Step 4:** Add `"harvest_id" | "freshdesk_id" | "name"` to the `ResolvedCompany.matchType` union.

### Phase 3: Extend resolveCompany() matching cascade
- [ ] **Step 5:** Add Step 2 (harvest_client_id lookup) and Step 3 (freshdesk_company_id lookup) between the existing hubspot_company_id and domain steps.
- [ ] **Step 6:** Add Step 5 (normalized name match) after domain match. Use `normalizeCompanyName()` on both the candidate name and DB names. Query approach: fetch candidate companies by user_id, normalize in JS. (Can't easily do case-insensitive suffix-stripped matching in SQL.)
- [ ] **Step 7:** In each match step, opportunistically link ALL external IDs from the candidate to the matched company (similar to how domain match currently links `hubspot_company_id`).

### Phase 4: Migrate global-sync to use resolveCompany()
- [ ] **Step 8:** Refactor global-sync's sync loop to call `resolveCompany()` for each unified client instead of using the `crossReference()` + inline insert/update logic. Pass all available external IDs.
- [ ] **Step 9:** Keep `crossReference()` for preview mode only (it doesn't write to DB, just builds the unified map for display). Remove the duplicated insert/update logic in sync mode.

### Phase 5: Name matching guard — prevent normalized-name duplicates
- [ ] **Step 10:** After Step 6 (name match), add a confidence check: if the normalized name matches but the domains are DIFFERENT (both non-null, both valid, but different), do NOT match — create a new company instead. Different domains = different companies even with the same name.

## Affected Files

- New migration: `supabase/migrations/YYYYMMDD_company_external_ids.sql` — add columns + indexes
- `supabase/functions/_shared/company-resolution.ts` — extend interface + matching cascade (core change)
- `supabase/functions/global-sync/index.ts` — refactor sync mode to use `resolveCompany()` (Phase 4)
- No changes to `hubspot-deals-sync` or `hubspot-contacts-sync` — they already call `resolveCompany()`, which will gain the new matching steps automatically

## Dependencies

- Task #4 (type regeneration) should run after this migration to capture the new columns
- The existing `harvest_client_id` / `freshdesk_company_id` columns in production should be preserved (migration uses `ADD COLUMN IF NOT EXISTS`)

## Risks

1. **False positive name matches** — "Acme" the software company vs "Acme" the restaurant. Mitigated by Step 10 (different domain = no match) and by only matching on exact normalized name (not fuzzy).
2. **Name match performance** — Step 6 requires loading companies by user_id and comparing names in JS. For 2,100+ companies, this could be slow. Mitigation: add a `name_normalized` generated column + index, or use `LOWER(name)` index for SQL-side matching.
3. **Global-sync refactor scope** — Phase 4 is a significant refactor of global-sync. The preview mode must still work (showing what would happen without writing). Keep `crossReference()` for preview, use `resolveCompany()` for sync.
4. **Opportunistic linking race condition** — If two sync functions run concurrently and both try to link the same external ID to the same company, one update will silently overwrite the other. Not a data loss risk (both should link the same value), but could cause confusion in logs.
5. **Existing duplicates** — This plan prevents NEW duplicates but doesn't clean up EXISTING ones. A separate dedup pass should be planned (could leverage `company-match-ai` for fuzzy matching on existing data).
