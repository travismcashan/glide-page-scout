import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Hard data from crawl session ──────────────────────────
    let clientContext = "";
    let domain = "";
    let companyName = "";
    try {
      const { data: session } = await supabase
        .from("crawl_sessions")
        .select("domain, prospect_domain, observations_data, semrush_data, ga4_data, psi_data, tech_analysis_data, ocean_data, apollo_data, hubspot_data")
        .eq("id", sessionId)
        .maybeSingle();

      if (session) {
        domain = session.domain || "";
        const parts: string[] = [];
        if (session.prospect_domain) parts.push(`Client website: ${session.prospect_domain}`);

        // Observations
        if (session.observations_data) {
          const obs = typeof session.observations_data === "string" ? JSON.parse(session.observations_data) : session.observations_data;
          if (obs.northStar) parts.push(`North Star: ${obs.northStar}`);
          if (obs.keysToSuccess?.length) parts.push(`Keys to Success:\n${obs.keysToSuccess.map((k: string) => `- ${k}`).join("\n")}`);
          if (obs.strategies?.length) parts.push(`Strategic Priorities:\n${obs.strategies.map((s: string) => `- ${s}`).join("\n")}`);
          if (obs.recommendations?.length) parts.push(`Top Recommendations:\n${obs.recommendations.slice(0, 8).map((r: string) => `- ${r}`).join("\n")}`);
          if (obs.insights?.length) parts.push(`Key Insights:\n${obs.insights.slice(0, 8).map((i: string) => `- ${i}`).join("\n")}`);
        }

        // SEMrush
        if (session.semrush_data) {
          const sem = typeof session.semrush_data === "string" ? JSON.parse(session.semrush_data) : session.semrush_data;
          const m: string[] = [];
          if (sem.organic_keywords) m.push(`${sem.organic_keywords} organic keywords`);
          if (sem.organic_traffic) m.push(`${sem.organic_traffic} monthly organic traffic`);
          if (sem.authority_score) m.push(`Authority score: ${sem.authority_score}`);
          if (m.length) parts.push(`SEMrush: ${m.join(", ")}`);
        }

        // GA4
        if (session.ga4_data) {
          const ga = typeof session.ga4_data === "string" ? JSON.parse(session.ga4_data) : session.ga4_data;
          if (ga.totalUsers || ga.sessions) parts.push(`GA4: ${ga.totalUsers || "?"} users, ${ga.sessions || "?"} sessions`);
        }

        // PageSpeed
        if (session.psi_data) {
          const psi = typeof session.psi_data === "string" ? JSON.parse(session.psi_data) : session.psi_data;
          if (psi.performance != null) parts.push(`PageSpeed: ${psi.performance}/100`);
        }

        // Tech
        if (session.tech_analysis_data) {
          const tech = typeof session.tech_analysis_data === "string" ? JSON.parse(session.tech_analysis_data) : session.tech_analysis_data;
          if (tech.cms) parts.push(`CMS: ${tech.cms}`);
        }

        // Ocean.io
        if (session.ocean_data) {
          const ocean = typeof session.ocean_data === "string" ? JSON.parse(session.ocean_data) : session.ocean_data;
          if (ocean.company_name) { companyName = ocean.company_name; parts.push(`Company: ${ocean.company_name}`); }
          if (ocean.industry) parts.push(`Industry: ${ocean.industry}`);
          if (ocean.company_size) parts.push(`Company size: ${ocean.company_size}`);
          if (ocean.revenue) parts.push(`Revenue: ${ocean.revenue}`);
        }

        // Apollo company name fallback
        if (!companyName && session.apollo_data) {
          const apollo = typeof session.apollo_data === "string" ? JSON.parse(session.apollo_data) : session.apollo_data;
          if (apollo.organizationName) companyName = apollo.organizationName;
        }

        // HubSpot company name fallback
        if (!companyName && session.hubspot_data) {
          const hs = typeof session.hubspot_data === "string" ? JSON.parse(session.hubspot_data) : session.hubspot_data;
          if (hs.companies?.[0]?.name) companyName = hs.companies[0].name;
        }

        if (parts.length > 0) clientContext = parts.join("\n\n");
      }
    } catch (e) { console.error("Failed to fetch session context:", e); }

    // ── RAG search (5 parallel queries) ───────────────────────
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
        ragContext = Object.entries(grouped)
          .map(([label, texts]) => `### ${label}\n${texts.join("\n---\n")}`)
          .join("\n\n");
      }
    } catch (e) { console.error("RAG search failed:", e); }

    console.log(`[gather-proposal-context] domain=${domain}, company=${companyName}, clientContext=${clientContext.length}ch, ragContext=${ragContext.length}ch`);

    return new Response(JSON.stringify({ clientContext, ragContext, clientName: companyName || domain, domain }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gather-proposal-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
