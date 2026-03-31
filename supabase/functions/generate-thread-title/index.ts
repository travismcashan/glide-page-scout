import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logUsage, extractOpenAIUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userMessage, assistantReply } = await req.json();
    if (!userMessage) {
      return new Response(JSON.stringify({ error: "userMessage is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const truncatedUser = userMessage.slice(0, 500);
    const truncatedReply = (assistantReply || "").slice(0, 500);

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Generate a concise 3-6 word title summarizing this conversation. Rules: no quotes, no punctuation at end, max 35 characters, lowercase except proper nouns. Return ONLY the title, nothing else.",
          },
          {
            role: "user",
            content: `User asked: ${truncatedUser}\n\nAssistant replied: ${truncatedReply}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const userId = getUserIdFromRequest(req);
    const usage = extractOpenAIUsage(data);
    logUsage({ ...usage, user_id: userId, provider: 'gemini', model: 'gemini-2.5-flash-lite', edge_function: 'generate-thread-title' });

    let title = data.choices?.[0]?.message?.content?.trim() || "";
    
    // Clean up: remove quotes, trailing punctuation
    title = title.replace(/^["']|["']$/g, "").replace(/[.!?]+$/, "").trim();
    
    // Cap at 35 chars
    if (title.length > 35) {
      title = title.slice(0, 35).replace(/\s\S*$/, "").trim();
    }

    return new Response(JSON.stringify({ title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-thread-title error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
