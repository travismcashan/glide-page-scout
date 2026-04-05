/**
 * Shared OAuth Token Refresh Utility
 * Proactive token refresh for all OAuth providers (Harvest, Google, etc.)
 * Single source of truth — replaces duplicated refresh logic across 10+ functions.
 */

// ── Types ──

export interface OAuthConnection {
  id: string;
  provider: string;
  provider_email: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  scopes: string | null;
  provider_config: Record<string, any> | null;
}

interface TokenEndpointConfig {
  url: string;
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  /** How early before expiry to trigger refresh */
  refreshBufferMs: number;
}

export interface ValidToken {
  accessToken: string;
  connection: OAuthConnection;
}

// ── Provider Configurations ──

const PROVIDER_CONFIGS: Record<string, TokenEndpointConfig> = {
  harvest: {
    url: "https://id.getharvest.com/api/v2/oauth2/token",
    clientIdEnvVar: "HARVEST_CLIENT_ID",
    clientSecretEnvVar: "HARVEST_CLIENT_SECRET",
    refreshBufferMs: 24 * 60 * 60 * 1000, // 1 day buffer (14-day tokens)
  },
  "google-analytics": {
    url: "https://oauth2.googleapis.com/token",
    clientIdEnvVar: "GOOGLE_CLIENT_ID",
    clientSecretEnvVar: "GOOGLE_CLIENT_SECRET",
    refreshBufferMs: 5 * 60 * 1000, // 5 min buffer (1-hour tokens)
  },
  "google-search-console": {
    url: "https://oauth2.googleapis.com/token",
    clientIdEnvVar: "GOOGLE_CLIENT_ID",
    clientSecretEnvVar: "GOOGLE_CLIENT_SECRET",
    refreshBufferMs: 5 * 60 * 1000,
  },
  gmail: {
    url: "https://oauth2.googleapis.com/token",
    clientIdEnvVar: "GOOGLE_CLIENT_ID",
    clientSecretEnvVar: "GOOGLE_CLIENT_SECRET",
    refreshBufferMs: 5 * 60 * 1000,
  },
  "google-drive": {
    url: "https://oauth2.googleapis.com/token",
    clientIdEnvVar: "GOOGLE_CLIENT_ID",
    clientSecretEnvVar: "GOOGLE_CLIENT_SECRET",
    refreshBufferMs: 5 * 60 * 1000,
  },
};

// ── Main Function ──

/**
 * Get a valid access token for a provider.
 * Refreshes proactively if within buffer window of expiry.
 *
 * @param supabase - Supabase client (service role recommended)
 * @param provider - Provider name matching oauth_connections.provider
 * @param providerEmail - Optional email filter (for providers with multiple connections)
 * @returns ValidToken with fresh access token and full connection record, or null if no connection found
 */
export async function getValidToken(
  supabase: any,
  provider: string,
  providerEmail?: string
): Promise<ValidToken | null> {
  // 1. Load connection from DB
  let query = supabase
    .from("oauth_connections")
    .select("*")
    .eq("provider", provider)
    .order("updated_at", { ascending: false });

  if (providerEmail) {
    query = query.eq("provider_email", providerEmail);
  }

  const { data: connections } = await query.limit(1);
  const conn = connections?.[0] as OAuthConnection | undefined;
  if (!conn) {
    console.log(`[oauth-refresh] No ${provider} connection found in oauth_connections`);
    return null;
  }

  // 2. Check if refresh is needed
  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    // Unknown provider — return token as-is (no refresh logic, e.g. Slack)
    return { accessToken: conn.access_token, connection: conn };
  }

  const expiresAt = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime()
    : 0;

  if (expiresAt > 0 && Date.now() < expiresAt - config.refreshBufferMs) {
    // Token is still fresh
    return { accessToken: conn.access_token, connection: conn };
  }

  // 3. Token is expired or about to expire — refresh it
  console.log(
    `[oauth-refresh] Refreshing ${provider} token (expires: ${conn.token_expires_at || "unknown"})`
  );

  const clientId = Deno.env.get(config.clientIdEnvVar);
  const clientSecret = Deno.env.get(config.clientSecretEnvVar);

  if (!clientId || !clientSecret) {
    console.error(
      `[oauth-refresh] Cannot refresh ${provider}: missing ${config.clientIdEnvVar} or ${config.clientSecretEnvVar}`
    );
    return { accessToken: conn.access_token, connection: conn };
  }

  if (!conn.refresh_token) {
    console.error(
      `[oauth-refresh] Cannot refresh ${provider}: no refresh_token stored`
    );
    return { accessToken: conn.access_token, connection: conn };
  }

  let tokenData: any;
  try {
    const tokenRes = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error(
        `[oauth-refresh] ${provider} refresh failed (${tokenRes.status}):`,
        JSON.stringify(tokenData)
      );
      return { accessToken: conn.access_token, connection: conn };
    }
  } catch (err) {
    console.error(`[oauth-refresh] ${provider} refresh network error:`, err);
    return { accessToken: conn.access_token, connection: conn };
  }

  // 4. Update stored tokens
  // CRITICAL for Harvest: refresh_token rotates on every refresh.
  // If DB update fails after getting new tokens, log the new token so it can be recovered.
  const newExpiresAt = new Date(
    Date.now() + (tokenData.expires_in || 3600) * 1000
  ).toISOString();

  const updates: Record<string, any> = {
    access_token: tokenData.access_token,
    token_expires_at: newExpiresAt,
  };

  // Store new refresh_token if provider rotates it (Harvest does, Google usually doesn't)
  if (tokenData.refresh_token) {
    updates.refresh_token = tokenData.refresh_token;
  }

  try {
    await supabase
      .from("oauth_connections")
      .update(updates)
      .eq("id", conn.id);

    console.log(
      `[oauth-refresh] ${provider} token refreshed successfully, expires: ${newExpiresAt}`
    );
  } catch (dbErr) {
    // Log new token so it can be manually recovered if DB write fails
    console.error(
      `[oauth-refresh] CRITICAL: ${provider} token refreshed but DB update FAILED. ` +
        `New access_token starts with: ${tokenData.access_token?.slice(0, 8)}... ` +
        `New refresh_token starts with: ${tokenData.refresh_token?.slice(0, 8) || "N/A"}...`,
      dbErr
    );
  }

  const updatedConn: OAuthConnection = {
    ...conn,
    access_token: tokenData.access_token,
    token_expires_at: newExpiresAt,
    ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
  };

  return { accessToken: tokenData.access_token, connection: updatedConn };
}

/**
 * Check if a provider's token is expired or about to expire.
 * Useful for health checks without triggering a refresh.
 */
export function tokenStatus(
  connection: OAuthConnection
): { isExpired: boolean; daysUntilExpiry: number | null; needsRefresh: boolean } {
  const config = PROVIDER_CONFIGS[connection.provider];
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;

  if (expiresAt === 0) {
    return { isExpired: false, daysUntilExpiry: null, needsRefresh: false };
  }

  const now = Date.now();
  const msUntilExpiry = expiresAt - now;
  const daysUntilExpiry = Math.round((msUntilExpiry / (1000 * 60 * 60 * 24)) * 10) / 10;
  const isExpired = msUntilExpiry <= 0;
  const needsRefresh = config
    ? msUntilExpiry <= config.refreshBufferMs
    : isExpired;

  return { isExpired, daysUntilExpiry, needsRefresh };
}
