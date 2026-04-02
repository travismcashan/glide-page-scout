import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const items = body?.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "items array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const itemsSummary = items.map((i: any, idx: number) =>
      `${idx + 1}. [${i.id}] "${i.title}" — ${i.category}, ${i.priority} priority, effort: ${i.effort_estimate || 'unknown'}, status: ${i.status}, age: ${Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86400000)}d`
    ).join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: `You are a sprint planning advisor for a small product team (1-2 developers). Given a product backlog, recommend 2-3 items that should be worked on in the next sprint.

Pick items that:
- Maximize impact as a group (e.g. a bug fix + the feature it unblocks)
- Fit within a realistic sprint (total effort should be 1 large + 1 small, or 2-3 medium/small items)
- Prioritize bugs over features when severity is similar
- Consider dependencies between items
- Only recommend items in "wishlist" or "planned" status (not in-progress or done)

Be direct. Explain why these items work well together as a sprint.`,
        messages: [{ role: "user", content: `Here is the current backlog:\n\n${itemsSummary}\n\nRecommend 2-3 items for the next sprint.` }],
        tools: [
          {
            name: "recommend_sprint",
            description: "Return 2-3 recommended items for the next sprint.",
            input_schema: {
              type: "object",
              properties: {
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "The item ID" },
                      reason: { type: "string", description: "Why this item should be in the sprint. Max 15 words." },
                    },
                    required: ["id", "reason"],
                  },
                  description: "2-3 items recommended for the next sprint.",
                  minItems: 2,
                  maxItems: 3,
                },
                sprint_summary: { type: "string", description: "One sentence describing the sprint theme or goal. Max 20 words." },
              },
              required: ["recommendations", "sprint_summary"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "recommend_sprint" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Anthropic API error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolUse = data.content?.find((b: any) => b.type === "tool_use");
    if (!toolUse?.input) {
      return new Response(JSON.stringify({ error: "AI did not return recommendations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wishlist-recommend error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
