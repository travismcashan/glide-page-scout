# Backfill Engine — Universal Company Import

## Context

Companies currently only enter the system via integration syncs (HubSpot, Harvest, Asana). There's no way to bulk-import from a spreadsheet, PDF, or URL. The Backfill Engine adds a universal ingest pipeline: drop any file → AI extracts company data → match against existing records → preview → commit.

## Pipeline (5 steps)

```
File Upload → Parse → AI Extract → Match & Diff → Preview → Commit
```

## What We're Building

### 1. Database: `import_jobs` table (new migration)

Tracks each import session. Extracted data and match results live as JSONB — no staging table needed.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| user_id | UUID FK | RLS scoping |
| source_type | TEXT | csv, xlsx, pdf, url, text |
| source_name | TEXT | Original filename or URL |
| status | TEXT | pending → extracting → preview → committing → complete / error |
| extracted_data | JSONB | AI-extracted company array |
| match_results | JSONB | Matched/diffed results with actions |
| commit_summary | JSONB | Final counts (created, updated, skipped, errors) |
| created_at | TIMESTAMPTZ | |

RLS: user-scoped read/write + service_role policy (same pattern as all other tables).

### 2. Shared Utilities: `supabase/functions/_shared/normalize.ts` (new file)

Extract from `global-sync/index.ts` (lines 15-40):
- `normalizeDomain()`
- `normalizeCompanyName()`
- `extractDomainFromText()`

Both `global-sync` and the new backfill functions import from here. No behavior change.

### 3. Edge Function: `backfill-extract` (new)

- Input: `{ text: string, source_type: string, source_name: string }`
- Calls Claude haiku with `tool_use` (reuse pattern from `wishlist-parse/index.ts`)
- Tool schema enforces structured output: `{ companies: [{ name, domain, industry, location, employee_count, annual_revenue, website_url, description, status, contacts: [{ name, email, title }] }] }`
- For inputs >15K chars: chunk and deduplicate by domain
- Returns extracted company array
- Logs usage via `_shared/usage-logger.ts`

### 4. Edge Function: `backfill-match` (new)

- Input: `{ extracted: Company[], job_id: string }`
- Fetches user's existing companies
- Three-tier matching (reusing normalize.ts utilities):
  1. **Domain exact** → confidence 1.0, action: update
  2. **Normalized name exact** → confidence 0.8, action: update
  3. **Levenshtein fuzzy name** (threshold >0.6) → confidence 0.5-0.7, action: update (flagged for review)
  4. **No match** → action: create
- Computes per-field diffs (what would change on update)
- Updates `import_jobs.match_results` with results
- Returns match array with actions and diffs

### 5. Edge Function: `backfill-commit` (new)

- Input: `{ job_id: string, approved_items: [{ action, company_id?, data }] }`
- Processes sequentially with try/catch per company
- Creates new companies (INSERT) or updates existing (UPDATE, only changed fields)
- Also creates contacts if extracted
- Updates `import_jobs.commit_summary` and status
- Returns summary: `{ created: N, updated: N, skipped: N, errors: [...] }`

### 6. UI: `src/components/companies/BackfillImportDialog.tsx` (new)

Multi-step dialog triggered from CompaniesPage toolbar:

**Step 1 — INPUT**: File upload (drag-drop + file picker) or paste text/URL. Reuses file parsing from `parse-upload`. Accepts CSV, XLSX, PDF, DOCX, TXT, URL.

**Step 2 — EXTRACTING**: Loading state. Calls `backfill-extract` then `backfill-match`.

**Step 3 — PREVIEW**: Table showing each company with:
- Checkbox (select/deselect)
- Action badge (Create / Update / Skip)
- Confidence indicator
- Company name, domain, matched-to name
- Expandable field diffs for updates
- Low-confidence matches (<0.7) flagged with warning, deselected by default

**Step 4 — COMMITTING**: Progress indicator as `backfill-commit` runs.

**Step 5 — COMPLETE**: Summary card (X created, Y updated, Z skipped, N errors). Close refreshes company list.

### 7. CompaniesPage Integration

Add "Import" button in toolbar at ~line 937 (between grouping select and view toggle):
```tsx
<Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
  <Upload className="h-4 w-4 mr-2" /> Import
</Button>
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/2026XXXXXXXX_import_jobs.sql` | **Create** — import_jobs table |
| `supabase/functions/_shared/normalize.ts` | **Create** — extracted utilities |
| `supabase/functions/global-sync/index.ts` | **Modify** — import from normalize.ts |
| `supabase/functions/backfill-extract/index.ts` | **Create** — AI extraction |
| `supabase/functions/backfill-match/index.ts` | **Create** — matching engine |
| `supabase/functions/backfill-commit/index.ts` | **Create** — commit changes |
| `src/components/companies/BackfillImportDialog.tsx` | **Create** — UI component |
| `src/pages/CompaniesPage.tsx` | **Modify** — add Import button |

## Verification

1. Start dev server, navigate to Companies page, confirm Import button appears
2. Upload a test CSV with ~5 companies (mix of existing domains and new ones)
3. Verify extraction returns structured data
4. Verify matching correctly identifies existing vs new companies
5. Preview step shows correct actions and diffs
6. Commit creates/updates the right records
7. Companies page refreshes with new data
8. Deploy edge functions and run against live Supabase
