/**
 * Shared AI usage logging utility.
 * Fire-and-forget: never blocks the main response.
 *
 * Usage in an edge function:
 *   import { logUsage, extractOpenAIUsage, extractGeminiNativeUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";
 *
 *   const userId = getUserIdFromRequest(req);
 *   const usage = extractOpenAIUsage(data);
 *   logUsage({ ...usage, user_id: userId, provider: 'gemini', model: 'gemini-2.5-flash', edge_function: 'ai-outline' });
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface UsageEntry {
  user_id?: string | null;
  provider: string;          // 'anthropic', 'gemini', 'openai', 'perplexity'
  model: string;
  edge_function: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  session_id?: string | null;
  is_streaming?: boolean;
  duration_ms?: number;
  error?: string | null;
}

let _sb: ReturnType<typeof createClient> | null = null;

function getServiceClient() {
  if (!_sb) {
    _sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _sb;
}

/**
 * Decode the JWT from the Authorization header to get user_id.
 * Pure base64 decode — no network call, no verification.
 */
export function getUserIdFromRequest(req: Request): string | null {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token || token.length < 10) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // base64url decode the payload
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        ),
      ),
    );
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget insert into ai_usage_log.
 * Never throws — catches and logs errors internally.
 */
export function logUsage(entry: UsageEntry): void {
  const sb = getServiceClient();
  sb.from("ai_usage_log")
    .insert({
      user_id: entry.user_id || null,
      provider: entry.provider,
      model: entry.model,
      edge_function: entry.edge_function,
      prompt_tokens: entry.prompt_tokens || 0,
      completion_tokens: entry.completion_tokens || 0,
      total_tokens: entry.total_tokens || (entry.prompt_tokens || 0) + (entry.completion_tokens || 0),
      session_id: entry.session_id || null,
      is_streaming: entry.is_streaming || false,
      duration_ms: entry.duration_ms || null,
      error: entry.error || null,
    })
    .then(({ error }) => {
      if (error) console.warn("[usage-logger] insert failed:", error.message);
    });
}

/**
 * Extract usage from OpenAI-compatible response (Gemini gateway, OpenAI, Perplexity).
 * Reads data.usage.prompt_tokens / completion_tokens.
 */
export function extractOpenAIUsage(data: any): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
  const usage = data?.usage;
  if (!usage) return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  return {
    prompt_tokens: usage.prompt_tokens || 0,
    completion_tokens: usage.completion_tokens || 0,
    total_tokens: usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
  };
}

/**
 * Extract usage from native Gemini API response.
 * Reads data.usageMetadata.promptTokenCount / candidatesTokenCount.
 */
export function extractGeminiNativeUsage(data: any): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
  const meta = data?.usageMetadata;
  if (!meta) return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  return {
    prompt_tokens: meta.promptTokenCount || 0,
    completion_tokens: meta.candidatesTokenCount || 0,
    total_tokens: meta.totalTokenCount || (meta.promptTokenCount || 0) + (meta.candidatesTokenCount || 0),
  };
}
