# Plan: Regenerate Supabase TypeScript types

## Research Findings

### Current State of types.ts
The file is at `src/integrations/supabase/types.ts` (2,431 lines). It defines **41 tables** and **9 RPC functions**. The types were last regenerated sometime around the `company_brain_schema` migration (2026-04-02), but many schema changes since then are NOT reflected.

### Tables in types.ts (41)
ai_usage_log, chat_threads, companies, contact_photos, contacts, crawl_pages, crawl_screenshots, crawl_sessions, deals, engagements, estimate_tasks, global_chat_messages, global_chat_sources, global_chat_threads, integration_runs, integration_settings, knowledge_chunks, knowledge_documents, knowledge_favorites, knowledge_messages, master_tasks, model_pricing, oauth_connections, profiles, project_estimates, project_phases, proposal_case_studies, proposals, roadmap_items, roadmaps, service_steps, services, site_group_members, site_groups, task_formulas, team_roles, user_roles, user_settings, wishlist_attachments, wishlist_comments, wishlist_items

### Tables MISSING from types.ts (created in DB but not in types)
1. **claude_code_plans** — used in `src/hooks/usePlans.ts` with `'claude_code_plans' as any` workaround (5 occurrences)
2. **project_mappings** — used in `src/pages/ProjectMappingPage.tsx`
3. **asana_config** — used alongside project_mappings
4. **company_source_data** — just created by Plan #2 migration

### Columns MISSING from existing table types

**companies** — missing ~8 columns added via dashboard (no migrations):
- `harvest_client_id`, `harvest_client_name`, `freshdesk_company_id`, `freshdesk_company_name`
- `asana_project_gids`, `last_synced_at`, `quickbooks_invoice_summary`
- Code works around this with local type declarations (e.g., `CompanyDetailPage.tsx:59`, `CompaniesPage.tsx:74`)

**crawl_sessions** — missing `user_id` (added by migration `20260330000001`) and `ai_insights` (added via dashboard for SUPER CRAWL)

**deals** — missing `hubspot_owner_id` (added by migration `20260405000004_sync_upsert_indexes.sql`)

**contacts** — missing `lead_status`, `lifecycle_stage`, `hubspot_owner_id` (added by same migration)

### `as any` Usage — 421 occurrences across 64 files
This is a major code quality issue. While not ALL are type workarounds (some are legitimate `any` casts for dynamic data), the `.from('table_name' as any)` pattern in `usePlans.ts` directly results from stale types. After regeneration, many of the 421 occurrences could potentially be replaced with proper types.

### Supabase CLI
- **Installed:** `/opt/homebrew/bin/supabase`
- **Project ID:** `afgwuqpsxnglxhosczoi` (from `supabase/config.toml`)
- **Command:** `supabase gen types typescript --project-id afgwuqpsxnglxhosczoi > src/integrations/supabase/types.ts`

### Dependency on Other Tier 0 Plans
- **Plan #1** (deals status constraint fix) — adds migration `20260405000005_fix_deals_status_constraint.sql`
- **Plan #2** (company_source_data) — adds migration `20260405000004_create_company_source_data.sql`
- **Plan #3** (upsert sync) — adds migration `20260405000004_sync_upsert_indexes.sql`
- **All three migrations must be applied to production BEFORE regenerating types**, otherwise the new types won't include those changes.

## Recommendation

**Regenerate types after all Tier 0 migrations are applied.** This is a mechanical step — run one command, replace the file. The harder follow-up is cleaning up `as any` workarounds, which should be a separate task.

### Execution Order
1. Apply all pending migrations (Plans #1, #2, #3) to production
2. Run `supabase gen types typescript` against the live project
3. Replace `types.ts` with the output
4. Remove `as any` workarounds from `usePlans.ts` (the clearest wins)
5. Remove local type declarations that duplicate what types.ts now provides (CompaniesPage, CompanyDetailPage)

## Implementation Steps

- [ ] **Step 1: Verify all migrations are applied** — Check that migrations from Plans #1, #2, and #3 have been applied to production Supabase
- [ ] **Step 2: Regenerate types** — Run: `supabase gen types typescript --project-id afgwuqpsxnglxhosczoi > src/integrations/supabase/types.ts`
- [ ] **Step 3: Verify output** — Check that all expected tables appear: `claude_code_plans`, `project_mappings`, `asana_config`, `company_source_data` + updated columns on `companies`, `contacts`, `deals`, `crawl_sessions`
- [ ] **Step 4: Fix `usePlans.ts`** — Remove the 5 `'claude_code_plans' as any` casts, replace with `'claude_code_plans'`
- [ ] **Step 5: Build check** — Run `npm run build` to verify no type errors introduced
- [ ] **Step 6 (Future task): Audit `as any` usage** — Separate task to systematically reduce the 421 `as any` occurrences using the newly available types. Priority targets:
  - `usePlans.ts` (5 occurrences — table name casts)
  - `CompaniesPage.tsx` (19 occurrences — local type workarounds)
  - `CompanyDetailPage.tsx` (13 occurrences)
  - `ResultsPage.tsx` (196 occurrences — largest, mostly dynamic crawl data)

## Affected Files

- `src/integrations/supabase/types.ts` — **REPLACED** entirely by generated output
- `src/hooks/usePlans.ts` — remove 5 `as any` casts on table name
- No other files need changes for the core regen; `as any` cleanup is a follow-up task

## Dependencies

- **All Tier 0 migrations must be applied first** — Plans #1 (deals constraint), #2 (company_source_data), #3 (sync upsert indexes)
- **Tables created via dashboard** (claude_code_plans, project_mappings, asana_config, various company/crawl_sessions columns) must still exist in production — they should, since they're in use
- Supabase CLI must be authenticated (`supabase login` or access token)
- Network access to Supabase project

## Risks

- **Low risk:** Type regeneration is deterministic and the old file can be restored from git
- **Potential build breaks:** If the regenerated types reveal type mismatches that were previously hidden by `as any`, the build may fail. This is a GOOD thing — it surfaces real bugs — but may require immediate fixes
- **Dashboard-created columns:** If any column was dropped or renamed in the dashboard without a migration, it won't be in the generated types. This would surface as a build error, which is again beneficial
- **RPC function changes:** The types file includes 9 RPC functions. If any were modified since the last gen, their signatures will update too
- **No CI/pre-commit hook currently:** Types will drift again unless a process is added. Recommend adding `supabase gen types` to CI as a check (not auto-fix) that fails if types.ts is stale. This is a separate initiative.
