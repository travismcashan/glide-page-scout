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
      completion_tokens: entry.completion_tokens || 0,
      total_tokens: entry.total_tokens || 0,
    }).then(({ error }) => { if (error) console.warn("[usage-logger]", error.message); });
  } catch {}
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = getUserIdFromRequest(req);
    const { sessionId, totalMonths = 12, startMonthIndex = 0 } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Step 1: Fetch services catalog ──────────────────────────────
    const { data: services } = await supabase
      .from("services")
      .select("sku, name, pillar, default_duration_months, billing_type, roadmap_grade, min_fixed, max_fixed, min_retainer, max_retainer, min_hourly, max_hourly")
      .eq("roadmap_grade", true)
      .not("sku", "is", null)
      .order("sort_order", { ascending: true });

    if (!services || services.length === 0) {
      return new Response(JSON.stringify({ error: "No services found" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const catalogText = services.map((s: any) => {
      const pricing: string[] = [];
      if (s.min_retainer != null) pricing.push(`$${s.min_retainer}-${s.max_retainer}/mo retainer`);
      if (s.min_fixed != null) pricing.push(`$${s.min_fixed}-${s.max_fixed} fixed`);
      if (s.min_hourly != null) pricing.push(`$${s.min_hourly}-${s.max_hourly}/hr`);
      return `- SKU ${s.sku}: "${s.name}" | Pillar: ${s.pillar} | Default: ${s.default_duration_months}mo | Billing: ${s.billing_type || "N/A"} | Pricing: ${pricing.join(", ") || "TBD"}`;
    }).join("\n");

    const validSkus = new Set(services.map((s: any) => s.sku));

    // ── Step 2: Fetch session context ───────────────────────────────
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
          if (obs.recommendations?.length) parts.push(`Top Recommendations:\n${obs.recommendations.slice(0, 5).map((r: string) => `- ${r}`).join("\n")}`);
          if (obs.insights?.length) parts.push(`Key Insights:\n${obs.insights.slice(0, 5).map((i: string) => `- ${i}`).join("\n")}`);
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

    // ── Step 3: Run 4 parallel RAG searches ─────────────────────────
    const ragQueries = [
      "business goals priorities challenges budget timeline requirements scope",
      "website problems pain points user experience design issues",
      "marketing strategy SEO PPC advertising digital growth content",
      "technology platform CMS infrastructure requirements RFP specifications",
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

      // Deduplicate by chunk text, keep top 25
      const seen = new Set<string>();
      const allChunks: { text: string; score: number; source: string }[] = [];
      const sourceLabels = ["Goals & Requirements", "Website & UX Issues", "Marketing & Growth", "Technology & Platform"];

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

      // Sort by score descending, take top 25
      allChunks.sort((a, b) => b.score - a.score);
      const topChunks = allChunks.slice(0, 25);

      if (topChunks.length > 0) {
        // Group by source category for organized context
        const grouped: Record<string, string[]> = {};
        for (const c of topChunks) {
          if (!grouped[c.source]) grouped[c.source] = [];
          grouped[c.source].push(c.text);
        }
        const sections = Object.entries(grouped).map(([label, texts]) =>
          `### ${label}\n${texts.join("\n---\n")}`
        );
        ragContext = sections.join("\n\n");
      }
    } catch (e) { console.error("RAG search failed (non-fatal):", e); }

    // ── Step 4: Build prompts ───────────────────────────────────────
    const systemPrompt = `You are a senior digital agency strategist at GLIDE, a 22-year-old award-winning creative agency. Your job is to analyze all available client context and recommend a ${totalMonths}-month digital growth plan by selecting the right services from GLIDE's catalog.

## GLIDE's Service Catalog
${catalogText}

## Four Pillars (execution order)
- IS (Intelligent Strategy): Discovery, audits, research. Always starts first.
- FB (Foundation & Build): Website design/redesign, development. Follows IS.
- GO (Growth & Optimization): SEO, PPC, content, ongoing marketing. Starts after FB has some progress (month 2-3+).
- TS (Technology & Systems): Integrations, maintenance, hosting. Can run alongside or after FB.

## Sequencing Rules
1. ALWAYS include Paid Discovery (SKU 101) as the first service at startMonth 0, duration 1.
2. IS services start early (months 0-2).
3. FB services follow IS (months 1-4 typically).
4. GO services begin after the FB foundation is in place (months 2-4+).
5. TS services can start alongside FB or after.
6. Recurring services (SEO, PPC, Content) should span many months once started.
7. Use the defaultDuration from the catalog unless client context suggests otherwise.
8. Don't exceed ${totalMonths} total months. startMonth is 0-indexed (0 = first month).
9. Each service's startMonth + duration must not exceed ${totalMonths}.

## Selection Guidance
- LESS IS MORE. Only recommend services with strong evidence from the client context.
- A typical plan has 5-8 services. Exceeding 8 requires exceptional justification.
- Do NOT add services "just in case" or to round out the plan. Every service must solve a specific, evidenced client need.
- If the client needs a new website or redesign, include the appropriate FB service.
- If SEO is explicitly mentioned or organic traffic is clearly low, include SEO.
- If PPC/advertising is discussed, include PPC management.
- If the site has clear performance issues, consider TS services.
- Do NOT stack multiple similar services (e.g., don't add both SEO + Continuous Improvement + Analytics Maintenance unless each solves a distinct problem).
- Use the sortOrder field to control vertical ordering within each pillar lane (0 = top).

## FAQs / Objection Handling
Generate 4-6 FAQs that address specific objections THIS client would likely raise based on their context. Examples:
- If they're cost-conscious: "Why can't we just do SEO without a new website?"
- If they have a tight timeline: "Why does discovery take a full month?"
- If they're skeptical of agencies: "How is GLIDE different from our last agency?"
- Industry-specific concerns based on their business
Each FAQ should have a direct, confident answer (2-3 sentences) that references their specific situation.
Do NOT use generic questions. Every FAQ must be tailored to this client's context, industry, and likely objections.

## Output
Use the return_growth_plan tool. Provide brief reasoning explaining your strategy, the items array with services from the catalog ONLY (use exact SKU numbers), and tailored FAQs.`;

    const userPrompt = `Analyze this client's context and build a ${totalMonths}-month digital growth plan.

${clientContext ? `## Hard Data (from website analysis)\n${clientContext}` : "## No hard data available yet - rely on qualitative context below."}

${ragContext ? `## Client Context (from meetings, emails, documents, HubSpot)\n${ragContext}` : "## No qualitative context available - build a general-purpose growth plan based on the hard data above."}

Select the right services, assign start months and durations, and return the plan.`;

    // ── Step 5: Call Claude ─────────────────────────────────────────
    const model = "claude-sonnet-4-6";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{
          name: "return_growth_plan",
          description: "Return a structured digital growth plan with selected services and timeline placement",
          input_schema: {
            type: "object",
            properties: {
              reasoning: { type: "string", description: "Brief 2-3 sentence explanation of the growth plan strategy and why these services were selected" },
              faqs: {
                type: "array",
                description: "4-6 client-specific FAQs addressing likely objections to this plan",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string", description: "A specific objection this client would raise" },
                    answer: { type: "string", description: "Direct, confident 2-3 sentence answer referencing their situation" },
                  },
                  required: ["question", "answer"],
                },
              },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sku: { type: "number", description: "Service SKU from the catalog" },
                    name: { type: "string", description: "Service name (use exact name from catalog)" },
                    pillar: { type: "string", enum: ["IS", "FB", "GO", "TS"], description: "Service pillar code" },
                    startMonth: { type: "number", description: "0-indexed start month on the timeline" },
                    duration: { type: "number", description: "Duration in months" },
                    sortOrder: { type: "number", description: "Vertical position within pillar lane (0 = top)" },
                  },
                  required: ["sku", "name", "pillar", "startMonth", "duration", "sortOrder"],
                },
              },
            },
            required: ["reasoning", "items", "faqs"],
          },
        }],
        tool_choice: { type: "tool", name: "return_growth_plan" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Anthropic API error:", response.status, text);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited - please try again in a moment" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.usage) logUsage({ user_id: userId, provider: "anthropic", model, edge_function: "generate-growth-plan", prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens, total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) });

    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse?.input?.items) {
      return new Response(JSON.stringify({ error: "AI did not return a valid plan" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Step 6: Validate & clamp ────────────────────────────────────
    const validatedItems = toolUse.input.items
      .filter((item: any) => validSkus.has(item.sku))
      .map((item: any) => {
        const svc = services.find((s: any) => s.sku === item.sku);
        const startMonth = Math.max(0, Math.min(Math.round(item.startMonth), totalMonths - 1));
        const duration = Math.max(1, Math.min(Math.round(item.duration), totalMonths - startMonth));
        return {
          sku: item.sku,
          name: svc?.name || item.name,
          pillar: svc?.pillar || item.pillar,
          startMonth,
          duration,
          sortOrder: item.sortOrder ?? 0,
        };
      });

    return new Response(JSON.stringify({
      items: validatedItems,
      reasoning: toolUse.input.reasoning || "",
      faqs: toolUse.input.faqs || [],
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("generate-growth-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
