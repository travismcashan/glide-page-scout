

# Move Crawl Orchestration to Edge Functions

## Problem
All ~25 integration triggers run client-side via `useEffect` hooks in `ResultsPage.tsx` (2741 lines). If the user closes their browser mid-analysis, everything stops. Results only complete if the tab stays open.

## Architecture Overview

```text
CURRENT (client-side)
┌─────────────────────────────────────────┐
│  Browser (ResultsPage.tsx)              │
│  useEffect → builtwithApi.lookup()      │
│  useEffect → semrushApi.domainOverview()│
│  useEffect → pagespeedApi.analyze()     │
│  ... 25+ more useEffects                │
│  Each writes results to crawl_sessions  │
└─────────────────────────────────────────┘

PROPOSED (server-side)
┌──────────────┐     ┌──────────────────────────────┐
│  Browser     │     │  Edge Function: crawl-orchestrator │
│  POST start  │────▶│  Reads integration_settings  │
│  Poll status │◀────│  Runs integrations in parallel│
│              │     │  Writes results to DB directly│
│  Real-time   │◀────│  Updates status per integration│
│  subscription│     └──────────────────────────────┘
└──────────────┘
```

## Detailed Plan

### 1. New DB table: `integration_runs`
Track per-integration status server-side so the UI can poll/subscribe.

```sql
CREATE TABLE public.integration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  integration_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending | running | done | failed | skipped
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, integration_key)
);
ALTER TABLE public.integration_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON public.integration_runs FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.integration_runs;
```

### 2. New edge function: `crawl-orchestrator`
Single long-running function that:
- Accepts `{ session_id }` 
- Reads the session's `domain`, `base_url`, `prospect_domain`
- Reads `integration_settings` to check paused integrations
- Creates `integration_runs` rows for all active integrations (status: `pending`)
- Runs integrations in parallel batches (respecting dependencies):

**Batch 1 (independent, all parallel):**
builtwith, semrush, psi, wappalyzer, detectzestack, gtmetrix, carbon, crux, wave, observatory, httpstatus, w3c, schema, readable, yellowlab, ocean, hubspot, sitemap, nav-extract, firecrawl-map

**Batch 2 (depends on Batch 1 results):**
- `tech-analysis` → needs builtwith + wappalyzer + detectzestack
- `avoma` → can use hubspot contact email
- `apollo` → needs hubspot primary contact
- `content-types` → needs discovered URLs + scraped pages
- `forms-detect` → needs discovered URLs
- `auto-tag-pages` → needs scraped pages
- `link-checker` → needs discovered URLs

**Batch 3 (depends on Batch 2):**
- `apollo-team-search` → needs apollo enrichment
- `observations-insights` → needs most data populated

Each integration:
1. Updates its `integration_runs` row to `running`
2. Calls the existing edge function (internal fetch)
3. Writes result to `crawl_sessions` JSONB column
4. Updates `integration_runs` to `done` or `failed`

Edge function timeout consideration: Supabase edge functions have a ~60s default timeout. This orchestrator needs to be designed as a **dispatcher** pattern:
- The orchestrator queues work and returns immediately
- Each integration runs as its own edge function call (already exists)
- A **polling loop** or **pg_cron job** checks for pending work

### 3. Alternative: Dispatcher + Worker pattern
Since a single edge function can't run for 5+ minutes:

**Option A — Client kicks off, server executes each:**
- New `crawl-start` edge function creates all `integration_runs` rows
- New `crawl-worker` edge function processes ONE integration at a time
- A pg_cron job (every 30s) picks up pending `integration_runs` and invokes `crawl-worker` for each
- Or: `crawl-start` fires off all workers via `fetch()` without awaiting (fire-and-forget)

**Option B — Chained invocation:**
- `crawl-start` creates rows, then calls each integration edge function via `fetch()` in parallel (fire-and-forget)
- Each integration function writes its own result and updates `integration_runs`
- Dependency-chain integrations check their prerequisites before running; if not met, reschedule via a small delay

**Recommended: Option B** — simpler, no pg_cron needed, leverages existing edge functions.

### 4. New edge function: `crawl-start`
```
POST { session_id }
→ Read session + integration_settings
→ Insert integration_runs rows (all pending)
→ Fire-and-forget parallel fetches to each integration's existing edge function
   (with added logic to write results to crawl_sessions and update integration_runs)
→ Return { success: true, integrations: [...keys] }
```

### 5. Modify existing edge functions
Each existing edge function (builtwith-lookup, semrush-domain, etc.) needs a small wrapper:
- Accept optional `session_id` parameter
- If present: update `integration_runs` to `running`, execute, write result to `crawl_sessions`, update to `done/failed`
- If absent: behave as before (backwards compatible)

### 6. Dependency resolver edge function: `crawl-check-deps`
For Batch 2/3 integrations, add a small function or inline logic:
- Before running, check if prerequisite columns in `crawl_sessions` are populated
- If not ready, skip (mark as `pending` still) — the completing prerequisite will re-trigger

**Simpler approach:** Each Batch 1 function, after completing, checks if any dependent integrations are now unblocked and fires them.

### 7. Update ResultsPage.tsx (client-side)
- Remove all `useEffect` integration triggers (~500 lines deleted)
- On page load: subscribe to `integration_runs` via Supabase Realtime
- When a row changes to `done`, re-fetch that column from `crawl_sessions` and update local state
- Keep manual re-run buttons: they call the individual edge function with `session_id`
- Keep the "Stop Analysis" button: it updates all `pending` rows to `skipped`
- Loading states derived from `integration_runs` status instead of local refs

### 8. Update CrawlPage.tsx
- After creating `crawl_sessions` row, call `crawl-start` instead of navigating and relying on ResultsPage effects

## Scope & Risk Assessment

**This is a very large change** touching:
- ~20 existing edge functions (add session_id handling)
- 1 new DB table
- 2-3 new edge functions
- Major rewrite of ResultsPage.tsx (remove ~800 lines of useEffect triggers, add realtime subscription)
- CrawlPage.tsx (minor)

**Risks:**
- Edge function cold-start times may cause some integrations to timeout
- Fire-and-forget pattern means no retry unless we add it
- Some integrations (SSL Labs, Yellow Lab, GTmetrix) do internal polling — these already run as edge functions with their own timeout handling
- Race conditions on dependency chains

**Recommendation:** Implement incrementally:
1. Phase 1: Add `integration_runs` table + realtime subscription on client. Keep client-side triggers but have them write status to `integration_runs` too. This gives visibility without breaking anything.
2. Phase 2: Create `crawl-start` function that fires independent (Batch 1) integrations server-side. Remove those useEffects from client.
3. Phase 3: Add dependency-chain logic for Batch 2/3 integrations.
4. Phase 4: Remove remaining client-side triggers.

## Implementation Order (if approved)

1. Create `integration_runs` table with realtime enabled
2. Build `crawl-start` edge function (dispatcher)
3. Update 2-3 edge functions as proof-of-concept (e.g., builtwith, semrush, psi)
4. Add realtime subscription to ResultsPage
5. Remove corresponding client-side useEffects
6. Repeat for remaining integrations
7. Add dependency-chain logic for Batch 2/3
8. Update CrawlPage to call `crawl-start`

