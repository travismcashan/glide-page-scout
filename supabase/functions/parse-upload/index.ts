import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Extracts text from PDF or DOCX files using the Lovable AI gateway (multimodal).
 * Accepts base64-encoded file content, returns extracted text.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileBase64, fileName, mimeType } = await req.json();

    if (!fileBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: 'fileBase64 and mimeType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use AI to extract text from the document
    const dataUri = `data:${mimeType};base64,${fileBase64}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a document text extractor. Extract ALL text content from the provided document, preserving structure (headings, lists, tables, paragraphs). Output the text in clean markdown format. Do not summarize or omit anything. If the document contains tables, render them as markdown tables.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract all text content from this document (${fileName || 'document'}). Output the full text in markdown format, preserving structure.`,
              },
              {
                type: 'image_url',
                image_url: { url: dataUri },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      return new Response(
        JSON.stringify({ error: `Failed to parse document (${response.status})` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';

    console.log(`[parse-upload] Extracted ${extractedText.length} chars from ${fileName}`);

    return new Response(
      JSON.stringify({ text: extractedText, fileName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('parse-upload error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
