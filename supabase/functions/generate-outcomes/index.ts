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
    const { optionName, serviceNames, sessionId, whyBundle } = await req.json();

    if (!serviceNames || !Array.isArray(serviceNames) || serviceNames.length === 0) {
      return new Response(JSON.stringify({ outcomes: [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    let clientContext = "";
    let ragContext = "";

    if (sessionId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
          if (parts.length > 0) clientContext = `\n\nClient Context:\n${parts.join("\n\n")}`;
        }
      } catch (e) { console.error("Failed to fetch session context:", e); }

      // RAG search for deeper context (meeting notes, transcripts, uploads)
      try {
        const query = `business goals challenges priorities for ${serviceNames.join(" and ")}`;
        const { data: embResp } = await supabase.functions.invoke("rag-search", {
          body: { sessionId, query, limit: 5 },
        });
        if (embResp?.chunks?.length) {
          const chunks = embResp.chunks.slice(0, 5).map((c: any) => c.chunk_text || c.text).filter(Boolean);
          if (chunks.length > 0) {
            ragContext = `\n\nDeep Context (from meeting notes, transcripts, and documents):\n${chunks.join("\n---\n")}`;
          }
        }
      } catch (e) { console.error("RAG search failed (non-fatal):", e); }
    }

    const count = serviceNames.length;
    const fullContext = clientContext + ragContext;

    let prompt: string;
    let systemMsg: string;
    let outcomeCount: number;

    outcomeCount = 3;

    if (whyBundle) {
      prompt = `You are a senior digital agency strategist. The client is considering a 12-month bundled growth plan that includes ALL of the following services: ${serviceNames.join(", ")}.

Generate exactly 3 compelling reasons to bundle these services together instead of buying them separately. Focus on the compounding effect, cost savings, and strategic alignment.

Each reason should:
- Be one punchy sentence (8-10 words, no filler)
- Emphasize synergy between services, not individual service benefits
- Reference the client context to make it specific and empathetic
- Bold exactly ONE key word or short phrase using **markdown bold** — the action verb or the most compelling metric (e.g. "**Compound** growth across every digital channel" or "Save **$12K+** through unified strategy")${fullContext}`;
      systemMsg = `You return exactly 3 reasons to bundle. Each must use **bold** on exactly one key word/phrase. Use the return_outcomes tool. No other text.`;
    } else {
      prompt = `You are a senior digital agency strategist presenting to a prospective client. Given the following ${count} services included in an investment option called "${optionName}", generate exactly 3 highly specific, compelling business outcomes that represent the combined impact of these services together.

Each outcome should:
- Be one punchy sentence (8-10 words, no filler words)
- Reference specific, measurable results when possible
- Connect the services directly to client business impact
- Sound like a confident promise, not generic marketing speak
- Use the client context below to make each outcome deeply relevant to THIS specific client
- Bold exactly ONE key word or short phrase using **markdown bold** — the action verb or the most compelling metric (e.g. "**Double** organic traffic within six months" or "Cut bounce rate by **40%** in 90 days")${fullContext}

Services:
${serviceNames.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}`;
      systemMsg = `You return exactly 3 business outcomes representing the combined impact of these services. Each must be 8-10 words and use **bold** on exactly one key word/phrase. Use the return_outcomes tool. No other text.`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemMsg,
        messages: [{ role: "user", content: prompt }],
        tools: [{ name: "return_outcomes", description: `Return exactly ${outcomeCount} outcomes`, input_schema: { type: "object", properties: { outcomes: { type: "array", items: { type: "string" }, description: `Exactly ${outcomeCount} outcomes, 8-10 words each` } }, required: ["outcomes"] } }],
        tool_choice: { type: "tool", name: "return_outcomes" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Anthropic API error:", response.status, text);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Anthropic API error");
    }

    const data = await response.json();
    if (data.usage) logUsage({ user_id: userId, provider: "anthropic", model: "claude-haiku-4-5-20251001", edge_function: "generate-outcomes", prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens, total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) });

    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (toolUse?.input?.outcomes) {
      return new Response(JSON.stringify({ outcomes: toolUse.input.outcomes }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ outcomes: [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-outcomes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
