const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, crawlContext, documents } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let contextBlock = '';
    if (crawlContext) {
      contextBlock += `\n\n---\n\nHere is all the data gathered about the website:\n\n${crawlContext}`;
    }
    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        if (doc.content) {
          contextBlock += `\n\n---\nAttached Document: ${doc.name || 'Untitled'}\n\n${doc.content}`;
        }
      }
    }

    console.log('Generating Observations & Insights for:', domain);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages: [
          {
            role: 'system',
            content: `You are a senior digital strategist and website analyst. You produce structured strategic analysis using a pyramid framework. Your analysis must be specific, actionable, and grounded in the data provided. Use markdown formatting with clear headers and subheaders for each section.

When writing Observations, organize them under these category subheadings:
- Technology & Infrastructure
- User Experience & Design
- Content & SEO
- Performance & Analytics
- Organizational Context
- Competitive Landscape & Market Position

When writing Insights, organize them under these thematic subheadings:
- Strategic Opportunities
- Risk Areas
- Patterns & Correlations

When writing Recommendations, format each one with three clearly labeled parts:
- **Action:** What specifically to do
- **Why:** The reasoning and evidence behind it
- **Impact:** The expected outcome or benefit`,
          },
          {
            role: 'user',
            content: `Review the company at ${domain} using all the documents, transcripts, URLs, site scrape data, and research provided below. Produce the following strategic pyramid:

## 30 Observations
List 30 specific, data-backed observations organized under these subheadings: Technology & Infrastructure, User Experience & Design, Content & SEO, Performance & Analytics, Organizational Context, and Competitive Landscape & Market Position. Each observation should be a single clear, data-backed statement.

## 20 Insights
From the observations above, derive 20 deeper insights organized under these thematic subheadings: Strategic Opportunities, Risk Areas, and Patterns & Correlations. Each insight should synthesize across observation categories to surface patterns, implications, or risks that aren't immediately obvious.

## 10 Recommendations
Provide 10 concrete, prioritized recommendations. For each recommendation, provide:
- **Action:** What specifically to do
- **Why:** The reasoning and evidence behind it
- **Impact:** The expected outcome or benefit

## 5 Strategies
Define 5 high-level strategies that tie the recommendations together into coherent themes or initiatives.

## 3 Keys to Success
Identify the 3 most critical factors that will determine whether this company succeeds in its digital presence.

## 1 North Star
Define the single most important guiding principle or metric this company should orient all digital efforts around.

${contextBlock}`,
          },
        ],
        max_tokens: 16000,
        reasoning_effort: 'high',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('AI Gateway error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error?.message || 'AI request failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = data.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Observations & Insights error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate analysis' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
