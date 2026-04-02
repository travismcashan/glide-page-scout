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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
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

    // Perform hybrid search (vector + BM25 with RRF fusion)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let matches: any[] = [];
    let searchType = 'hybrid';

    const { data: hybridMatches, error } = await supabase.rpc('match_knowledge_chunks_hybrid', {
      p_session_id: session_id,
      p_embedding: `[${queryEmbedding.join(',')}]`,
      p_query: query,
      p_match_count: match_count,
      p_match_threshold: match_threshold,
    });

    if (error) {
      console.error('Hybrid search error:', error);
      // Fallback to vector-only search
      console.log('[rag-search] Falling back to vector-only search');
      const { data: fallbackMatches, error: fallbackError } = await supabase.rpc('match_knowledge_chunks', {
        p_session_id: session_id,
        p_embedding: `[${queryEmbedding.join(',')}]`,
        p_match_count: match_count,
        p_match_threshold: match_threshold,
      });

      if (fallbackError) {
        return new Response(
          JSON.stringify({ error: 'Search failed: ' + fallbackError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      matches = fallbackMatches || [];
      searchType = 'vector_fallback';
      console.log(`[rag-search] Fallback query "${query.slice(0, 50)}..." returned ${matches.length} chunks`);
    } else {
      matches = hybridMatches || [];
      console.log(`[rag-search] Hybrid query "${query.slice(0, 50)}..." returned ${matches.length} chunks`);
    }

    // ── Always-include: fetch Avoma call transcript chunks ──────────────
    // Call transcripts contain the client's own words about their fears,
    // hopes, goals, and requirements — always relevant context.
    try {
      const existingIds = new Set(matches.map((m: any) => m.id));

      // Step 1: Find Avoma document IDs for this session
      const { data: avomaDocs } = await supabase
        .from('knowledge_documents')
        .select('id, name')
        .eq('session_id', session_id)
        .ilike('name', '%Avoma Meeting:%');

      if (avomaDocs?.length) {
        const docIds = avomaDocs.map(d => d.id);
        const docNameMap = new Map(avomaDocs.map(d => [d.id, d.name]));

        // Step 2: Fetch chunks for those documents
        const { data: avomaChunks } = await supabase
          .from('knowledge_chunks')
          .select('id, document_id, chunk_index, chunk_text')
          .eq('session_id', session_id)
          .in('document_id', docIds)
          .order('chunk_index')
          .limit(16);

        if (avomaChunks?.length) {
          let boostCount = 0;
          for (const chunk of avomaChunks) {
            if (!existingIds.has(chunk.id)) {
              matches.push({
                id: chunk.id,
                document_id: chunk.document_id,
                chunk_index: chunk.chunk_index,
                chunk_text: chunk.chunk_text,
                document_name: docNameMap.get(chunk.document_id) || 'Avoma Call Transcript',
                source_type: 'integration',
                similarity: 0.5,
              });
              existingIds.add(chunk.id);
              boostCount++;
            }
          }
          if (boostCount > 0) {
            console.log(`[rag-search] Boosted ${boostCount} Avoma call transcript chunks from ${avomaDocs.length} meetings`);
          }
        }
      }
    } catch (boostError) {
      console.warn('[rag-search] Avoma boost failed (non-blocking):', boostError);
    }

    return new Response(
      JSON.stringify({ success: true, matches, search_type: searchType }),
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
