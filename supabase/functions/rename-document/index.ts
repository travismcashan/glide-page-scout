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
    const { document_id, current_name, content_preview, source_type } = await req.json();

    if (!document_id || !content_preview) {
      return new Response(
        JSON.stringify({ success: false, error: 'document_id and content_preview are required' }),
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

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `You are a file naming assistant. Given a document's current name, source type, and a preview of its content, generate a clear, descriptive filename.

Rules:
- Keep it concise: 4-8 words max, under 60 characters
- Make it descriptive of the actual content, not generic
- Don't include file extensions
- Don't include dates unless the content is date-specific
- For web pages: use the page's actual title or topic, not the URL
- For emails: use the subject or key topic
- For uploaded docs: use the document's title or main topic
- Return ONLY the new name, nothing else — no quotes, no explanation`,
          },
          {
            role: 'user',
            content: `Current name: ${current_name}\nSource type: ${source_type || 'unknown'}\n\nContent preview:\n${content_preview.substring(0, 2000)}`,
          },
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI error:', response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limited, please slow down' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'AI request failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const newName = (data.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');

    if (!newName) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI returned empty name' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, document_id, new_name: newName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error renaming document:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to rename' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
