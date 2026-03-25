import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, query, match_count = 20, match_threshold = 0.3 } = await req.json();

    if (!session_id || !query) {
      return new Response(
        JSON.stringify({ error: 'session_id and query required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate embedding for query
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const embResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: query.slice(0, 4000) }] },
          outputDimensionality: 768,
        }),
      }
    );

    if (!embResponse.ok) {
      const err = await embResponse.text();
      console.error('Query embedding error:', err);
      return new Response(
        JSON.stringify({ error: 'Failed to embed query' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const embData = await embResponse.json();
    const queryEmbedding = embData.embedding?.values;
    if (!queryEmbedding) {
      return new Response(
        JSON.stringify({ error: 'No embedding returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform similarity search via database function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: matches, error } = await supabase.rpc('match_knowledge_chunks', {
      p_session_id: session_id,
      p_embedding: `[${queryEmbedding.join(',')}]`,
      p_match_count: match_count,
      p_match_threshold: match_threshold,
    });

    if (error) {
      console.error('Vector search error:', error);
      return new Response(
        JSON.stringify({ error: 'Vector search failed: ' + error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[rag-search] Query "${query.slice(0, 50)}..." returned ${matches?.length || 0} chunks`);

    return new Response(
      JSON.stringify({ success: true, matches: matches || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[rag-search] Error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
