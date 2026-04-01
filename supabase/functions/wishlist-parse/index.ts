import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { rawInput } = await req.json();
    if (!rawInput || typeof rawInput !== "string" || rawInput.trim().length === 0) {
      return new Response(JSON.stringify({ error: "rawInput is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

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
        system: "You are a product manager assistant. The user will describe ideas, feature requests, bugs, or thoughts in plain language. Break them into distinct, actionable items. Be concise but specific. For feedback from the app, context like [Element: ...] and [Page: ...] may be included — use these to make descriptions more specific.",
        messages: [{ role: "user", content: rawInput }],
        tools: [
          {
            name: "create_wishlist_items",
            description: "Create structured wishlist items from the user input.",
            input_schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Short, actionable title (under 80 chars)" },
                      description: { type: "string", description: "Brief description of what this entails" },
                      category: { type: "string", enum: ["feature", "bug", "idea"] },
                      priority: { type: "string", enum: ["low", "medium", "high"] },
                      effort_estimate: { type: "string", enum: ["small", "medium", "large"] },
                    },
                    required: ["title", "description", "category", "priority", "effort_estimate"],
                  },
                },
              },
              required: ["items"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "create_wishlist_items" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Anthropic API error:", status, text);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Anthropic tool use: find the tool_use content block
    const toolUse = data.content?.find((b: any) => b.type === "tool_use");
    if (!toolUse?.input) {
      return new Response(JSON.stringify({ error: "AI did not return structured items" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wishlist-parse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
