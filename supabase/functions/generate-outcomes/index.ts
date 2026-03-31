import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = getUserIdFromRequest(req);
    const { optionName, serviceNames } = await req.json();

    if (!serviceNames || !Array.isArray(serviceNames) || serviceNames.length === 0) {
      return new Response(
        JSON.stringify({ outcomes: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const count = serviceNames.length;

    const prompt = `You are a digital agency strategist. Given the following ${count} services included in an investment option called "${optionName}", generate exactly ${count} concise, compelling business outcomes — one outcome per service, in the same order. Each outcome should be one short sentence (under 12 words), action-oriented, and specific to that service. Do not use generic marketing speak.

Services:
${serviceNames.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}`;

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
        system: `You return exactly ${count} business outcomes in order, one per service. Use the return_outcomes tool — no other text.`,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: "return_outcomes",
            description: `Return exactly ${count} business outcomes, one per service`,
            input_schema: {
              type: "object",
              properties: {
                outcomes: {
                  type: "array",
                  items: { type: "string" },
                  description: `Exactly ${count} outcomes, one per service in order`,
                },
              },
              required: ["outcomes"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "return_outcomes" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("Anthropic API error:", response.status, text);
      throw new Error("Anthropic API error");
    }

    const data = await response.json();

    // Log usage
    const usage = data.usage;
    if (usage) {
      logUsage({
        user_id: userId,
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        edge_function: "generate-outcomes",
        prompt_tokens: usage.input_tokens,
        completion_tokens: usage.output_tokens,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      });
    }

    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (toolUse?.input?.outcomes) {
      return new Response(JSON.stringify({ outcomes: toolUse.input.outcomes }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ outcomes: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-outcomes error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
