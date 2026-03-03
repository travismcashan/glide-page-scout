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
    const { content, pageTitle, pageUrl } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content is required' }),
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

    console.log('Generating AI outline for:', pageUrl || pageTitle);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a sales prep assistant. Given raw website page content, create a clean, structured content outline for sales preparation. Format as markdown with:
- Page purpose/type (e.g., "Homepage", "About", "Services", "Pricing")
- Key messaging and value propositions
- Main sections with brief summaries
- Call-to-action elements
- Notable features or differentiators
Keep it concise and actionable for a sales team preparing for a prospect meeting.`,
          },
          {
            role: 'user',
            content: `Page: ${pageTitle || 'Unknown'}\nURL: ${pageUrl || 'Unknown'}\n\nContent:\n${content.substring(0, 8000)}`,
          },
        ],
        max_tokens: 1500,
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

    const outline = data.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ success: true, outline }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating outline:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate outline' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
