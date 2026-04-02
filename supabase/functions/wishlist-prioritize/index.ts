import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { items } = await req.json();
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
        model: "claude-haiku-4-20250414",
        max_tokens: 1024,
        system: `You are a scrum master analyzing a product backlog. Given a list of wishlist items, recommend which item to work on next, suggest priority adjustments, and assess effort estimates.

Consider:
- Impact vs effort (high impact + small effort = do first)
- Bug fixes before features (bugs hurt existing users)
- Age/staleness (old items should be resolved or dropped)
- Dependencies (some features enable others)
- Effort accuracy: assess if effort estimates match the actual complexity. A feature requiring DB changes, new UI, and API work is "large". A copy change or config tweak is "small". Items with no effort estimate should get one.
- Category accuracy: a broken search or timeout is a "bug", not a "feature". A vague wish is an "idea". Only concrete, buildable work is a "feature".

Be direct and practical. The team is small.`,
        messages: [{ role: "user", content: `Here are the current backlog items:\n\n${itemsSummary}\n\nWhat should I work on next and why? Suggest any priority changes.` }],
        tools: [
          {
            name: "prioritize_backlog",
            description: "Return the recommended next item and any priority changes.",
            input_schema: {
              type: "object",
              properties: {
                next_item_id: { type: "string", description: "The ID of the item to work on next" },
                next_item_reason: { type: "string", description: "One sentence explaining why this should be next. Max 20 words." },
                priority_changes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      new_priority: { type: "string", enum: ["low", "medium", "high"] },
                      reason: { type: "string", description: "Brief reason for the change. Max 10 words." },
                    },
                    required: ["id", "new_priority", "reason"],
                  },
                  description: "Items whose priority should change. Only include items that need adjustment.",
                },
                effort_changes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      new_effort: { type: "string", enum: ["small", "medium", "large"] },
                      reason: { type: "string", description: "Brief reason for the change. Max 10 words." },
                    },
                    required: ["id", "new_effort", "reason"],
                  },
                  description: "Items whose effort estimate should change based on complexity analysis.",
                },
                category_changes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      new_category: { type: "string", enum: ["feature", "bug", "idea"] },
                      reason: { type: "string", description: "Brief reason for the change. Max 10 words." },
                    },
                    required: ["id", "new_category", "reason"],
                  },
                  description: "Items miscategorized. A broken search is a bug, not a feature. A vague suggestion is an idea, not a feature.",
                },
              },
              required: ["next_item_id", "next_item_reason", "priority_changes", "effort_changes", "category_changes"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "prioritize_backlog" },
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
    console.error("wishlist-prioritize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
