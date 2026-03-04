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

    // ── POLL (non-streaming fallback) ──
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
        const outputParts = pollData.output?.parts || pollData.output?.content?.parts || [];
        report = outputParts.map((p: any) => p.text || '').join('\n');
        if (!report && pollData.output?.text) report = pollData.output.text;
        if (!report && pollData.candidates?.[0]?.content?.parts) {
          report = pollData.candidates[0].content.parts.map((p: any) => p.text || '').join('\n');
        }
      }

      return new Response(
        JSON.stringify({ success: true, state, report, raw: pollData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── RESUME stream ──
    if (action === 'resume') {
      const { interactionId, lastEventId } = body;
      if (!interactionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'interactionId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let resumeUrl = `${GEMINI_API_BASE}/interactions/${interactionId}?stream=true&alt=sse`;
      if (lastEventId) {
        resumeUrl += `&last_event_id=${encodeURIComponent(lastEventId)}`;
      }

      const resumeRes = await fetch(resumeUrl, {
        headers: { 'x-goog-api-key': apiKey },
      });

      if (!resumeRes.ok) {
        const errText = await resumeRes.text();
        console.error('Resume error:', resumeRes.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Resume failed (${resumeRes.status})` }),
          { status: resumeRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Proxy the SSE stream
      return new Response(resumeRes.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ── START with streaming ──
    const { prompt, crawlContext, documents } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build multimodal input
    const inputParts: any[] = [];
    let fullPrompt = prompt;
    if (crawlContext) {
      fullPrompt += `\n\n---\n\nHere is data already gathered about the website:\n\n${crawlContext.substring(0, 60000)}`;
    }
    inputParts.push({ type: 'text', text: fullPrompt });

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

    console.log('Starting Gemini Deep Research (streaming):', prompt.substring(0, 100));

    const startRes = await fetch(
      `${GEMINI_API_BASE}/interactions?alt=sse`,
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
          stream: true,
          agent_config: {
            type: 'deep-research',
            thinking_summaries: 'auto',
          },
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

    // Proxy the SSE stream directly to the client
    return new Response(startRes.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Deep Research error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
