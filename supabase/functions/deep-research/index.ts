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

    // ── START: kick off a new background research task, return interaction ID ──
    if (action === 'start') {
      const { prompt, crawlContext, documents } = body;

      if (!prompt) {
        return new Response(
          JSON.stringify({ success: false, error: 'prompt is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build input
      let fullPrompt = prompt;
      if (crawlContext) {
        fullPrompt += `\n\n---\n\nHere is data already gathered about the website:\n\n${crawlContext.substring(0, 60000)}`;
      }

      if (documents && Array.isArray(documents)) {
        for (const doc of documents) {
          if (doc.content) {
            fullPrompt += `\n\n---\nAttached Document: ${doc.name || 'Untitled'}\n\n${doc.content.substring(0, 30000)}`;
          }
        }
      }

      console.log('Starting Gemini Deep Research (background):', prompt.substring(0, 100));

      // Start with background=true but NO streaming — get the interaction ID quickly
      const startRes = await fetch(`${GEMINI_API_BASE}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          input: fullPrompt,
          agent: 'deep-research-pro-preview-12-2025',
          background: true,
          stream: false,
          agent_config: {
            type: 'deep-research',
            thinking_summaries: 'auto',
          },
        }),
      });

      if (!startRes.ok) {
        const errText = await startRes.text();
        console.error('Gemini start error:', startRes.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to start research (${startRes.status}): ${errText}` }),
          { status: startRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const startData = await startRes.json();
      const interactionName = startData.name || startData.id || null;
      const state = startData.state || 'in_progress';

      console.log('Interaction started:', interactionName, 'state:', state);

      return new Response(
        JSON.stringify({ success: true, interactionId: interactionName, state }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── STREAM: connect to an existing interaction's SSE stream ──
    if (action === 'stream') {
      const { interactionId, lastEventId } = body;
      if (!interactionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'interactionId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let streamUrl = `${GEMINI_API_BASE}/${interactionId}?stream=true&alt=sse`;
      if (lastEventId) {
        streamUrl += `&last_event_id=${encodeURIComponent(lastEventId)}`;
      }

      console.log('Connecting to stream for:', interactionId);

      const streamRes = await fetch(streamUrl, {
        headers: { 'x-goog-api-key': apiKey },
      });

      if (!streamRes.ok) {
        const errText = await streamRes.text();
        console.error('Stream error:', streamRes.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Stream failed (${streamRes.status}): ${errText}` }),
          { status: streamRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Proxy the SSE stream to the client
      return new Response(streamRes.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // ── POLL: get current state of an interaction (non-streaming) ──
    if (action === 'poll') {
      const { interactionId } = body;
      if (!interactionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'interactionId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pollUrl = `${GEMINI_API_BASE}/${interactionId}`;
      console.log('Polling interaction:', interactionId);

      const pollRes = await fetch(pollUrl, {
        headers: { 'x-goog-api-key': apiKey },
      });

      if (!pollRes.ok) {
        const errText = await pollRes.text();
        console.error('Gemini poll error:', pollRes.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Poll failed (${pollRes.status})` }),
          { status: pollRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pollData = await pollRes.json();
      return new Response(
        JSON.stringify({ success: true, ...pollData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Deep Research error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
