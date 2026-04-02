import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const { rawContent, clientName, domain, sessionId } = await req.json();

    if (!rawContent) {
      return new Response(JSON.stringify({ error: "rawContent is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const name = clientName || domain || "the client";

    // ── Gather client context from knowledge base (if sessionId provided) ──
    let clientContext = "";
    const references: string[] = []; // Track sources used for admin view
    if (sessionId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Session hard data
        const { data: session } = await supabase
          .from("crawl_sessions")
          .select("domain, observations_data, ocean_data, semrush_data")
          .eq("id", sessionId)
          .maybeSingle();

        if (session) {
          const parts: string[] = [];
          if (session.observations_data) {
            const obs = typeof session.observations_data === "string" ? JSON.parse(session.observations_data) : session.observations_data;
            if (obs.northStar) parts.push(`Client North Star: ${obs.northStar}`);
            if (obs.keysToSuccess?.length) parts.push(`Keys to Success:\n${obs.keysToSuccess.map((k: string) => `- ${k}`).join("\n")}`);
            if (obs.strategies?.length) parts.push(`Strategic Priorities:\n${obs.strategies.map((s: string) => `- ${s}`).join("\n")}`);
          }
          if (session.ocean_data) {
            const ocean = typeof session.ocean_data === "string" ? JSON.parse(session.ocean_data) : session.ocean_data;
            if (ocean.company_name) parts.push(`Client company: ${ocean.company_name}`);
            if (ocean.industry) parts.push(`Client industry: ${ocean.industry}`);
            if (ocean.company_size) parts.push(`Client company size: ${ocean.company_size}`);
          }
          if (session.semrush_data) {
            const sem = typeof session.semrush_data === "string" ? JSON.parse(session.semrush_data) : session.semrush_data;
            const m: string[] = [];
            if (sem.organic_keywords) m.push(`${sem.organic_keywords} organic keywords`);
            if (sem.organic_traffic) m.push(`${sem.organic_traffic} monthly organic traffic`);
            if (m.length) parts.push(`Client SEMrush: ${m.join(", ")}`);
          }
          if (parts.length) clientContext += parts.join("\n") + "\n\n";
        }

        // RAG search — 2 targeted queries about the client
        const ragQueries = [
          "business goals challenges requirements needs priorities budget",
          "company background industry market what they do products services",
          "client discovery call notes what they said fears hopes concerns",
          "competitors competitive landscape market position what competitors are doing threats",
        ];
        const ragResults = await Promise.allSettled(
          ragQueries.map((query) =>
            supabase.functions.invoke("rag-search", {
              body: { session_id: sessionId, query, match_count: 15 },
            })
          )
        );

        const seen = new Set<string>();
        const chunks: string[] = [];
        for (const result of ragResults) {
          if (result.status === "fulfilled" && result.value?.data?.matches) {
            for (const c of result.value.data.matches) {
              const text = c.chunk_text || c.text;
              if (!text || seen.has(text)) continue;
              seen.add(text);
              chunks.push(text);
            }
          }
        }
        if (chunks.length) {
          clientContext += "## Knowledge Base Context About the Client\n" + chunks.slice(0, 30).join("\n---\n");
        }

        // Track which RAG documents were referenced
        for (const result of ragResults) {
          if (result.status === "fulfilled" && result.value?.data?.matches) {
            for (const c of result.value.data.matches) {
              const docName = c.document_name;
              if (docName && !references.includes(docName)) references.push(docName);
            }
          }
        }

        // Also note session data sources used
        if (session?.observations_data) references.push("Session: Observations & Analysis");
        if (session?.ocean_data) references.push("Session: Ocean.io Company Profile");
        if (session?.semrush_data) references.push("Session: SEMrush Data");

        console.log(`[generate-case-study] RAG context: ${clientContext.length}ch from ${chunks.length} chunks, ${references.length} source docs`);
      } catch (e) {
        console.warn("[generate-case-study] Failed to gather client context:", e);
      }
    }

    const systemPrompt = `You are a world-class digital marketing strategist and proposal writer at GLIDE, a 22-year award-winning digital creative agency. You are crafting a case study for a client proposal that will be read by C-suite executives and senior decision-makers.

The proposal is for: ${name} (${domain || "unknown domain"})

${clientContext ? `Here is what we know about the proposal client from our research and knowledge base:\n\n${clientContext}\n\n` : ""}YOUR MISSION: Create a case study that makes the reader think "they've done this exact thing before for someone like us."

PRINCIPLES OF ELITE CASE STUDIES (apply all of these):

1. MIRROR THE READER'S SITUATION — The description must make ${name}'s leadership see their own challenges reflected. Don't just describe what GLIDE did; describe the starting condition that mirrors where ${name} is now.

2. LEAD WITH OUTCOMES, NOT ACTIVITIES — C-suite doesn't care about "we redesigned the website." They care about "we turned their digital presence into a pipeline that generated $X." Metrics should feel like business results, not vanity numbers.

3. SPECIFICITY BUILDS TRUST — Vague claims ("improved performance") destroy credibility. Specific claims ("299% organic traffic growth in 14 months") build it. Use real numbers from the source material. If exact numbers aren't available, use credible qualitative metrics ("Custom" platform, "3" distinct audience pathways).

4. THE "WHY IT MATTERS" IS THE CLOSE — This is the most important section. It should read like a senior strategist connecting dots that only someone who deeply understands ${name}'s situation would connect. Reference specific challenges, goals, or fears from the client context above. Make it feel like GLIDE already understands their world.

5. BREVITY SIGNALS CONFIDENCE — Two sentences max per section. If you need more words, your thinking isn't sharp enough. Every word must earn its place.

Use the return_case_study tool to return structured data.`;

    const userPrompt = `Structure this into a case study for the ${name} proposal:

${rawContent}

Return:
- company: The case study company name
- tagline: What they do in under 10 words (italic style)
- metrics: 3 business-outcome metrics. Stat MUST be a number or single word (e.g. '12' not '12 Weeks'). Label is 3-4 words (e.g. 'Weeks Concept to Launch'). All 3 labels same word count.
- description: 2 sentences MAX. Start with "Like ${name}..." to mirror their situation, then state the key outcome. Make their leadership see themselves in this story.
- whyItMatters: 2 sentences MAX. Connect specific dots between this case study and ${name}'s actual situation, challenges, or goals. This should read like strategic insight, not a sales pitch.`;

    const model = "claude-opus-4-6";
    console.log(`[generate-case-study] model=${model}, content=${rawContent.length}ch, clientContext=${clientContext.length}ch`);

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
                description: "Exactly 3 key metrics with bold stat and label. No more than 3.",
                items: {
                  type: "object",
                  properties: {
                    stat: { type: "string", description: "STRICTLY one number OR one word. Never two words, never abbreviations. WRONG: '12 Wks', '4+ Years', 'Custom Platform'. CORRECT: '12', '4+', 'Custom', '+299%', '3'. If you want to say '12 weeks', stat='12' and put 'Weeks to Site Launch' in the label." },
                    label: { type: "string", description: "3-4 words describing the stat. Should naturally wrap to two lines. Keep all 3 labels similar word count. Examples: 'Weeks Concept to Launch', 'Distinct Audience Funnels', 'Surgeon Finder Built'. Never exceed 5 words." },
                  },
                  required: ["stat", "label"],
                },
              },
              description: { type: "string", description: "2 sentences MAX. What we did and the key result. Draw a parallel to the proposal client. Be punchy, not verbose." },
              whyItMatters: { type: "string", description: "2 sentences MAX. Why this matters for the proposal client specifically. Reference their actual situation, challenges, or goals. Direct, strategic, no fluff." },
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

    return new Response(JSON.stringify({ caseStudy: toolUse.input, references }), {
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
