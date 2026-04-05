# Plan: Harvest OAuth Token Refresh Automation

## Research Findings

### Current Harvest Token Storage

Harvest credentials are stored as **Supabase edge function secrets** (environment variables), NOT in the `oauth_connections` table:

- `HARVEST_ACCESS_TOKEN` — OAuth2 access token (14-day expiry)
- `HARVEST_ACCOUNT_ID` — Harvest account identifier

**6 edge functions** read these env vars directly:
| Function | Usage |
|----------|-------|
| `global-sync` | Fetch all Harvest clients/projects |
| `harvest-sync` | Batch sync Harvest data |
| `harvest-lookup` | On-demand time entries, projects, invoices |
| `company-artifacts` | Per-company project/time/invoice fetching |
| `integration-health` | Health check via `/users/me` |
| `api-proxy` | Generic Harvest API proxy |

None of these functions have any refresh logic. When the token expires (every 14 days), **all Harvest integrations silently fail** until someone manually refreshes the token and updates the Supabase secret.

### How Google OAuth Handles Refresh (Existing Pattern)

Google OAuth connections use the `oauth_connections` table with proactive refresh:

```
oauth_connections
├── provider: 'google-analytics' | 'google-search-console' | 'gmail' | etc.
├── access_token: short-lived (1 hour)
├── refresh_token: long-lived
├── token_expires_at: timestamp
└── provider_email: identifier
```

**Refresh pattern** (duplicated in 8+ functions — ga4-lookup, gmail-lookup, search-console-lookup, google-drive-list, google-drive-download, google-doc-export, google-drive-picker, analytics-query):

```ts
// Proactive: refresh 5 min before expiry
if (Date.now() >= expiresAt - 5 * 60 * 1000) {
  // POST to https://oauth2.googleapis.com/token with refresh_token
  // Update oauth_connections with new access_token + token_expires_at
  // Store new refresh_token if returned
}
```

**Problem:** This refresh logic is copy-pasted across 8+ files. No shared utility.

### Harvest OAuth2 Refresh Flow

**Token endpoint:** `https://id.getharvest.com/api/v2/oauth2/token`

**Request:**
```
POST https://id.getharvest.com/api/v2/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&client_id=HARVEST_CLIENT_ID
&client_secret=HARVEST_CLIENT_SECRET
&refresh_token=STORED_REFRESH_TOKEN
```

**Response:** `{ access_token, refresh_token, token_type: "bearer", expires_in: 1209600 }`

- Access token lifetime: **14 days** (1,209,600 seconds)
- **Refresh token rotates** — new refresh_token in every response, must be stored
- No special headers required

### Slack OAuth Comparison

Slack uses `oauth_connections` table but with a **non-expiring token** (Slack bot tokens don't expire). No refresh logic needed. Stored via `slack-oauth-exchange` function.

### What Needs to Change

Currently Harvest is the **only OAuth integration stored as a static env var** instead of in `oauth_connections`. This means:
1. No automatic refresh — manual intervention every 14 days
2. No expiry tracking — fails silently
3. No health monitoring beyond integration-health's binary check
4. Token update requires Supabase Dashboard → Edge Function Secrets → manual paste

### Required Supabase Secrets (new)

- `HARVEST_CLIENT_ID` — needed for OAuth refresh (not currently stored)
- `HARVEST_CLIENT_SECRET` — needed for OAuth refresh (not currently stored)

These are distinct from `HARVEST_ACCESS_TOKEN` and `HARVEST_ACCOUNT_ID`.

## Recommendation

### Strategy: Migrate Harvest to oauth_connections + Shared Refresh Utility

1. **Store Harvest credentials in `oauth_connections`** — same pattern as Google
2. **Create shared `_shared/oauth-refresh.ts`** — eliminates duplication across all OAuth functions (Google + Harvest)
3. **All Harvest functions read from `oauth_connections`** instead of env vars
4. **Proactive refresh** — check expiry before every API call, refresh if within 1 day of expiry (conservative for 14-day tokens)
5. **Env var fallback** — keep reading `HARVEST_ACCESS_TOKEN` as fallback during migration

### Why Proactive (Not Reactive)

- **Reactive (on 401):** Simpler, but the failed request is lost. Must retry after refresh. Some Harvest endpoints are paginated — a 401 mid-pagination loses progress.
- **Proactive (before expiry):** Check `token_expires_at` before making any call. One extra DB read, but no failed requests. Matches existing Google pattern.

Given 14-day token lifetime, proactive with a 1-day buffer is safe (refresh when <1 day remaining).

## Implementation Steps

### Phase 1: Shared OAuth Refresh Utility

- [ ] **Step 1: Create `_shared/oauth-refresh.ts`**
  ```ts
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

  interface OAuthConnection {
    id: string;
    provider: string;
    provider_email: string | null;
    access_token: string;
    refresh_token: string;
    token_expires_at: string | null;
    scopes: string | null;
    provider_config?: any;
  }

  interface TokenEndpointConfig {
    url: string;
    clientIdEnvVar: string;
    clientSecretEnvVar: string;
    refreshBufferMs: number; // how early to refresh before expiry
  }

  const PROVIDER_CONFIGS: Record<string, TokenEndpointConfig> = {
    'google-analytics': {
      url: 'https://oauth2.googleapis.com/token',
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      refreshBufferMs: 5 * 60 * 1000, // 5 min (1-hour tokens)
    },
    'google-search-console': {
      url: 'https://oauth2.googleapis.com/token',
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      refreshBufferMs: 5 * 60 * 1000,
    },
    'gmail': {
      url: 'https://oauth2.googleapis.com/token',
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      refreshBufferMs: 5 * 60 * 1000,
    },
    'google-drive': {
      url: 'https://oauth2.googleapis.com/token',
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      refreshBufferMs: 5 * 60 * 1000,
    },
    'harvest': {
      url: 'https://id.getharvest.com/api/v2/oauth2/token',
      clientIdEnvVar: 'HARVEST_CLIENT_ID',
      clientSecretEnvVar: 'HARVEST_CLIENT_SECRET',
      refreshBufferMs: 24 * 60 * 60 * 1000, // 1 day (14-day tokens)
    },
  };

  /**
   * Get a valid access token for a provider.
   * Refreshes proactively if within buffer window of expiry.
   * Returns { accessToken, accountId?, config? } or null on failure.
   */
  export async function getValidToken(
    supabase: any,
    provider: string,
    providerEmail?: string
  ): Promise<{ accessToken: string; connection: OAuthConnection } | null> {
    // 1. Load connection from DB
    let query = supabase.from('oauth_connections').select('*').eq('provider', provider);
    if (providerEmail) query = query.eq('provider_email', providerEmail);
    const { data: connections } = await query.limit(1);
    const conn = connections?.[0] as OAuthConnection | undefined;
    if (!conn) return null;

    // 2. Check if refresh needed
    const config = PROVIDER_CONFIGS[provider];
    if (!config) return { accessToken: conn.access_token, connection: conn };

    const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
    if (expiresAt > 0 && Date.now() < expiresAt - config.refreshBufferMs) {
      return { accessToken: conn.access_token, connection: conn };
    }

    // 3. Refresh the token
    console.log(`[oauth-refresh] Refreshing ${provider} token (expires: ${conn.token_expires_at})`);
    const clientId = Deno.env.get(config.clientIdEnvVar);
    const clientSecret = Deno.env.get(config.clientSecretEnvVar);

    if (!clientId || !clientSecret || !conn.refresh_token) {
      console.error(`[oauth-refresh] Cannot refresh ${provider}: missing credentials`);
      return { accessToken: conn.access_token, connection: conn }; // return stale token, let caller handle 401
    }

    const tokenRes = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error(`[oauth-refresh] ${provider} refresh failed:`, tokenData);
      return { accessToken: conn.access_token, connection: conn };
    }

    // 4. Update stored tokens
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
    await supabase.from('oauth_connections').update({
      access_token: tokenData.access_token,
      token_expires_at: newExpiresAt,
      ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
    }).eq('id', conn.id);

    console.log(`[oauth-refresh] ${provider} token refreshed, expires: ${newExpiresAt}`);
    return {
      accessToken: tokenData.access_token,
      connection: { ...conn, access_token: tokenData.access_token, token_expires_at: newExpiresAt },
    };
  }
  ```

### Phase 2: Migrate Harvest to oauth_connections

- [ ] **Step 2: Add `provider_config` JSONB column to oauth_connections** (if not already present)
  ```sql
  ALTER TABLE public.oauth_connections
    ADD COLUMN IF NOT EXISTS provider_config JSONB DEFAULT '{}'::jsonb;
  ```
  This stores Harvest-specific data like `account_id` that isn't part of the standard OAuth flow.

- [ ] **Step 3: Create `harvest-oauth-exchange` edge function**
  New function that handles:
  - `action: 'get-config'` — returns HARVEST_CLIENT_ID
  - `action: 'exchange'` — exchanges auth code for tokens, stores in oauth_connections with `provider_config: { account_id }`
  - `action: 'status'` — returns connection status + expiry info

- [ ] **Step 4: Seed oauth_connections with current Harvest token**
  One-time migration (run via SQL editor):
  ```sql
  INSERT INTO public.oauth_connections (
    provider, provider_email, access_token, refresh_token,
    token_expires_at, provider_config
  ) VALUES (
    'harvest',
    'travis@glidecreative.com',
    current_setting('app.settings.harvest_access_token', true),
    '<HARVEST_REFRESH_TOKEN>',  -- must be provided manually
    now() + interval '14 days',
    jsonb_build_object('account_id', current_setting('app.settings.harvest_account_id', true))
  );
  ```
  **Note:** The refresh_token must be obtained from the original OAuth flow or by re-authorizing. Check if it was saved anywhere during initial setup.

### Phase 3: Update Harvest Functions to Use oauth_connections

- [ ] **Step 5: Create `_shared/harvest-token.ts` convenience wrapper**
  ```ts
  import { getValidToken } from "./oauth-refresh.ts";

  export async function getHarvestCredentials(supabase: any): Promise<{
    accessToken: string;
    accountId: string;
  } | null> {
    // Try oauth_connections first
    const result = await getValidToken(supabase, 'harvest');
    if (result) {
      const accountId = result.connection.provider_config?.account_id;
      if (accountId) return { accessToken: result.accessToken, accountId };
    }

    // Fallback to env vars (migration period)
    const envToken = Deno.env.get('HARVEST_ACCESS_TOKEN');
    const envAccountId = Deno.env.get('HARVEST_ACCOUNT_ID');
    if (envToken && envAccountId) {
      console.warn('[harvest-token] Using env var fallback — migrate to oauth_connections');
      return { accessToken: envToken, accountId: envAccountId };
    }

    return null;
  }
  ```

- [ ] **Step 6: Update all 6 Harvest functions**
  Replace direct env var reads with shared utility:
  
  | Function | Change |
  |----------|--------|
  | `global-sync` | `getHarvestCredentials(supabase)` replaces `Deno.env.get('HARVEST_ACCESS_TOKEN')` (line 515-516) |
  | `harvest-sync` | Same (line 334-336) |
  | `harvest-lookup` | Same (line 16-17), needs supabase client creation |
  | `company-artifacts` | Same �� `getHarvestHeaders()` helper (line 138-147) |
  | `integration-health` | Same (line 75-76), also report token expiry |
  | `api-proxy` | Same (line 19-20) |

### Phase 4: Update Google Functions to Use Shared Utility (Bonus — Dedup)

- [ ] **Step 7: Update Google OAuth functions to use `getValidToken()`**
  Replace duplicated refresh logic in 8 functions:
  - `ga4-lookup` — ~40 lines of refresh code → 1 call
  - `gmail-lookup` — same
  - `search-console-lookup` — same
  - `google-drive-list` — same
  - `google-drive-download` — same
  - `google-doc-export` — same
  - `google-drive-picker` — same
  - `analytics-query` — same

### Phase 5: Monitoring + Frontend

- [ ] **Step 8: Add token expiry to integration-health**
  ```ts
  async function checkHarvest(): Promise<HealthResult> {
    const { data: conn } = await supabase
      .from('oauth_connections')
      .select('token_expires_at')
      .eq('provider', 'harvest')
      .single();
    
    const expiresAt = conn?.token_expires_at ? new Date(conn.token_expires_at) : null;
    const daysUntilExpiry = expiresAt ? (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24) : null;
    
    // ... existing health check ...
    return {
      ...result,
      tokenExpiresAt: conn?.token_expires_at,
      daysUntilExpiry: daysUntilExpiry ? Math.round(daysUntilExpiry * 10) / 10 : null,
      tokenWarning: daysUntilExpiry !== null && daysUntilExpiry < 3,
    };
  }
  ```

- [ ] **Step 9: Add Harvest OAuth connect button to Connections page** (future)
  Currently Harvest is connected via manually-pasted env vars. Add a proper OAuth flow button like Google/Slack have.

- [ ] **Step 10: pg_cron proactive refresh job** (optional)
  Schedule a daily job that refreshes any token expiring within 2 days:
  ```sql
  SELECT cron.schedule('refresh-expiring-tokens', '0 6 * * *',
    $$SELECT public.invoke_edge_function('token-refresh', '{"source":"pg_cron"}'::jsonb)$$);
  ```
  With a new `token-refresh` edge function that iterates all oauth_connections and refreshes any within buffer window.

## Affected Files

### New Files
- **`supabase/functions/_shared/oauth-refresh.ts`** — shared token refresh utility (all providers)
- **`supabase/functions/_shared/harvest-token.ts`** — Harvest convenience wrapper with env var fallback
- **`supabase/functions/harvest-oauth-exchange/index.ts`** — Harvest OAuth code exchange

### Modified Files
- **`supabase/migrations/NEW.sql`** — add `provider_config` column to oauth_connections
- **`supabase/functions/global-sync/index.ts`** — use `getHarvestCredentials()` (lines 515-516)
- **`supabase/functions/harvest-sync/index.ts`** — use `getHarvestCredentials()` (lines 334-336)
- **`supabase/functions/harvest-lookup/index.ts`** — use `getHarvestCredentials()` (lines 16-17)
- **`supabase/functions/company-artifacts/index.ts`** — use `getHarvestCredentials()` (lines 138-147)
- **`supabase/functions/integration-health/index.ts`** — use `getHarvestCredentials()` + expiry reporting (lines 75-76)
- **`supabase/functions/api-proxy/index.ts`** — use `getHarvestCredentials()` (lines 19-20)
- **`supabase/functions/ga4-lookup/index.ts`** — replace inline refresh with `getValidToken()` (Phase 4)
- **`supabase/functions/gmail-lookup/index.ts`** — same
- **`supabase/functions/search-console-lookup/index.ts`** — same
- **`supabase/functions/google-drive-list/index.ts`** — same
- **`supabase/functions/google-drive-download/index.ts`** — same
- **`supabase/functions/google-doc-export/index.ts`** — same
- **`supabase/functions/google-drive-picker/index.ts`** — same
- **`supabase/functions/analytics-query/index.ts`** — same

## Dependencies

1. **Harvest refresh_token must be obtained.** The current setup only stores the access_token as an env var. The refresh_token from the original OAuth authorization flow must be found or re-obtained by re-authorizing Harvest. Check if it was saved in notes, 1Password, or the Harvest developer portal.

2. **`HARVEST_CLIENT_ID` and `HARVEST_CLIENT_SECRET`** must be added to Supabase edge function secrets. These are from the Harvest OAuth2 app registered at `https://id.getharvest.com/developers`.

3. **`provider_config` column** must be added to `oauth_connections` before Harvest can store its account_id there.

4. **No dependency on other Tier 0/1 tasks.** This is independent.

## Risks

1. **Missing refresh_token** — The biggest risk. If the original refresh_token was never saved, Harvest must be re-authorized through the full OAuth flow. This requires the `harvest-oauth-exchange` function (Step 3) and a frontend connect button (Step 9). Workaround: manually run the OAuth flow via curl/Postman against `https://id.getharvest.com/oauth2/authorize` and capture the refresh_token.

2. **Refresh token rotation** — Harvest rotates refresh_tokens on every refresh. If a refresh succeeds but the DB update fails (edge function crash between token response and DB write), the old refresh_token is invalidated and the new one is lost. Mitigation: wrap the refresh+update in a try/catch that logs the new token even on DB failure.

3. **Env var fallback during migration** — During the transition period, some functions may read from oauth_connections while others still read env vars. The `getHarvestCredentials()` wrapper handles this with explicit fallback, but the env var token will eventually expire and not be refreshed.

4. **Google refresh dedup (Phase 4) blast radius** — Replacing refresh logic in 8 Google functions at once is risky. Each function has slightly different error handling. Recommend: update one function first (ga4-lookup), verify, then batch-update the rest.

5. **Clock skew** — Proactive refresh depends on `Date.now()` matching the token's actual expiry. Edge function execution environments generally have accurate clocks, but a 1-day buffer for 14-day tokens gives plenty of margin.
