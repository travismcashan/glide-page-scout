/**
 * Shared user_id resolution for sync edge functions.
 *
 * Priority chain:
 * 1. JWT from Authorization header (real user, not service_role)
 * 2. Explicit userId from request body
 * 3. sync_config table (for pg_cron / automation)
 * 4. Fallback: first company row (current behavior, with warning)
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
      } catch {
        // JWT decode failed — fall through to next method
      }
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
  console.warn(
    "[resolve-user] Falling back to first company user_id — configure sync_config for production use"
  );
  const { data: firstCompany } = await supabase
    .from("companies")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(1)
    .single();
  if (firstCompany?.user_id) return firstCompany.user_id;

  throw new Error(
    "Cannot resolve user_id — no sync_config, no companies. Run global-sync with explicit userId first."
  );
}
