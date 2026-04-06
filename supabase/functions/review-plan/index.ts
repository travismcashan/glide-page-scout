/**
 * review-plan — Code Council
 *
 * Takes a plan ID, fetches its content, and sends it to 3 AI reviewer
 * perspectives (Architecture, Product/UX, Strategy) using Gemini 2.0 Flash.
 * Each reviewer scores feasibility, impact, risk and provides feedback.
 * Stores reviews as JSONB on claude_code_plans.reviews.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logUsage, extractOpenAIUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

interface ReviewerConfig {
  id: string;
  name: string;
  role: string;
  icon: string;
  systemPrompt: string;
}

const REVIEWERS: ReviewerConfig[] = [
  {
    id: "architecture",
    name: "Architecture Reviewer",
    role: "Senior Software Architect",
    icon: "building",
    systemPrompt: `You are a senior software architect reviewing a development plan. Focus on:
- Technical feasibility and correctness
- Database schema design and query performance
- Edge function reliability and error handling
- Code organization, separation of concerns, DRY
- Scalability and maintainability
- Security (RLS, auth, input validation)
- Integration patterns (Supabase, external APIs)
Be specific. Reference actual tables, functions, and patterns from the plan.`,
  },
  {
    id: "product",
    name: "Product & UX Reviewer",
    role: "Product Designer & UX Strategist",
    icon: "palette",
    systemPrompt: `You are a product designer and UX strategist reviewing a development plan. Focus on:
- User experience and interaction design
- Does this solve a real user need?
- Loading states, error states, empty states
- Information architecture and navigation
- Accessibility and responsiveness
- Consistency with existing UI patterns
- Whether the feature adds complexity without proportional value
Be specific about UI/UX improvements. Think about the agency user's workflow.`,
  },
  {
    id: "strategy",
    name: "Strategy Reviewer",
    role: "Growth Strategy Director",
    icon: "target",
    systemPrompt: `You are a growth strategy director at a marketing agency reviewing a development plan. Focus on:
- Business value and ROI for the agency
- Alignment with the Agency Brain vision (Connections → Knowledge → Patterns → Insights → Actions → Outcomes → Learning)
- Does this compound intelligence over time?
- Priority relative to other platform needs
- Client-facing value vs internal tooling
- Data-first architecture compliance (local DB, no live API calls on page load)
- Whether this moves toward the self-optimizing website vision
Be specific about strategic alignment and opportunity cost.`,
  },
];

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; usage: any }> {
  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in AI response");

  return { content, usage: result.usage || result };
}

function parseReviewResponse(raw: string): any {
  const cleaned = raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { planId } = await req.json();
    if (!planId) {
      return new Response(
        JSON.stringify({ error: "planId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const SB_URL = Deno.env.get("SUPABASE_URL")!;
    const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SB_URL, SB_KEY, {
      auth: { persistSession: false },
    });

    // Fetch the plan
    const { data: plan, error: planErr } = await supabase
      .from("claude_code_plans")
      .select("id, title, summary, plan_content, research_notes, status, category, priority, effort_estimate, tags")
      .eq("id", planId)
      .single();

    if (planErr || !plan) {
      return new Response(
        JSON.stringify({ error: "Plan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!plan.plan_content && !plan.summary) {
      return new Response(
        JSON.stringify({ error: "Plan has no content to review" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the plan summary for reviewers
    const planText = [
      `# ${plan.title}`,
      `Status: ${plan.status} | Category: ${plan.category} | Priority: ${plan.priority} | Effort: ${plan.effort_estimate || "unestimated"}`,
      plan.tags?.length ? `Tags: ${plan.tags.join(", ")}` : "",
      plan.summary ? `\n## Summary\n${plan.summary}` : "",
      plan.plan_content ? `\n## Plan\n${plan.plan_content}` : "",
      plan.research_notes ? `\n## Research Notes\n${plan.research_notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const userPrompt = `Review the following development plan. Respond with ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "scores": {
    "feasibility": <1-10>,
    "impact": <1-10>,
    "risk": <1-10>,
    "overall": <1-10>
  },
  "verdict": "approve" | "revise" | "rethink",
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"],
  "suggestions": ["suggestion 1", "suggestion 2"]
}

Scoring:
- feasibility: How achievable is this with the current tech stack? (10 = trivial, 1 = impossible)
- impact: How much value does this deliver to users/business? (10 = transformative, 1 = negligible)
- risk: How risky is this? (10 = very risky, 1 = safe). Consider data loss, breaking changes, complexity.
- overall: Your overall recommendation score (10 = must build, 1 = don't build)

Verdicts:
- "approve": Good to build as-is
- "revise": Worth building but needs changes
- "rethink": Fundamental issues, needs different approach

Be specific and actionable. Reference actual details from the plan.

---

${planText}`;

    console.log(`[review-plan] Reviewing plan "${plan.title}" (${planId}) with ${REVIEWERS.length} reviewers`);

    // Run all 3 reviewers in parallel
    const reviewPromises = REVIEWERS.map(async (reviewer) => {
      try {
        const { content, usage } = await callGemini(
          apiKey,
          reviewer.systemPrompt + "\nRespond only with valid JSON.",
          userPrompt
        );

        const parsed = parseReviewResponse(content);

        return {
          reviewer_id: reviewer.id,
          reviewer_name: reviewer.name,
          reviewer_role: reviewer.role,
          icon: reviewer.icon,
          ...parsed,
          raw_response: content,
          status: "completed" as const,
        };
      } catch (e) {
        console.error(`[review-plan] Reviewer ${reviewer.id} failed: ${(e as Error).message}`);
        return {
          reviewer_id: reviewer.id,
          reviewer_name: reviewer.name,
          reviewer_role: reviewer.role,
          icon: reviewer.icon,
          scores: { feasibility: 0, impact: 0, risk: 0, overall: 0 },
          verdict: "error",
          summary: `Review failed: ${(e as Error).message}`,
          strengths: [],
          concerns: [],
          suggestions: [],
          status: "failed" as const,
        };
      }
    });

    const reviews = await Promise.all(reviewPromises);

    // Compute consensus
    const completedReviews = reviews.filter((r) => r.status === "completed");
    const avgScores = {
      feasibility: 0,
      impact: 0,
      risk: 0,
      overall: 0,
    };
    if (completedReviews.length > 0) {
      for (const r of completedReviews) {
        avgScores.feasibility += r.scores.feasibility;
        avgScores.impact += r.scores.impact;
        avgScores.risk += r.scores.risk;
        avgScores.overall += r.scores.overall;
      }
      const n = completedReviews.length;
      avgScores.feasibility = Math.round((avgScores.feasibility / n) * 10) / 10;
      avgScores.impact = Math.round((avgScores.impact / n) * 10) / 10;
      avgScores.risk = Math.round((avgScores.risk / n) * 10) / 10;
      avgScores.overall = Math.round((avgScores.overall / n) * 10) / 10;
    }

    const verdictCounts: Record<string, number> = {};
    for (const r of completedReviews) {
      verdictCounts[r.verdict] = (verdictCounts[r.verdict] || 0) + 1;
    }
    const consensusVerdict =
      Object.entries(verdictCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "unknown";

    const reviewData = {
      reviews,
      consensus: {
        scores: avgScores,
        verdict: consensusVerdict,
        reviewers_completed: completedReviews.length,
        reviewers_total: REVIEWERS.length,
      },
      reviewed_at: new Date().toISOString(),
      plan_version: {
        title: plan.title,
        status: plan.status,
      },
    };

    // Save to DB
    const { error: updateErr } = await supabase
      .from("claude_code_plans")
      .update({ reviews: reviewData })
      .eq("id", planId);

    if (updateErr) {
      console.error(`[review-plan] DB update failed: ${updateErr.message}`);
      throw new Error(`Failed to save reviews: ${updateErr.message}`);
    }

    // Log usage
    try {
      const userId = await getUserIdFromRequest(req);
      await logUsage(userId, "review-plan", "gemini-2.0-flash", 0, 0, {
        planId,
        reviewers: REVIEWERS.length,
        consensus: consensusVerdict,
      });
    } catch {
      // non-fatal
    }

    console.log(
      `[review-plan] Done. Consensus: ${consensusVerdict}, avg overall: ${avgScores.overall}`
    );

    return new Response(JSON.stringify({ success: true, ...reviewData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[review-plan] Error: ${(e as Error).message}`);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
