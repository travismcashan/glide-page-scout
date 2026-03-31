import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const { optionName, serviceNames, sessionId } = await req.json();

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

    // Pull client context from session if provided
    let clientContext = "";
    if (sessionId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: session } = await supabase
          .from("crawl_sessions")
          .select("prospect_domain, observations_data, deep_research_data, semrush_data, ga4_data, psi_data, tech_analysis_data")
          .eq("id", sessionId)
          .maybeSingle();

        if (session) {
          const parts: string[] = [];

          if (session.prospect_domain) {
            parts.push(`Client website: ${session.prospect_domain}`);
          }

          // Extract observations pyramid for rich context
          if (session.observations_data) {
            const obs = typeof session.observations_data === "string"
              ? JSON.parse(session.observations_data)
              : session.observations_data;
            if (obs.northStar) parts.push(`North Star: ${obs.northStar}`);
            if (obs.keysToSuccess?.length) parts.push(`Keys to Success:\n${obs.keysToSuccess.map((k: string) => `- ${k}`).join("\n")}`);
            if (obs.strategies?.length) parts.push(`Strategic Priorities:\n${obs.strategies.map((s: string) => `- ${s}`).join("\n")}`);
            if (obs.recommendations?.length) {
              const topRecs = obs.recommendations.slice(0, 5);
              parts.push(`Top Recommendations:\n${topRecs.map((r: string) => `- ${r}`).join("\n")}`);
            }
            if (obs.insights?.length) {
              const topInsights = obs.insights.slice(0, 5);
              parts.push(`Key Insights:\n${topInsights.map((i: string) => `- ${i}`).join("\n")}`);
            }
          }

          // SEMrush organic/paid data
          if (session.semrush_data) {
            const sem = typeof session.semrush_data === "string"
              ? JSON.parse(session.semrush_data)
              : session.semrush_data;
            const metrics: string[] = [];
            if (sem.organic_keywords) metrics.push(`${sem.organic_keywords} organic keywords`);
            if (sem.organic_traffic) metrics.push(`${sem.organic_traffic} monthly organic traffic`);
            if (sem.paid_keywords) metrics.push(`${sem.paid_keywords} paid keywords`);
            if (sem.authority_score) metrics.push(`Authority score: ${sem.authority_score}`);
            if (metrics.length) parts.push(`SEMrush Metrics: ${metrics.join(", ")}`);
          }

          // GA4 traffic data
          if (session.ga4_data) {
            const ga = typeof session.ga4_data === "string"
              ? JSON.parse(session.ga4_data)
              : session.ga4_data;
            if (ga.totalUsers || ga.sessions) {
              parts.push(`Google Analytics: ${ga.totalUsers || "?"} users, ${ga.sessions || "?"} sessions (${ga.lookbackDays || 90}d)`);
            }
          }

          // PageSpeed performance
          if (session.psi_data) {
            const psi = typeof session.psi_data === "string"
              ? JSON.parse(session.psi_data)
              : session.psi_data;
            if (psi.performance != null) {
              parts.push(`PageSpeed Performance: ${psi.performance}/100`);
            }
          }

          // Tech stack
          if (session.tech_analysis_data) {
            const tech = typeof session.tech_analysis_data === "string"
              ? JSON.parse(session.tech_analysis_data)
              : session.tech_analysis_data;
            if (tech.cms) parts.push(`CMS: ${tech.cms}`);
            if (tech.framework) parts.push(`Framework: ${tech.framework}`);
          }

          if (parts.length > 0) {
            clientContext = `\n\nClient Context:\n${parts.join("\n\n")}`;
          }
        }
      } catch (e) {
        console.error("Failed to fetch session context:", e);
        // Continue without context
      }
    }

    const count = serviceNames.length;

    const prompt = `You are a senior digital agency strategist presenting to a prospective client. Given the following ${count} services included in an investment option called "${optionName}", generate exactly ${count} highly specific, compelling business outcomes, one per service, in the same order.

Each outcome should:
- Be one impactful sentence (10-18 words)
- Reference specific, measurable results when possible
- Connect the service directly to client business impact
- Sound like a confident promise, not generic marketing speak
- Use the client context below to make each outcome deeply relevant to THIS specific client${clientContext}

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
        system: `You return exactly ${count} business outcomes in order, one per service. Use the return_outcomes tool. No other text.`,
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
