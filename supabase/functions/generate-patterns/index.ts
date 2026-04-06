/**
 * generate-patterns — AI Pattern Suggestion Engine
 *
 * Analyzes crawl data + enrichment across companies in the same industry
 * to identify recurring site structures, gaps, and conversion patterns.
 * Writes suggested patterns to the patterns table with source='ai_suggested'.
 *
 * Input: { industry?: string }  (if omitted, analyzes all industries with 3+ companies)
 * Output: { success: true, patterns: Pattern[], stats: { analyzed, suggested } }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveUserId } from "../_shared/resolve-user.ts";
import { logUsage, extractOpenAIUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Minimum companies in an industry to generate patterns
const MIN_COMPANIES = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const targetIndustry: string | undefined = body.industry;

    const userId = await resolveUserId(supabase, req, body.userId);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 1. Fetch companies with crawl data ────────────────────────
    // Get companies that have enrichment_data and at least one completed crawl
    const { data: companies, error: compError } = await supabase
      .from("companies")
      .select("id, name, domain, enrichment_data, industry")
      .eq("user_id", userId)
      .not("domain", "is", null);

    if (compError) throw new Error(`Failed to fetch companies: ${compError.message}`);
    if (!companies?.length) {
      return new Response(
        JSON.stringify({ success: false, error: "No companies found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 2. Fetch crawl sessions for these companies ───────────────
    const companyIds = companies.map((c: any) => c.id);
    const { data: sessions, error: sessError } = await supabase
      .from("crawl_sessions")
      .select(
        "id, company_id, domain, status, psi_data, wave_data, w3c_data, observatory_data, carbon_data, gtmetrix_scores, gtmetrix_grade, crux_data, yellowlab_data, http_status_data, link_checker_data, schema_data, sitemap_data, forms_data, readable_data, content_types_data, navigation_data, overall_score, ai_insights"
      )
      .in("company_id", companyIds)
      .in("status", ["completed", "completed_with_errors"])
      .order("created_at", { ascending: false });

    if (sessError) throw new Error(`Failed to fetch sessions: ${sessError.message}`);

    // ── 3. Group by industry ──────────────────────────────────────
    // Resolve industry from: company.industry → enrichment apollo → enrichment ocean
    function resolveIndustry(company: any): string | null {
      if (company.industry) return normalizeIndustry(company.industry);
      const ed = company.enrichment_data;
      if (ed?.apollo_org?.industry) return normalizeIndustry(ed.apollo_org.industry);
      if (ed?.ocean?.industry) return normalizeIndustry(ed.ocean.industry);
      return null;
    }

    function normalizeIndustry(raw: string): string {
      return raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    }

    // Build industry → company+sessions map
    const industryMap: Record<
      string,
      Array<{ company: any; sessions: any[] }>
    > = {};

    for (const company of companies) {
      const industry = resolveIndustry(company);
      if (!industry) continue;
      if (targetIndustry && industry !== normalizeIndustry(targetIndustry))
        continue;

      const companySessions = (sessions ?? []).filter(
        (s: any) => s.company_id === company.id
      );

      if (!industryMap[industry]) industryMap[industry] = [];
      industryMap[industry].push({ company, sessions: companySessions });
    }

    // ── 4. Fetch existing patterns to avoid duplicates ────────────
    const { data: existingPatterns } = await supabase
      .from("patterns")
      .select("title, industry, pattern_type")
      .eq("user_id", userId);

    const existingTitles = new Set(
      (existingPatterns ?? []).map(
        (p: any) => `${p.industry}::${p.title.toLowerCase()}`
      )
    );

    // ── 5. Generate patterns per industry ─────────────────────────
    const allSuggested: any[] = [];
    let totalAnalyzed = 0;

    for (const [industry, entries] of Object.entries(industryMap)) {
      if (entries.length < MIN_COMPANIES) continue;
      totalAnalyzed += entries.length;

      // Build analysis summary for the LLM
      const companySummaries = entries.map(({ company, sessions: sess }) => {
        const ed = company.enrichment_data ?? {};
        const latestSession = sess[0]; // most recent crawl

        // Extract key signals from crawl data
        const signals: string[] = [];

        if (latestSession) {
          const score = latestSession.overall_score;
          if (score) {
            signals.push(`Overall health: ${score.grade} (${score.score}/100)`);
            if (score.topStrengths?.length) {
              signals.push(
                `Strengths: ${score.topStrengths.map((s: any) => s.summary).join("; ")}`
              );
            }
            if (score.topGaps?.length) {
              signals.push(
                `Gaps: ${score.topGaps.map((s: any) => s.summary).join("; ")}`
              );
            }
          }

          // Forms data
          if (latestSession.forms_data) {
            const forms = latestSession.forms_data;
            const formCount =
              forms.forms?.length ?? forms.totalForms ?? "unknown";
            signals.push(`Forms found: ${formCount}`);
          }

          // Navigation structure
          if (latestSession.navigation_data) {
            const nav = latestSession.navigation_data;
            const navItems = nav.items?.length ?? nav.totalLinks ?? "unknown";
            signals.push(`Navigation items: ${navItems}`);
          }

          // Content types
          if (latestSession.content_types_data) {
            const ct = latestSession.content_types_data;
            if (ct.pageTypes || ct.types) {
              signals.push(
                `Content types: ${JSON.stringify(ct.pageTypes ?? ct.types).substring(0, 200)}`
              );
            }
          }

          // Schema/structured data
          if (latestSession.schema_data) {
            const schema = latestSession.schema_data;
            const types = schema.types ?? schema.schemaTypes ?? [];
            if (types.length) signals.push(`Schema types: ${types.join(", ")}`);
          }

          // AI insights if available
          if (latestSession.ai_insights) {
            const insights = latestSession.ai_insights;
            if (insights.executive_summary) {
              signals.push(
                `AI analysis: ${insights.executive_summary.substring(0, 300)}`
              );
            }
            if (insights.priority_actions?.length) {
              signals.push(
                `Priority actions: ${insights.priority_actions.map((a: any) => a.action).join("; ")}`
              );
            }
          }
        }

        // Enrichment data
        if (ed.apollo_org) {
          const apollo = ed.apollo_org;
          if (apollo.estimated_num_employees)
            signals.push(`Employees: ${apollo.estimated_num_employees}`);
          if (apollo.annual_revenue_printed)
            signals.push(`Revenue: ${apollo.annual_revenue_printed}`);
          if (apollo.technologies?.length)
            signals.push(
              `Tech stack: ${apollo.technologies.slice(0, 10).join(", ")}`
            );
        }

        if (ed.ocean) {
          const ocean = ed.ocean;
          if (ocean.traffic?.monthly_visits)
            signals.push(`Monthly visits: ${ocean.traffic.monthly_visits}`);
        }

        return `Company: ${company.name} (${company.domain})\n  ${signals.join("\n  ") || "No crawl data available"}`;
      });

      const prompt = `You are a growth marketing strategist analyzing website data across ${entries.length} companies in the "${industry.replace(/_/g, " ")}" industry. Your job is to identify RECURRING patterns — things that appear across multiple companies that represent either best practices or common gaps.

COMPANY DATA:
${companySummaries.join("\n\n")}

Based on this data, identify 2-5 actionable patterns. Each pattern should be something observed across at least 2 companies. Focus on:
1. Common site structure patterns (navigation, page types, content organization)
2. Conversion optimization opportunities (forms, CTAs, trust signals)
3. Technical gaps that recur (performance, accessibility, SEO)
4. Content patterns that work or fail in this industry

For each pattern, provide:
- A specific, descriptive title
- A detailed description explaining the pattern and why it matters
- Evidence from the analyzed companies (reference specific data points)
- The anti-pattern (what NOT to do)
- Implementation notes
- Pattern type (conversion, layout, content, navigation, engagement, seo, or accessibility)
- Block type if applicable (hero, pricing, cta, form, navigation, testimonial, services, about, case_study, product_page, or null)
- Confidence score (0.3-0.7 for suggested patterns — be honest about certainty)
- Relevant tags

Respond with ONLY valid JSON array (no markdown, no code blocks):
[
  {
    "title": "Pattern Title",
    "description": "Detailed description...",
    "evidence": "What data supports this...",
    "anti_pattern": "What NOT to do...",
    "implementation_notes": "How to apply this...",
    "pattern_type": "conversion",
    "block_type": "hero",
    "confidence_score": 0.55,
    "tags": ["tag1", "tag2"]
  }
]

Rules:
- Each pattern must be supported by data from at least 2 companies
- Be specific — reference actual scores, gaps, and signals from the data
- Confidence should be 0.3-0.5 for weak signals, 0.5-0.7 for strong signals
- Do NOT suggest patterns that are too generic ("have a good website")
- Focus on industry-specific insights when possible`;

      console.log(
        `[generate-patterns] Analyzing ${entries.length} companies in "${industry}"`
      );

      const response = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a growth marketing pattern analyst. Respond only with valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[generate-patterns] API error for ${industry}:`,
          response.status,
          errorText
        );
        continue; // Skip this industry, try next
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        console.error(`[generate-patterns] No content for ${industry}`);
        continue;
      }

      // Parse JSON
      let suggested: any[];
      try {
        const cleaned = content
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        suggested = JSON.parse(cleaned);
        if (!Array.isArray(suggested)) suggested = [suggested];
      } catch (e) {
        console.error(
          `[generate-patterns] Parse error for ${industry}:`,
          content
        );
        continue;
      }

      // Log usage
      try {
        const reqUserId = getUserIdFromRequest(req);
        const usage = extractOpenAIUsage(result);
        await logUsage(reqUserId, "generate-patterns", "gemini-2.0-flash", usage.promptTokens, usage.completionTokens, { industry });
      } catch (e) {
        console.warn("[generate-patterns] Usage logging failed:", e);
      }

      // Filter duplicates and insert
      const VALID_TYPES = [
        "conversion",
        "layout",
        "content",
        "navigation",
        "engagement",
        "seo",
        "accessibility",
      ];

      for (const pat of suggested) {
        // Skip if title already exists for this industry
        const key = `${industry}::${(pat.title ?? "").toLowerCase()}`;
        if (existingTitles.has(key)) {
          console.log(
            `[generate-patterns] Skipping duplicate: "${pat.title}" in ${industry}`
          );
          continue;
        }

        // Validate pattern_type
        const patternType = VALID_TYPES.includes(pat.pattern_type)
          ? pat.pattern_type
          : "content";

        const row = {
          user_id: userId,
          industry,
          pattern_type: patternType,
          block_type: pat.block_type || null,
          title: pat.title,
          description: pat.description,
          evidence: pat.evidence || null,
          anti_pattern: pat.anti_pattern || null,
          implementation_notes: pat.implementation_notes || null,
          conversion_data: {},
          persona_mapping: [],
          source: "ai_suggested",
          confidence_score: Math.max(
            0.3,
            Math.min(0.7, Number(pat.confidence_score) || 0.5)
          ),
          tags: Array.isArray(pat.tags) ? pat.tags : [],
          status: "draft",
        };

        const { data: inserted, error: insertErr } = await supabase
          .from("patterns")
          .insert(row)
          .select("id, title, industry, pattern_type, confidence_score")
          .single();

        if (insertErr) {
          console.error(
            `[generate-patterns] Insert error for "${pat.title}":`,
            insertErr.message
          );
          continue;
        }

        allSuggested.push(inserted);
        existingTitles.add(key); // Prevent duplicates within same batch
      }
    }

    console.log(
      `[generate-patterns] Done. Analyzed ${totalAnalyzed} companies, suggested ${allSuggested.length} patterns`
    );

    return new Response(
      JSON.stringify({
        success: true,
        patterns: allSuggested,
        stats: {
          companiesAnalyzed: totalAnalyzed,
          patternsSuggested: allSuggested.length,
          industries: Object.keys(industryMap).filter(
            (k) => industryMap[k].length >= MIN_COMPANIES
          ),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-patterns] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
