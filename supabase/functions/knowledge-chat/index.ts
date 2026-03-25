import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, crawlContext, documents, model, reasoning } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate model against allowlist
    const ALLOWED_MODELS = [
      'google/gemini-2.5-flash-lite',
      'google/gemini-2.5-flash',
      'google/gemini-3-flash-preview',
      'google/gemini-2.5-pro',
      'google/gemini-3.1-pro-preview',
      'openai/gpt-5-nano',
      'openai/gpt-5-mini',
      'openai/gpt-5',
      'openai/gpt-5.2',
    ];
    const selectedModel = ALLOWED_MODELS.includes(model) ? model : 'google/gemini-3-flash-preview';

    // Validate reasoning effort
    const ALLOWED_REASONING = ['low', 'medium', 'high', 'xhigh'];
    const selectedReasoning = reasoning && ALLOWED_REASONING.includes(reasoning) ? reasoning : undefined;

    // Build system prompt with crawl context
    const MAX_CHARS = 400_000;
    let contextBlock = '';

    if (crawlContext) {
      const available = MAX_CHARS - 2000;
      contextBlock = crawlContext.length > available
        ? crawlContext.slice(0, available) + '\n\n[… context truncated to fit token limit]'
        : crawlContext;
    }

    // Append documents if provided
    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        if (doc.content && contextBlock.length < MAX_CHARS) {
          const space = MAX_CHARS - contextBlock.length - 100;
          if (space > 0) {
            const trimmedDoc = doc.content.length > space
              ? doc.content.slice(0, space) + '\n\n[… document truncated]'
              : doc.content;
            contextBlock += `\n\n---\nAttached Document: ${doc.name || 'Untitled'}\n\n${trimmedDoc}`;
          }
        }
      }
    }

    const systemPrompt = `You are an expert website analyst and digital strategist with deep knowledge of SEO, performance optimization, security, accessibility, and marketing technology.

You have access to comprehensive audit data from multiple integration tools. When answering questions:

1. **Cite your sources**: Always reference the specific integration by name (e.g., "According to the SEMrush Domain Analysis…", "The WAVE Accessibility scan found…", "Based on the PageSpeed Insights data…").
2. **Stay grounded in the data**: Base your answers on the actual data provided. Don't fabricate metrics or findings.
3. **Be specific**: Quote actual numbers, scores, grades, and findings from the data.
4. **Be consultative**: Provide actionable recommendations when appropriate.
5. **Cross-reference**: When multiple integrations provide related data, connect the dots to give a holistic picture.
6. **File attachments**: When users attach files or images, analyze them in the context of the website audit. For images/screenshots, describe what you see and relate it to audit findings.

If asked about something not covered by the available data, say so clearly rather than guessing.

${contextBlock ? `\n---\n\nHere is all the audit data gathered about this website:\n\n${contextBlock}` : '\nNo audit data is currently available for this session.'}`;

    console.log(`[knowledge-chat] Model: ${selectedModel}, Reasoning: ${selectedReasoning || 'none'}, Context: ${contextBlock.length} chars (~${Math.round(contextBlock.length / 4)} tokens), Messages: ${messages.length}`);

    // Build request body
    const requestBody: any = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
    };

    // Add reasoning if specified
    if (selectedReasoning) {
      requestBody.reasoning = { effort: selectedReasoning };
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds in Settings → Workspace → Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      return new Response(
        JSON.stringify({ error: `AI gateway error (${response.status})` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (e) {
    console.error('knowledge-chat error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
