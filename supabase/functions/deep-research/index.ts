const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action = 'start' } = body;

    // ── POLL ──
    if (action === 'poll') {
      const { interactionId } = body;
      if (!interactionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'interactionId is required for polling' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pollRes = await fetch(
        `${GEMINI_API_BASE}/interactions/${interactionId}`,
        { headers: { 'x-goog-api-key': apiKey } }
      );

      if (!pollRes.ok) {
        const errText = await pollRes.text();
        console.error('Gemini poll error:', pollRes.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Poll failed (${pollRes.status})` }),
          { status: pollRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pollData = await pollRes.json();
      const state = pollData.state || 'unknown';
      let report: string | null = null;

      if (state === 'completed' || state === 'COMPLETED') {
        // Extract final text from the interaction output
        const outputParts = pollData.output?.parts || pollData.output?.content?.parts || [];
        report = outputParts.map((p: any) => p.text || '').join('\n');
        if (!report && pollData.output?.text) report = pollData.output.text;
        // Fallback: check candidates array
        if (!report && pollData.candidates?.[0]?.content?.parts) {
          report = pollData.candidates[0].content.parts.map((p: any) => p.text || '').join('\n');
        }
      }

      return new Response(
        JSON.stringify({ success: true, state, report, raw: pollData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── START ──
    const { prompt, crawlContext, documents } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the input — can be multimodal
    const inputParts: any[] = [];

    // Main research prompt with crawl context
    let fullPrompt = prompt;
    if (crawlContext) {
      fullPrompt += `\n\n---\n\nHere is data already gathered about the website:\n\n${crawlContext.substring(0, 60000)}`;
    }
    inputParts.push({ type: 'text', text: fullPrompt });

    // Attach documents as inline text (parsed content from frontend)
    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        if (doc.content) {
          inputParts.push({
            type: 'text',
            text: `\n\n---\nAttached Document: ${doc.name || 'Untitled'}\n\n${doc.content.substring(0, 30000)}`,
          });
        }
      }
    }

    console.log('Starting Gemini Deep Research:', prompt.substring(0, 100));

    const startRes = await fetch(
      `${GEMINI_API_BASE}/interactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          input: inputParts.length === 1 ? inputParts[0].text : inputParts,
          agent: 'deep-research-pro-preview-12-2025',
          background: true,
        }),
      }
    );

    if (!startRes.ok) {
      const errText = await startRes.text();
      console.error('Gemini start error:', startRes.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to start research (${startRes.status}): ${errText}` }),
        { status: startRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startData = await startRes.json();
    const interactionId = startData.name || startData.id;

    console.log('Deep Research started, interaction:', interactionId);

    return new Response(
      JSON.stringify({ success: true, interactionId, state: 'in_progress' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Deep Research error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
