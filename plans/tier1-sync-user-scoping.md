# Plan: Add proper user_id scoping to sync edge functions

## Research Findings

### Current user_id Patterns Across Sync Functions

| Function | How it gets user_id | Where user_id is used | Breaks if multi-tenant? |
|----------|--------------------|-----------------------|------------------------|
| `hubspot-deals-sync` | `companies.select("user_id").limit(1).single()` — first company row | Insert deals, contacts, crawl_sessions | **YES** — picks arbitrary user's company |
| `hubspot-contacts-sync` | Same pattern — first company row | Insert contacts, crawl_sessions | **YES** — same problem |
| `global-sync` | `req.json().userId` — passed from frontend | Insert/update companies, company_source_data | **YES** — pg_cron has no user context |
| `crawl-start` | No user_id at all — reads session, doesn't create user-scoped rows | N/A (works on session data) | **NO** — session already has user_id |
| `crawl-recover` | No user_id — updates existing sessions/runs | N/A (updates only) | **NO** — updates existing rows |
| `enrich-contacts` | No user_id — updates existing contacts | N/A (updates only) | **NO** — updates existing rows |
| `enrich-companies` | No user_id — updates existing companies | N/A (updates only) | **NO** — updates existing rows |
| `batch-crawl` | No user_id — queries companies, creates crawl_sessions without user_id? | Needs investigation | **MAYBE** — creates sessions |

### The "First Company" Anti-Pattern

```ts
// hubspot-deals-sync line 107-110
const { data: firstCompany } = await supabase.from("companies").select("user_id").limit(1).single();
if (!firstCompany) throw new Error("No companies found — run global-sync first");
const userId = firstCompany.user_id;
```

Problems:
1. **Non-deterministic** — `.limit(1)` without `.order()` returns an arbitrary row. If two users exist, you get whichever row Postgres returns first.
2. **Empty table = fatal** — If companies is empty, the entire sync fails with "No companies found". This is a bootstrapping chicken-and-egg: deals-sync creates companies via `resolveCompany()`, but needs a user_id from companies to do so.
3. **Single-tenant assumption** — All data belongs to one user. True today, breaks with a second user.
4. **Service role bypasses RLS** — These functions use `SUPABASE_SERVICE_ROLE_KEY`, so they see ALL rows across ALL users. The user_id from the first company could belong to any user.

### global-sync's userId Dependency

```ts
// global-sync line 513
const { action = 'preview', userId, sources: sourcesFilter } = await req.json();
```

`userId` is required for the `sync` action (line 593: `if (action === 'sync' && userId)`). Without it, global-sync runs in preview-only mode — it fetches and matches but doesn't write to the DB. This means **pg_cron cannot trigger a full global-sync** without providing a userId.

### getUserIdFromRequest Pattern (Already Exists)

`_shared/usage-logger.ts` exports `getUserIdFromRequest(req)` which extracts user_id by decoding the JWT from the Authorization header. This works when a logged-in user triggers the function, but **returns null for service_role key calls** (service_role JWT has `role: 'service_role'`, not a user `sub`).

### Where user_id Is Actually Needed

user_id is needed in exactly two scenarios:
1. **Creating new rows** — `INSERT` into companies, contacts, deals, crawl_sessions needs `user_id` for RLS
2. **Scoping queries** — When a function should only see/affect one user's data (currently bypassed by service_role)

### batch-crawl User Scoping

batch-crawl creates `crawl_sessions` rows (line ~155 in the function) but doesn't set `user_id`. These sessions would fail RLS reads from the frontend unless the user_id is set. Looking at the code more closely, it uses `sb.from("crawl_sessions").insert(...)` which doesn't include user_id — this is a latent bug.

## Recommendation

### Strategy: Introduce a `sync_config` table + resolve user_id from context

The cleanest solution balances three realities:
1. **Today:** Single-tenant, one user (Travis). Don't over-engineer.
2. **Tomorrow:** Multi-tenant, many users sharing one Supabase instance.
3. **pg_cron:** No user context available.

**Approach:** Create a `sync_config` table that maps external integration credentials to user_id. Since API keys (HubSpot, Harvest, etc.) are stored as Supabase secrets (not per-user), there's currently a 1:1 relationship between the Supabase project and one user. Make this explicit.

### Three-Phase Fix

**Phase A (Immediate — single-tenant safe):**
- Add `resolveUserId()` shared utility that tries: (1) JWT from Authorization header → (2) `userId` from request body → (3) lookup from `sync_config` table → (4) fallback to first company row (current behavior, with logging warning)
- Replace all "first company" lookups with `resolveUserId()`

**Phase B (Multi-tenant ready):**
- `sync_config` table: maps integration credentials to user_id + org_id
- Each sync function scopes its queries to the resolved user_id
- pg_cron jobs include user_id in the request body (from sync_config)

**Phase C (Future — full multi-tenant):**
- Per-user API keys stored in vault
- Sync functions iterate over all configured users
- RLS enforcement even within edge functions (create user-scoped Supabase clients)

### Recommended: Implement Phase A now, design for Phase B

## Implementation Steps

### Phase A: resolveUserId() Utility + Immediate Fixes

- [ ] **Step 1: Create `_shared/resolve-user.ts`**
  ```ts
  /**
   * Resolves user_id for sync functions.
   * Priority: JWT > request body > sync_config > first company fallback
   */
  export async function resolveUserId(
    supabase: any,
    req?: Request,
    bodyUserId?: string
  ): Promise<string> {
    // 1. Try JWT from Authorization header
    if (req) {
      const auth = req.headers.get("authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      if (token && token.length > 10) {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(
              new TextDecoder().decode(
                Uint8Array.from(
                  atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
                  (c) => c.charCodeAt(0)
                )
              )
            );
            // Only use if it's a real user JWT (not service_role)
            if (payload.sub && payload.role !== "service_role") {
              return payload.sub;
            }
          }
        } catch {}
      }
    }

    // 2. Try explicit userId from request body
    if (bodyUserId) return bodyUserId;

    // 3. Try sync_config table (for pg_cron / automation)
    const { data: config } = await supabase
      .from("sync_config")
      .select("default_user_id")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (config?.default_user_id) return config.default_user_id;

    // 4. Fallback: first company (current behavior, with warning)
    console.warn("[resolve-user] Falling back to first company user_id — configure sync_config for production use");
    const { data: firstCompany } = await supabase
      .from("companies")
      .select("user_id")
      .limit(1)
      .single();
    if (firstCompany?.user_id) return firstCompany.user_id;

    throw new Error("Cannot resolve user_id — no sync_config, no companies. Run global-sync with explicit userId first.");
  }
  ```

- [ ] **Step 2: Create `sync_config` migration**
  ```sql
  CREATE TABLE IF NOT EXISTS public.sync_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    default_user_id UUID NOT NULL REFERENCES auth.users(id),
    label TEXT NOT NULL DEFAULT 'default',
    is_active BOOLEAN NOT NULL DEFAULT true,
    hubspot_config JSONB DEFAULT '{}'::jsonb,
    harvest_config JSONB DEFAULT '{}'::jsonb,
    freshdesk_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- Only one active config at a time
  CREATE UNIQUE INDEX idx_sync_config_active
    ON public.sync_config (is_active) WHERE is_active = true;

  ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Service role can manage sync_config"
    ON public.sync_config FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

  CREATE POLICY "Admins can view sync_config"
    ON public.sync_config FOR SELECT
    USING (auth.uid() IS NOT NULL);
  ```

- [ ] **Step 3: Seed sync_config with current user**
  Run once via SQL editor:
  ```sql
  INSERT INTO public.sync_config (default_user_id, label)
  SELECT DISTINCT user_id, 'Travis (primary)'
  FROM public.companies
  LIMIT 1;
  ```

- [ ] **Step 4: Update `hubspot-deals-sync`**
  - Import `resolveUserId` from `_shared/resolve-user.ts`
  - Replace lines 107-110 with:
    ```ts
    const { source } = await req.json().catch(() => ({}));
    const userId = await resolveUserId(supabase, req, undefined);
    ```
  - Remove the "No companies found" error (resolveUserId handles the fallback chain)

- [ ] **Step 5: Update `hubspot-contacts-sync`**
  - Same change as Step 4: replace lines 45-47 with `resolveUserId()`

- [ ] **Step 6: Update `global-sync`**
  - Import `resolveUserId`
  - Change line 513 area:
    ```ts
    const { action = 'preview', userId: bodyUserId, sources: sourcesFilter } = await req.json();
    const userId = await resolveUserId(supabase, req, bodyUserId);
    ```
  - Remove the `if (action === 'sync' && userId)` guard — userId is now always available
  - This unblocks pg_cron from running full syncs

- [ ] **Step 7: Update `batch-crawl`**
  - Import `resolveUserId`
  - Add user_id to crawl_session inserts (currently missing — latent bug)

### Phase B: Multi-Tenant Scoping (Design Only — Not Implemented Now)

- [ ] **Step 8 (future): Add `user_id` filter to all sync queries**
  - Currently service_role sees all rows. When a second user exists, sync functions must filter:
    ```ts
    const { data: localDeals } = await supabase
      .from("deals")
      .select("id, hubspot_deal_id")
      .eq("user_id", userId)  // <-- add this
      .not("hubspot_deal_id", "is", null);
    ```
  - Affects: deals-sync stale cleanup, contacts-sync stale cleanup, global-sync company matching
  - **Not needed now** — single tenant. Add when second user is onboarded.

- [ ] **Step 9 (future): Per-user integration credentials**
  - Move API keys from Supabase secrets to `sync_config` (encrypted via vault)
  - Each user/org has their own HubSpot, Harvest, etc. tokens
  - Sync functions iterate over active configs

## Affected Files

- **`supabase/functions/_shared/resolve-user.ts`** — NEW: shared user resolution utility
- **`supabase/migrations/NEW.sql`** — sync_config table + seed
- **`supabase/functions/hubspot-deals-sync/index.ts`** — replace first-company lookup (lines 107-110)
- **`supabase/functions/hubspot-contacts-sync/index.ts`** — replace first-company lookup (lines 45-47)
- **`supabase/functions/global-sync/index.ts`** — add resolveUserId, remove userId guard (lines 513, 593)
- **`supabase/functions/batch-crawl/index.ts`** — add user_id to crawl_session inserts

## Dependencies

1. **sync_config table must be seeded** before deploying updated functions — otherwise the fallback chain hits the old "first company" path (which still works, just logs a warning)
2. **No dependency on other Tier 0/1 tasks** — this is independent of upsert, RLS, or pg_cron changes
3. **pg_cron plan (Tier 1)** benefits from this: once sync_config exists, pg_cron jobs don't need to pass userId — resolveUserId reads it from sync_config automatically

## Risks

1. **sync_config not seeded** — If the migration runs but nobody inserts a row, resolveUserId falls back to first-company lookup (same as current behavior). No regression, just a warning log.

2. **JWT extraction from service_role** — The resolveUserId function correctly skips service_role JWTs (they have `role: 'service_role'`, not a user `sub`). If this check fails, it falls through to sync_config or first-company. Safe degradation.

3. **global-sync action guard removal** — Currently global-sync skips DB writes if userId is missing (`if (action === 'sync' && userId)`). After this change, userId is always available, so the guard becomes `if (action === 'sync')`. Risk: if resolveUserId somehow returns a wrong user_id, data gets written to the wrong user. Mitigated by the priority chain (JWT > body > config > fallback).

4. **batch-crawl user_id bug** — Adding user_id to batch-crawl's crawl_session inserts is a bugfix, but existing sessions without user_id may not be visible to non-service-role queries. No migration needed — these sessions are one-time and will age out.

5. **Multi-tenant is not addressed** — This plan explicitly defers full multi-tenant scoping. Adding a second user without implementing Phase B would cause data leaks (syncs write to the first user's scope). The sync_config table provides the foundation but doesn't enforce per-user isolation yet.

## Multi-Tenant Implications Summary

When a second user is added, these things break:

| What | Why | Fix (Phase B) |
|------|-----|---------------|
| deals-sync writes all HubSpot deals to one user | Single HubSpot token, single user_id | Per-user HubSpot tokens in sync_config |
| contacts-sync same | Same | Same |
| global-sync creates companies for one user | userId from body or sync_config | Iterate over all active sync_configs |
| Stale cleanup deletes other users' deals | No user_id filter on stale query | Add `.eq("user_id", userId)` to all stale queries |
| batch-crawl creates sessions without user_id | No user_id in insert | Add resolveUserId (Phase A fixes this) |
| RLS bypassed by service_role | All sync functions use service_role key | Create user-scoped Supabase clients per sync_config |

**Bottom line:** Phase A makes single-tenant robust and adds the foundation (sync_config). Phase B is required before onboarding a second user.
