import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getUserIdFromRequest(req: Request): string | null {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token || token.length < 10) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
    return payload.sub || null;
  } catch { return null; }
}

function logUsage(entry: any): void {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    sb.from("ai_usage_log").insert({
      user_id: entry.user_id || null, provider: entry.provider, model: entry.model,
      edge_function: entry.edge_function, prompt_tokens: entry.prompt_tokens || 0,
      completion_tokens: entry.completion_tokens || 0, total_tokens: entry.total_tokens || 0,
    }).then(({ error }) => { if (error) console.warn("[usage-logger]", error.message); });
  } catch {}
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = getUserIdFromRequest(req);
    const { sessionId, domain, companyName } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Gather all client context ──────────────────────────────
    let clientContext = "";
    try {
      const { data: session } = await supabase.from("crawl_sessions").select("prospect_domain, observations_data, semrush_data, ga4_data, psi_data, tech_analysis_data").eq("id", sessionId).maybeSingle();
      if (session) {
        const parts: string[] = [];
        if (session.prospect_domain) parts.push(`Client website: ${session.prospect_domain}`);
        if (session.observations_data) {
          const obs = typeof session.observations_data === "string" ? JSON.parse(session.observations_data) : session.observations_data;
          if (obs.northStar) parts.push(`North Star: ${obs.northStar}`);
          if (obs.keysToSuccess?.length) parts.push(`Keys to Success:\n${obs.keysToSuccess.map((k: string) => `- ${k}`).join("\n")}`);
          if (obs.strategies?.length) parts.push(`Strategic Priorities:\n${obs.strategies.map((s: string) => `- ${s}`).join("\n")}`);
          if (obs.recommendations?.length) parts.push(`Top Recommendations:\n${obs.recommendations.slice(0, 8).map((r: string) => `- ${r}`).join("\n")}`);
          if (obs.insights?.length) parts.push(`Key Insights:\n${obs.insights.slice(0, 8).map((i: string) => `- ${i}`).join("\n")}`);
        }
        if (session.semrush_data) {
          const sem = typeof session.semrush_data === "string" ? JSON.parse(session.semrush_data) : session.semrush_data;
          const m: string[] = [];
          if (sem.organic_keywords) m.push(`${sem.organic_keywords} organic keywords`);
          if (sem.organic_traffic) m.push(`${sem.organic_traffic} monthly organic traffic`);
          if (sem.authority_score) m.push(`Authority score: ${sem.authority_score}`);
          if (m.length) parts.push(`SEMrush: ${m.join(", ")}`);
        }
        if (session.ga4_data) {
          const ga = typeof session.ga4_data === "string" ? JSON.parse(session.ga4_data) : session.ga4_data;
          if (ga.totalUsers || ga.sessions) parts.push(`GA4: ${ga.totalUsers || "?"} users, ${ga.sessions || "?"} sessions`);
        }
        if (session.psi_data) {
          const psi = typeof session.psi_data === "string" ? JSON.parse(session.psi_data) : session.psi_data;
          if (psi.performance != null) parts.push(`PageSpeed: ${psi.performance}/100`);
        }
        if (session.tech_analysis_data) {
          const tech = typeof session.tech_analysis_data === "string" ? JSON.parse(session.tech_analysis_data) : session.tech_analysis_data;
          if (tech.cms) parts.push(`CMS: ${tech.cms}`);
        }
        if (parts.length > 0) clientContext = parts.join("\n\n");
      }
    } catch (e) { console.error("Failed to fetch session context:", e); }

    // ── RAG search ──────────────────────────────────────────────
    const ragQueries = [
      "business goals priorities challenges budget timeline requirements scope",
      "website problems pain points user experience design issues",
      "marketing strategy SEO PPC advertising digital growth content",
      "client discovery call notes quotes what they said needs",
      "company background industry market competition competitive landscape",
    ];

    let ragContext = "";
    try {
      const ragResults = await Promise.allSettled(
        ragQueries.map((query) =>
          supabase.functions.invoke("rag-search", {
            body: { session_id: sessionId, query, match_count: 8 },
          })
        )
      );

      const seen = new Set<string>();
      const allChunks: { text: string; score: number; source: string }[] = [];
      const sourceLabels = ["Goals & Requirements", "Website Issues", "Marketing & Growth", "Discovery Notes", "Company & Industry"];

      ragResults.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value?.data?.matches) {
          for (const c of result.value.data.matches) {
            const text = c.chunk_text || c.text;
            if (!text || seen.has(text)) continue;
            seen.add(text);
            allChunks.push({ text, score: c.similarity || 0, source: sourceLabels[idx] });
          }
        }
      });

      allChunks.sort((a, b) => b.score - a.score);
      const topChunks = allChunks.slice(0, 35);

      if (topChunks.length > 0) {
        const grouped: Record<string, string[]> = {};
        for (const c of topChunks) {
          if (!grouped[c.source]) grouped[c.source] = [];
          grouped[c.source].push(c.text);
        }
        ragContext = Object.entries(grouped).map(([label, texts]) =>
          `### ${label}\n${texts.join("\n---\n")}`
        ).join("\n\n");
      }
    } catch (e) { console.error("RAG search failed:", e); }

    // ── Build prompt ────────────────────────────────────────────
    const clientName = companyName || domain || "the client";

    const systemPrompt = `You are a senior strategist at GLIDE, a 22-year-old award-winning digital creative agency in Austin, TX. You are generating a complete client proposal based on discovery research and client context.

The client is: ${clientName} (${domain || "unknown domain"})

Your goal is to generate ALL AI-driven sections of the proposal. Each section must be deeply personalized to THIS client's context, industry, challenges, and goals. Do NOT write generic content. Reference specific details from the client context.

## Tone & Style
- Confident, strategic, direct
- Write as if you're presenting to the client's executive team
- Be constructive and forward-looking, never derogatory
- Use specific data points and client quotes when available
- Avoid fluff and filler

## Output
Use the return_proposal tool to return a structured proposal with all sections.`;

    const userPrompt = `Generate a complete proposal for ${clientName}.

${clientContext ? `## Hard Data (from website analysis)\n${clientContext}` : "## No hard data available."}

${ragContext ? `## Client Context (from meetings, emails, documents, HubSpot)\n${ragContext}` : "## No qualitative context available."}

Generate all proposal sections based on this context.`;

    // ── Call Claude ──────────────────────────────────────────────
    const model = "claude-sonnet-4-6";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{
          name: "return_proposal",
          description: "Return a complete structured proposal",
          input_schema: {
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
              northStar: {
                type: "object",
                description: "The positioning and project mission. Be CONCISE. Each statement should be 1 punchy sentence max. Detail should be 1-2 sentences max, not a full paragraph.",
                properties: {
                  position: { type: "string", description: "1 bold sentence positioning the client (max 20 words)" },
                  positionDetail: { type: "string", description: "1-2 sentences max expanding on why this position matters" },
                  project: { type: "string", description: "1 bold sentence defining the project mission (max 20 words)" },
                  projectDetail: { type: "string", description: "1-2 sentences max explaining what the project delivers" },
                },
                required: ["position", "positionDetail", "project", "projectDetail"],
              },
              measurementPlan: {
                type: "array",
                description: "4-6 KPIs that define success for this engagement",
                items: {
                  type: "object",
                  properties: {
                    metric: { type: "string", description: "KPI name" },
                    baseline: { type: "string", description: "Current state or baseline" },
                    target: { type: "string", description: "Target/goal" },
                    method: { type: "string", description: "How GLIDE will move this metric" },
                  },
                  required: ["metric", "baseline", "target", "method"],
                },
              },
              strategicFoundation: {
                type: "array",
                description: "5C diagnostic: Climate, Competition, Customers, Company, Culture. Each has exactly 5 SHORT bullet points (one line each, max 12 words per bullet). No fluff.",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string", enum: ["Climate", "Competition", "Customers", "Company", "Culture"] },
                    points: { type: "array", items: { type: "string" }, description: "Exactly 5 short one-line insights (max 12 words each)" },
                  },
                  required: ["category", "points"],
                },
              },
              whyGlide: {
                type: "array",
                description: "3 pillars for why GLIDE is the right partner for THIS client. Each pillar has a catchy title, subtitle, and 3 items with label and text.",
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
            required: ["whatWeHeard", "northStar", "measurementPlan", "strategicFoundation", "whyGlide", "faqs"],
          },
        }],
        tool_choice: { type: "tool", name: "return_proposal" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Anthropic API error:", response.status, text);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.usage) logUsage({ user_id: userId, provider: "anthropic", model, edge_function: "generate-proposal", prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens, total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) });

    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse?.input) {
      return new Response(JSON.stringify({ error: "AI did not return a valid proposal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      proposal: toolUse.input,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("generate-proposal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
