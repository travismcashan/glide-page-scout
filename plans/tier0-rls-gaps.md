# Plan: Add RLS policies to tables missing coverage

## Research Findings

### Methodology
Audited all 80+ migration files for `CREATE TABLE`, `ENABLE ROW LEVEL SECURITY`, and `CREATE POLICY` statements. Cross-referenced with the Supabase generated types file (`src/integrations/supabase/types.ts`) which lists all tables that exist in production.

### Table Inventory (41 tables in types.ts)

#### Category A: Properly Secured (14 tables)
Tables with RLS enabled AND user-scoped policies (`user_id = auth.uid()` or parent-chain ownership):

| Table | Scoping Method |
|---|---|
| companies | user_id = auth.uid() + service_role policy |
| contacts | user_id = auth.uid() + service_role policy |
| deals | user_id = auth.uid() + service_role policy |
| engagements | user_id = auth.uid() + service_role policy |
| crawl_sessions | user_id = auth.uid() (replaced "allow all" in 20260330) |
| crawl_pages | EXISTS via crawl_sessions.user_id |
| crawl_screenshots | EXISTS via crawl_sessions.user_id |
| integration_runs | EXISTS via crawl_sessions.user_id |
| profiles | id = auth.uid() + admin override |
| user_roles | user_id = auth.uid() + admin override |
| roadmaps | user_id = auth.uid() |
| roadmap_items | owns_roadmap() helper function |
| company_source_data | user_id = auth.uid() (bravo's new migration — verified correct) |
| knowledge_favorites | USING(true) but acceptable — tiny table, no secrets |

#### Category B: RLS Enabled but Wide-Open "Allow All" (19 tables)
These have `ENABLE ROW LEVEL SECURITY` + `USING(true) WITH CHECK(true)` — effectively no protection.

**Have user_id column (SHOULD be scoped):**
| Table | Has user_id? | Correct Scoping |
|---|---|---|
| services | Yes (nullable) | user_id = auth.uid() for write, authenticated read for all |
| wishlist_items | No user_id | Needs user_id column added, then scoped |

**Reference/lookup tables (USING(true) is acceptable):**
| Table | Why open is OK |
|---|---|
| project_phases | Estimator reference data — shared |
| team_roles | Estimator reference data — shared |
| master_tasks | Estimator reference data — shared |
| task_formulas | Estimator reference data — shared |
| service_steps | Service catalog reference — shared |

**Session-scoped tables (should scope via session ownership):**
| Table | Parent FK | Correct Scoping |
|---|---|---|
| chat_threads | session_id → crawl_sessions | EXISTS via crawl_sessions.user_id |
| knowledge_documents | session_id → crawl_sessions | EXISTS via crawl_sessions.user_id |
| knowledge_chunks | document_id → knowledge_documents → session | EXISTS chain |
| knowledge_messages | thread_id → chat_threads → session | EXISTS chain |
| global_chat_threads | user_id not present | Needs user_id |
| global_chat_sources | thread_id → global_chat_threads | EXISTS chain |
| global_chat_messages | thread_id → global_chat_threads | EXISTS chain |
| site_groups | user_id not present | Needs user_id |
| site_group_members | group_id → site_groups | EXISTS chain |
| integration_settings | No user_id | Needs user_id or service_role-only |
| oauth_connections | user_id not present | Needs user_id (stores tokens!) |
| project_estimates | No user_id | USING(true) acceptable for now (estimator) |
| estimate_tasks | No user_id | USING(true) acceptable for now (estimator) |

#### Category C: No RLS at All (8 tables — created via Supabase dashboard)
These tables have NO migration, NO `ENABLE ROW LEVEL SECURITY`, NO policies.

| Table | Has user_id? | Risk Level | Correct Action |
|---|---|---|---|
| **ai_usage_log** | Yes (nullable) | Medium | Enable RLS + user_id scope |
| **proposals** | Yes (nullable) | **High** | Enable RLS + user_id scope |
| **user_settings** | Yes (required) | **High** | Enable RLS + user_id scope |
| **wishlist_comments** | Yes (nullable) | Medium | Enable RLS + user_id scope |
| **contact_photos** | No | Low | Public lookup cache — enable RLS + authenticated read-only |
| **model_pricing** | No | Low | Public lookup table — enable RLS + authenticated read-only |
| **proposal_case_studies** | No (FK to session) | Medium | Enable RLS + session ownership chain |
| **wishlist_attachments** | No (FK to wishlist_items) | Medium | Enable RLS + parent chain (needs wishlist_items to have user_id first) |

#### Category D: Not in Types File (created but not typed)
`claude_code_plans`, `project_mappings`, `asana_config` — these exist in production (referenced in code) but weren't captured in the last type generation. They need RLS audit too, but are blocked on Task #4 (type regeneration) for full visibility.

### Critical Security Gaps

1. **`proposals`** — Contains client proposal data with pricing. No RLS at all. Any authenticated user could read all proposals.
2. **`user_settings`** — Contains personal bio, custom instructions, location data. No RLS.
3. **`oauth_connections`** — Stores OAuth tokens (Harvest, Google, Slack). Has RLS enabled but USING(true) — any authenticated user can read all tokens. **Most dangerous gap.**
4. **`wishlist_items`** — No user_id column. Wide-open USING(true). Contains feature plans.

## Recommendation

Fix in priority order based on data sensitivity:
1. **Critical (tokens/PII):** oauth_connections, user_settings, proposals
2. **Important (user data):** ai_usage_log, wishlist_comments, wishlist_items + attachments, global_chat_*, site_groups
3. **Session-chain (cascade protection):** chat_threads, knowledge_documents/chunks/messages, proposal_case_studies
4. **Low priority (reference data):** contact_photos, model_pricing, integration_settings
5. **Skip (intentionally open):** project_phases, team_roles, master_tasks, task_formulas, service_steps, project_estimates, estimate_tasks

## Implementation Steps

### Phase 1: Critical — No-RLS tables with user_id (single migration)
- [ ] **Step 1:** Enable RLS + add user-scoped CRUD policies for `proposals` (has user_id)
- [ ] **Step 2:** Enable RLS + add user-scoped CRUD policies for `user_settings` (has user_id)
- [ ] **Step 3:** Enable RLS + add user-scoped CRUD policies for `ai_usage_log` (has user_id, nullable — also allow service_role)
- [ ] **Step 4:** Enable RLS + add user-scoped CRUD policies for `wishlist_comments` (has user_id)

### Phase 2: Critical — Fix wide-open oauth_connections
- [ ] **Step 5:** Drop "Allow all access to oauth_connections" policy
- [ ] **Step 6:** Add user_id column to `oauth_connections` if missing (check production schema), then scope to user_id = auth.uid()
- [ ] **Step 7:** Backfill existing oauth_connections with current user's ID

### Phase 3: Add user_id + scope to tables missing it
- [ ] **Step 8:** Add user_id to `wishlist_items`, backfill from existing data, drop "allow all", add scoped policies
- [ ] **Step 9:** After wishlist_items has user_id, scope `wishlist_attachments` via parent chain (enable RLS + EXISTS via wishlist_items.user_id)
- [ ] **Step 10:** Add user_id to `global_chat_threads`, scope `global_chat_sources` and `global_chat_messages` via parent chain
- [ ] **Step 11:** Add user_id to `site_groups`, scope `site_group_members` via parent chain

### Phase 4: Session-chain scoping
- [ ] **Step 12:** Drop "allow all" on `chat_threads`, add EXISTS via crawl_sessions.user_id
- [ ] **Step 13:** Drop "allow all" on `knowledge_documents`, add EXISTS via crawl_sessions.user_id
- [ ] **Step 14:** Scope `knowledge_chunks` via knowledge_documents chain
- [ ] **Step 15:** Scope `knowledge_messages` via chat_threads chain
- [ ] **Step 16:** Enable RLS on `proposal_case_studies`, scope via crawl_sessions.user_id

### Phase 5: Lookup tables (low priority)
- [ ] **Step 17:** Enable RLS on `contact_photos` + `model_pricing` with authenticated read-only policy (`FOR SELECT TO authenticated USING (true)`)
- [ ] **Step 18:** Replace "allow all" on `integration_settings` with authenticated read-only + service_role write

### Phase 6: Service role policies for edge functions
- [ ] **Step 19:** Add service_role bypass policies to all newly-scoped tables that edge functions write to (proposals, wishlist_items, oauth_connections, chat_threads, knowledge_documents, etc.)

## Affected Files

- New migration file: `supabase/migrations/20260406000001_rls_coverage.sql` — all RLS changes in a single migration
- No frontend code changes needed (frontend uses anon key which already goes through RLS; service_role in edge functions bypasses RLS)
- Edge functions that write to newly-scoped tables need service_role policies added (Step 19) or they'll fail

## Dependencies

- **oauth_connections** needs schema inspection first — verify if user_id column exists in production (not in migration, may have been added via dashboard)
- **wishlist_items** adding user_id requires knowing the current user count (single-tenant = simple backfill; multi-tenant = need mapping logic)
- **claude_code_plans, project_mappings, asana_config** need type regeneration (Task #4) before they can be fully audited

## Risks

1. **Edge function breakage:** If service_role policies aren't added alongside user-scoped policies, edge functions writing to these tables will fail silently (Supabase returns empty results, not errors, for RLS denials). Must add `FOR ALL TO service_role USING (true)` for every table edge functions touch.
2. **Backfill correctness:** Adding user_id to existing tables requires backfilling. For single-tenant (current state), backfill with the single user's UUID. If multi-tenant later, this becomes a data migration.
3. **Session-chain performance:** EXISTS subqueries for deep chains (knowledge_chunks → knowledge_documents → crawl_sessions) may be slow on large datasets. Consider adding direct user_id columns instead of chains for high-volume tables.
4. **OAuth token exposure window:** Until Phase 2 ships, any authenticated user can read all OAuth tokens. This is the highest-priority fix.
