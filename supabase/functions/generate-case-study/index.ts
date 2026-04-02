import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = getUserIdFromRequest(req);
    const { rawContent, clientName, domain } = await req.json();

    if (!rawContent) {
      return new Response(JSON.stringify({ error: "rawContent is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const name = clientName || domain || "the client";

    const systemPrompt = `You are a senior strategist at GLIDE, a 22-year award-winning digital creative agency. You are structuring a case study for a client proposal.

The proposal is for: ${name} (${domain || "unknown domain"})

Given raw content about a GLIDE case study (could be text, document content, or notes), extract and structure it into a polished case study. If the content is sparse, synthesize intelligently based on what's provided.

Use the return_case_study tool to return structured data.`;

    const userPrompt = `Structure this into a case study for the ${name} proposal:

${rawContent}

Extract the company name, a one-line tagline describing what they do, key metrics (stat + label pairs), a description paragraph explaining relevance (start with "Like ${name}..."), and a "Why It Matters" paragraph tailored to ${name} explaining why this case study is relevant to their specific situation.`;

    const model = "claude-opus-4-6";
    console.log(`[generate-case-study] model=${model}, content=${rawContent.length}ch`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        thinking: { type: "enabled", budget_tokens: 10000 },
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{
          name: "return_case_study",
          description: "Return a structured case study",
          input_schema: {
            type: "object",
            properties: {
              company: { type: "string", description: "Company name" },
              tagline: { type: "string", description: "One-line italic description of what the company does" },
              metrics: {
                type: "array",
                description: "1-4 key metrics with bold stat and label",
                items: {
                  type: "object",
                  properties: {
                    stat: { type: "string", description: "Bold metric (e.g. '+299%', 'Custom', '10+ years')" },
                    label: { type: "string", description: "What the metric measures (e.g. 'Organic Traffic Growth')" },
                  },
                  required: ["stat", "label"],
                },
              },
              description: { type: "string", description: "2-4 sentence description of the work and results. Should draw parallels to the proposal client." },
              whyItMatters: { type: "string", description: "2-4 sentence 'Why It Matters' paragraph tailored to the proposal client. Direct, strategic, specific." },
            },
            required: ["company", "tagline", "metrics", "description", "whyItMatters"],
          },
        }],
        tool_choice: { type: "auto" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Anthropic API error:", response.status, text);
      throw new Error(`Anthropic API error: ${response.status} - ${text}`);
    }

    const data = await response.json();

    if (data.usage) {
      logUsage({
        user_id: userId,
        provider: "anthropic",
        model,
        edge_function: "generate-case-study",
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
      });
    }

    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse?.input) {
      return new Response(JSON.stringify({ error: "AI did not return valid case study data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[generate-case-study] complete, company=${toolUse.input.company}`);

    return new Response(JSON.stringify({ caseStudy: toolUse.input }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-case-study error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
