import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Section configurations ──────────────────────────────────────
interface SectionConfig {
  toolName: string;
  toolDescription: string;
  toolSchema: Record<string, any>;
  systemPromptExtra: string;
  budgetTokens: number;
  maxOutputTokens: number;
}

const SECTION_CONFIGS: Record<string, SectionConfig> = {
  whatWeHeard: {
    toolName: "return_what_we_heard",
    toolDescription: "Return 3 key insights synthesized from client discovery",
    toolSchema: {
      type: "object",
      properties: {
        whatWeHeard: {
          type: "array",
          description: "3 key insights from discovery. Each has a title (short theme), a quote (real or synthesized from context), and author name.",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short theme title (e.g., 'The Growth Imperative')" },
              quote: { type: "string", description: "A direct quote or synthesized insight from discovery notes" },
              author: { type: "string", description: "Attribution (person name or 'Discovery Notes')" },
            },
            required: ["title", "quote", "author"],
          },
        },
      },
      required: ["whatWeHeard"],
    },
    systemPromptExtra: `Generate the "What We Heard" section: 3 key insights from discovery conversations and client context. Each insight should have a punchy thematic title, a real or synthesized quote, and attribution. These set the tone for the entire proposal.`,
    budgetTokens: 10000,
    maxOutputTokens: 14096,
  },

  northStar: {
    toolName: "return_north_star",
    toolDescription: "Return the positioning statement and project mission",
    toolSchema: {
      type: "object",
      properties: {
        northStar: {
          type: "object",
          description: "The positioning and project mission. Be CONCISE.",
          properties: {
            position: { type: "string", description: "1 bold sentence positioning the client (max 20 words)" },
            positionDetail: { type: "string", description: "1-2 sentences max expanding on why this position matters" },
            project: { type: "string", description: "1 bold sentence defining the project mission (max 20 words)" },
            projectDetail: { type: "string", description: "1-2 sentences max explaining what the project delivers" },
          },
          required: ["position", "positionDetail", "project", "projectDetail"],
        },
      },
      required: ["northStar"],
    },
    systemPromptExtra: `Generate the "North Star" section: a bold positioning statement and project mission. The positioning statement should make the client feel seen and the project mission should be aspirational yet concrete. Each should be 1 punchy sentence max with 1-2 sentences of supporting detail.`,
    budgetTokens: 16000,
    maxOutputTokens: 20096,
  },

  measurementPlan: {
    toolName: "return_measurement_plan",
    toolDescription: "Return 4-6 KPIs that define success",
    toolSchema: {
      type: "object",
      properties: {
        measurementPlan: {
          type: "array",
          description: "4-6 KPIs. For each: a metric name, a SHORT baseline subtitle (e.g. 'From invisible to discoverable'), a target that starts with a BOLD number/metric (e.g. '45+/mo — 50% increase over current ~30/mo baseline'), and how GLIDE will move it.",
          items: {
            type: "object",
            properties: {
              metric: { type: "string", description: "KPI name (e.g., 'Demo Requests')" },
              baseline: { type: "string", description: "SHORT italic subtitle about current state (e.g., 'The number that pays the bills')" },
              target: { type: "string", description: "Start with a BOLD metric like '45+/mo' or '2-3×' or '90+' followed by a dash and supporting detail" },
              method: { type: "string", description: "2-3 sentences on how GLIDE will measure and move this metric" },
            },
            required: ["metric", "baseline", "target", "method"],
          },
        },
      },
      required: ["measurementPlan"],
    },
    systemPromptExtra: `Generate the "What Success Looks Like" measurement plan: 4-6 KPIs. Each KPI needs:
- A metric name (e.g., "Demo Requests", "Organic Traffic", "Site Performance")
- A short evocative baseline subtitle (e.g., "The number that pays the bills", "From invisible to discoverable")
- A target that STARTS with a bold number/metric (like "45+/mo", "2-3×", "90+", "<40%", "Hours") followed by supporting detail
- A method paragraph explaining how GLIDE will measure and move this metric
Make targets specific with real numbers from the client data when possible.`,
    budgetTokens: 16000,
    maxOutputTokens: 20096,
  },

  strategicFoundation: {
    toolName: "return_strategic_foundation",
    toolDescription: "Return 5C diagnostic analysis",
    toolSchema: {
      type: "object",
      properties: {
        strategicFoundation: {
          type: "array",
          description: "5C diagnostic: Climate, Competition, Customers, Company, Culture. Each category name should include a catchy subtitle (e.g., 'Climate: The Margin Protection Reality'). Each has exactly 5 SHORT bullet points.",
          items: {
            type: "object",
            properties: {
              category: { type: "string", description: "Category with subtitle (e.g., 'Climate: The Margin Protection Reality')" },
              points: { type: "array", items: { type: "string" }, description: "Exactly 5 short one-line insights (max 12 words each)" },
            },
            required: ["category", "points"],
          },
        },
      },
      required: ["strategicFoundation"],
    },
    systemPromptExtra: `Generate "The Playing Field" strategic foundation: a 5C diagnostic (Climate, Competition, Customers, Company, Culture). For each category:
- Include a catchy subtitle after the category name (e.g., "Climate: The Margin Protection Reality", "Competition: The Narrative Battleground")
- Write exactly 5 short, punchy bullet points (max 12 words each)
- Be specific to THIS client's industry and competitive landscape
- Reference real competitors, trends, and market dynamics from the context`,
    budgetTokens: 16000,
    maxOutputTokens: 20096,
  },

  whyGlide: {
    toolName: "return_why_glide",
    toolDescription: "Return 3 pillars for why GLIDE is the right partner",
    toolSchema: {
      type: "object",
      properties: {
        whyGlide: {
          type: "array",
          description: "3 pillars for why GLIDE is the right partner for THIS client",
          items: {
            type: "object",
            properties: {
              number: { type: "string" },
              title: { type: "string", description: "Catchy title in quotes (e.g., 'The Force Multiplier')" },
              subtitle: { type: "string", description: "1-2 sentence context about why this matters for the client" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Bold label ending in colon" },
                    text: { type: "string", description: "Supporting sentence" },
                  },
                  required: ["label", "text"],
                },
              },
            },
            required: ["number", "title", "subtitle", "items"],
          },
        },
      },
      required: ["whyGlide"],
    },
    systemPromptExtra: `Generate "Why GLIDE" section: 3 pillars for why GLIDE is the right partner for THIS client. Each pillar should feel tailored, not generic. Reference specific GLIDE capabilities that match the client's needs. Include catchy titles and 3 supporting items with bold labels.`,
    budgetTokens: 10000,
    maxOutputTokens: 14096,
  },

  faqs: {
    toolName: "return_faqs",
    toolDescription: "Return 5-7 client-specific FAQs with objection-handling answers",
    toolSchema: {
      type: "object",
      properties: {
        faqs: {
          type: "array",
          description: "5-7 client-specific FAQs with objection-handling answers",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              answer: { type: "string" },
            },
            required: ["question", "answer"],
          },
        },
      },
      required: ["faqs"],
    },
    systemPromptExtra: `Generate the FAQ section: 5-7 questions a skeptical client executive would ask, with strategic answers that handle objections. Base these on actual concerns from discovery notes when available. Address pricing, timeline, risk, team capacity, and competitive alternatives.`,
    budgetTokens: 10000,
    maxOutputTokens: 14096,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = getUserIdFromRequest(req);
    const { section, clientContext, ragContext, clientName, domain, priorSections } = await req.json();

    if (!section || !SECTION_CONFIGS[section]) {
      return new Response(
        JSON.stringify({ error: `Invalid section: ${section}. Valid: ${Object.keys(SECTION_CONFIGS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const config = SECTION_CONFIGS[section];
    const name = clientName || domain || "the client";

    // ── Build system prompt ──────────────────────────────────
    const systemPrompt = `You are a senior strategist at GLIDE, a 22-year-old award-winning digital creative agency in Austin, TX.

The client is: ${name} (${domain || "unknown domain"})

## Your Task
${config.systemPromptExtra}

## Tone & Style
- Confident, strategic, direct
- Write as if you're presenting to the client's executive team
- Be constructive and forward-looking, never derogatory
- Use specific data points and client quotes when available
- Avoid fluff and filler — every word should earn its place

## Output
Use the ${config.toolName} tool to return structured data.`;

    // ── Build user prompt with context + prior sections ──────
    let userPrompt = `Generate the ${section} section for ${name}.

${clientContext ? `## Hard Data (from website analysis)\n${clientContext}` : "## No hard data available."}

${ragContext ? `## Client Context (from meetings, emails, documents, HubSpot)\n${ragContext}` : "## No qualitative context available."}`;

    if (priorSections && Object.keys(priorSections).length > 0) {
      userPrompt += `\n\n## Previously Generated Sections (for coherence)\n${JSON.stringify(priorSections, null, 2)}`;
    }

    // ── Call Claude Opus with extended thinking ──────────────
    const model = "claude-opus-4-6";
    console.log(`[generate-proposal-section] section=${section}, model=${model}, budgetTokens=${config.budgetTokens}`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: config.maxOutputTokens,
        thinking: { type: "enabled", budget_tokens: config.budgetTokens },
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{
          name: config.toolName,
          description: config.toolDescription,
          input_schema: config.toolSchema,
        }],
        tool_choice: { type: "tool", name: config.toolName },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Anthropic API error:", response.status, text);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();

    // Log usage
    if (data.usage) {
      logUsage({
        user_id: userId,
        provider: "anthropic",
        model,
        edge_function: `generate-proposal-section:${section}`,
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
      });
    }

    // Extract tool output
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse?.input) {
      return new Response(
        JSON.stringify({ error: "AI did not return valid section data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-proposal-section] section=${section} complete, input_tokens=${data.usage?.input_tokens}, output_tokens=${data.usage?.output_tokens}`);

    return new Response(JSON.stringify({
      section,
      data: toolUse.input,
      usage: data.usage,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-proposal-section error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
