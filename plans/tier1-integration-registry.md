# Plan: Consolidate integration registry into single shared module

## Research Findings

### Current State: 6 separate integration definitions

There are **6 distinct files** that define integration lists, each with different schemas and purposes:

#### 1. `src/lib/integrationRegistry.ts` (frontend — 169 lines)
**Schema:** `{ key, label, cost, lane, auto, description }`
**31 integrations** including 3 premium (ssllabs, ga4, search-console) and knowledge lane items.
Also defines: `CrawlProfile` type, `getProfileIntegrations()`, `getSkippedIntegrations()`.
**Consumed by:** `SectionCard.tsx` (cost badges + descriptions)

#### 2. `supabase/functions/crawl-start/index.ts` (edge function — lines 24-72)
**Schema:** `{ key, fn, column, batch, waitFor?, buildBody }`
**26 integrations** covering all 3 batches.
- `batch` (1/2/3) — execution ordering
- `waitFor` — column to poll before running
- `buildBody` — function generating request payload from session
**This is the orchestration definition** — determines what runs and in what order.

#### 3. `supabase/functions/crawl-phase1/index.ts` (edge function — lines 49-68)
**Schema:** `{ key, fn, column, buildBody }`
**20 integrations** — batch 1 items. Duplicates crawl-start's batch 1 entries exactly (minus batch/waitFor).

#### 4. `supabase/functions/crawl-phase2/index.ts` (edge function — lines 47-56)
**Schema:** `{ key, fn, column, buildBody }`
**4 integrations** — batch 2 items (tech-analysis, content-types, forms, link-checker).

#### 5. `supabase/functions/crawl-phase3/index.ts` (edge function — lines 47-48)
**Schema:** `{ key, fn, column, buildBody }`
**2 integrations** — batch 3 items (apollo-team, page-tags).

#### 6. `src/pages/ConnectionsPage.tsx` (frontend — lines 121-161)
**Schema:** `{ name, id, description, category, tier, hasCredits? }`
**28 integrations** with `category` groupings (URL Analysis, Content Analysis, etc.) and `tier` (free/premium).
**Consumed by:** ConnectionsPage crawl integrations panel (toggle pause/play).

#### Also relevant (not integration lists, but integration-aware):

- **`src/lib/siteScore.ts`** — `CATEGORY_DEFS` with `IntegrationDef`: `{ key, label, weight, extract, summarize }`. 26 scoring entries organized by 6 categories. Scoring-specific — `extract` and `summarize` are functions that parse session data.
- **`src/pages/CrawlPage.tsx`** — `INTEGRATIONS`: `{ label, icon }`. 24 marketing showcase items (not real integration keys, just display text). Not part of the real registry.
- **`src/lib/cardDescriptions.ts`** — **DEAD CODE**. Superseded by `integrationRegistry.ts`. Only SectionCard.tsx imports from integrationRegistry now.
- **`src/pages/HistoryPage.tsx`** — hardcoded `TOTAL_INTEGRATIONS = 27` constant for status resolution.

### Key Differences and Conflicts

| Field | crawl-start | phase1/2/3 | integrationRegistry | ConnectionsPage | siteScore |
|-------|-------------|------------|---------------------|-----------------|-----------|
| `key` | yes | yes | yes | `id` | yes |
| `fn` (edge fn name) | yes | yes | no | no | no |
| `column` (DB column) | yes | yes | no | no | no |
| `batch` (1/2/3) | yes | no (implicit) | no | no | no |
| `waitFor` | yes | no | no | no | no |
| `buildBody` | yes | yes (duplicated!) | no | no | no |
| `cost` | no | no | yes | `tier` (different values) | no |
| `lane` | no | no | yes | no | no |
| `auto` | no | no | yes | no | no |
| `description` | no | no | yes | yes (different text!) | no |
| `label` | no | no | yes | `name` (different!) | yes |
| `category` | no | no | no | yes | implicit (via parent) |
| `weight` | no | no | no | no | yes |
| `extract` / `summarize` | no | no | no | no | yes (functions) |

### Inconsistencies Found

1. **Key mismatches:** ConnectionsPage uses `id: 'url-discovery'` for firecrawl-map, `id: 'auto-tag-pages'` for page-tags, `id: 'psi-accessibility'` for the Lighthouse a11y entry. These don't match the canonical `key` values in crawl-start.
2. **Label mismatches:** integrationRegistry uses "PageSpeed Insights", ConnectionsPage uses "Google PageSpeed Insights". integrationRegistry uses "BuiltWith", ConnectionsPage uses "BuiltWith" (matches). But `label` vs `name` field name differs.
3. **Cost/tier mismatch:** integrationRegistry uses `free/freemium/paid`, ConnectionsPage uses `free/premium`. httpstatus is `free` in registry but `premium` in ConnectionsPage. readable is `free` in registry but `premium` in ConnectionsPage.
4. **Description drift:** Both files have descriptions but with different wording. integrationRegistry descriptions are more polished.
5. **buildBody duplication:** crawl-start and phase1/2/3 define identical `buildBody` functions. If one changes, the other won't.
6. **Count mismatch:** HistoryPage hardcodes `TOTAL_INTEGRATIONS = 27` but the actual count varies by file (26-31).

### Sharing between edge functions and frontend

Edge functions import from `supabase/functions/_shared/`. Frontend imports from `src/`. These are **separate build environments** (Deno vs Vite/Node). You cannot directly share a module.

**Options for sharing:**
1. **JSON data file** — a `.json` file with static metadata (key, label, cost, lane, description, fn, column, batch, category). Both environments can import JSON. `buildBody` functions can't live in JSON — they stay in phase files.
2. **Codegen** — a build script reads one source and generates the other. Overkill for this.
3. **Copy with types** — maintain one canonical TypeScript file in `_shared/`, copy the type definitions to `src/`. Accept the duplication but make one file the source of truth.

**Recommended: JSON data + thin TypeScript wrappers.** A `_shared/integration-registry.json` file with all static metadata. Edge functions import it for `key`/`fn`/`column`/`batch` lookups. Frontend copies or fetches it for `key`/`label`/`cost`/`description` lookups. `buildBody` functions stay in phase files (they're runtime-specific). `extract`/`summarize` stay in siteScore.ts (they're scoring-specific).

## Recommendation

Create a single canonical integration registry as a JSON file in `_shared/`, with TypeScript wrapper modules in both environments. This eliminates 5 of the 6 duplicate lists and makes one file the source of truth for all static integration metadata.

**Keep separate:**
- `buildBody` functions — remain in crawl-start (they reference session data, URL constructors, etc.)
- `extract`/`summarize` functions — remain in siteScore.ts (scoring-specific logic)
- CrawlPage showcase — purely decorative, not a real registry

**Remove:**
- `cardDescriptions.ts` — dead code
- Phase1/2/3 inline integration arrays — replaced by reading from shared registry + phase-runner config
- ConnectionsPage inline CRAWL_INTEGRATIONS — replaced by importing from shared registry
- HistoryPage hardcoded `TOTAL_INTEGRATIONS = 27` — derive from registry

## Implementation Steps

- [ ] **Step 1: Design the unified schema**
  ```typescript
  type IntegrationEntry = {
    key: string;           // canonical identifier
    label: string;         // display name
    fn: string;            // edge function name
    column: string;        // crawl_sessions column
    batch: 1 | 2 | 3;     // execution phase
    waitFor?: string;      // column dependency
    cost: 'free' | 'freemium' | 'paid';
    lane: 'audit' | 'intel' | 'knowledge' | 'premium';
    auto: boolean;         // runs in pipeline
    category: string;      // UI grouping (Performance, SEO, etc.)
    description: string;   // human-readable description
  }
  ```

- [ ] **Step 2: Create `supabase/functions/_shared/integration-registry.json`** — populate with all ~31 integrations, resolving conflicts (use integrationRegistry.ts keys + crawl-start's fn/column/batch + best descriptions)

- [ ] **Step 3: Create `supabase/functions/_shared/integration-registry.ts`** — thin Deno wrapper that imports JSON, exports typed helpers: `getIntegration(key)`, `getPhaseIntegrations(batch)`, `getAllAutoIntegrations()`

- [ ] **Step 4: Update `src/lib/integrationRegistry.ts`** — rewrite to import from a local copy of the JSON (or inline the same data). Keep profile helpers. Remove duplicate integration array.

- [ ] **Step 5: Update `crawl-start/index.ts`** — import integration list from `_shared/integration-registry.ts`. Keep `buildBody` functions as a local map keyed by integration key.

- [ ] **Step 6: Update phase1/phase2/phase3** — import integration lists from `_shared/integration-registry.ts`. Filter by batch. Keep `buildBody` in a local map.

- [ ] **Step 7: Update `ConnectionsPage.tsx`** — import from `src/lib/integrationRegistry.ts`. Remove inline CRAWL_INTEGRATIONS.

- [ ] **Step 8: Fix key mismatches** — standardize `url-discovery` → `firecrawl-map`, `auto-tag-pages` → `page-tags`, `psi-accessibility` → keep as virtual key (it's a sub-extraction from PSI, not a separate integration)

- [ ] **Step 9: Delete `src/lib/cardDescriptions.ts`** — confirmed dead code

- [ ] **Step 10: Replace HistoryPage `TOTAL_INTEGRATIONS = 27`** — derive from registry: `INTEGRATION_REGISTRY.filter(i => i.auto).length`

- [ ] **Step 11: Reconcile cost/tier values** — resolve httpstatus (free vs premium) and readable (free vs premium) discrepancies by checking actual API costs

- [ ] **Step 12: Test** — `npm run build`, verify CrawlPage, ConnectionsPage, ResultsPage, HistoryPage all work correctly

## Affected Files

- `supabase/functions/_shared/integration-registry.json` — **NEW** canonical data
- `supabase/functions/_shared/integration-registry.ts` — **NEW** typed wrapper for edge functions
- `src/lib/integrationRegistry.ts` — **REWRITE** to use canonical data, keep profile helpers
- `src/lib/cardDescriptions.ts` — **DELETE** (dead code)
- `supabase/functions/crawl-start/index.ts` — **EDIT** remove inline array, import from shared, keep buildBody map
- `supabase/functions/crawl-phase1/index.ts` — **EDIT** remove inline array, import from shared
- `supabase/functions/crawl-phase2/index.ts` — **EDIT** remove inline array, import from shared
- `supabase/functions/crawl-phase3/index.ts` — **EDIT** remove inline array, import from shared
- `src/pages/ConnectionsPage.tsx` — **EDIT** remove inline CRAWL_INTEGRATIONS, import from registry
- `src/pages/HistoryPage.tsx` — **EDIT** replace hardcoded 27 with registry-derived count
- `src/lib/siteScore.ts` — **NO CHANGE** (extract/summarize functions are scoring-specific, not metadata)

## Dependencies

- No database migrations needed
- No external service changes
- Should be done after Tier 0 stabilization (the registry keys must be finalized first)
- `buildBody` functions reference session structure — if session schema changes, those functions change regardless of registry location

## Risks

- **Medium risk — wide blast radius.** Touches 10+ files including all crawl phase functions. A typo in a key could silently break an integration.
- **Mitigation:** Run a full crawl test after changes to verify all integrations fire correctly. Check `integration_runs` for any new failures.
- **Edge function cold import:** JSON imports in Deno edge functions should be fast, but verify no performance regression on crawl-start.
- **Dual-environment sync:** The JSON file lives in `_shared/` but frontend needs a copy. A symlink won't work across build environments. Options: copy at build time, or maintain two identical files with a lint check. The simplest approach is to have the frontend module import from a hardcoded copy and add a comment pointing to the canonical source.
- **siteScore.ts virtual keys:** `psi-performance`, `psi-seo`, `psi-accessibility`, `psi-best-practices`, `sitemap-coverage` are not real integration keys — they're sub-extractions from `psi` and `sitemap`. The registry shouldn't include these; siteScore.ts should continue to define them locally.
