import { logUsage, extractOpenAIUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, overallScore } = await req.json();

    if (!overallScore || !overallScore.categories?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'overallScore with categories is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the scoring summary for the LLM
    const categorySummary = overallScore.categories.map((cat: any) => {
      const integrations = cat.integrations.map((i: any) => `${i.label}: ${i.score}`).join(', ');
      const strengths = cat.strengths?.map((s: any) => s.summary).join('; ') || 'none';
      const gaps = cat.gaps?.map((s: any) => s.summary).join('; ') || 'none';
      return `${cat.label} (${cat.grade}, ${cat.score}/100): Integrations: ${integrations}. Strengths: ${strengths}. Gaps: ${gaps}.`;
    }).join('\n');

    const topStrengths = overallScore.topStrengths?.map((s: any) => s.summary).join('; ') || 'none';
    const topGaps = overallScore.topGaps?.map((s: any) => s.summary).join('; ') || 'none';

    const prompt = `You are a website health analyst for a growth marketing agency. Analyze these crawl results and provide insights.

OVERALL SCORE: ${overallScore.grade} (${overallScore.score}/100)
TOP STRENGTHS: ${topStrengths}
TOP GAPS: ${topGaps}

CATEGORY BREAKDOWN:
${categorySummary}

Respond with ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "executive_summary": "3-5 sentences interpreting the overall health. Be specific about what's strong, what needs work, and why it matters for the business. Use a professional but warm tone.",
  "category_insights": {
    "${overallScore.categories.map((c: any) => c.key).join('": "2-3 sentences about this category...",\n    "')}" : "2-3 sentences about this category..."
  },
  "priority_actions": [
    {"action": "specific action verb + what to do", "category": "category-key", "impact": "high|medium|low"}
  ]
}

Rules:
- executive_summary should be 3-5 sentences, conversational but professional
- Each category_insight should be 2-3 sentences specific to that category's data
- priority_actions should be 3-5 items, ordered by impact (high first)
- Use the actual scores and integration names in your insights
- Focus on actionable recommendations, not just observations
- Category keys must match exactly: ${overallScore.categories.map((c: any) => c.key).join(', ')}`;

    console.log(`[generate-crawl-insights] Generating for session ${sessionId}, score ${overallScore.grade} (${overallScore.score})`);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'system', content: 'You are a website health analyst. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-crawl-insights] API error:', response.status, errorText);
      throw new Error(`AI API returned ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON — handle markdown code blocks if returned
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[generate-crawl-insights] Failed to parse AI response:', content);
      throw new Error('Failed to parse AI response as JSON');
    }

    const insights = {
      executive_summary: parsed.executive_summary || '',
      category_insights: parsed.category_insights || {},
      priority_actions: parsed.priority_actions || [],
      generated_at: new Date().toISOString(),
    };

    // Log usage
    try {
      const userId = await getUserIdFromRequest(req);
      const usage = extractOpenAIUsage(result);
      await logUsage(userId, 'generate-crawl-insights', 'gemini-2.0-flash', usage.promptTokens, usage.completionTokens, { sessionId });
    } catch (e) {
      console.warn('[generate-crawl-insights] Usage logging failed:', e);
    }

    console.log(`[generate-crawl-insights] Generated successfully: ${insights.executive_summary.substring(0, 80)}...`);

    return new Response(
      JSON.stringify({ success: true, insights }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-crawl-insights] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
