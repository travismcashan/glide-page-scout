import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CHUNK_SIZE = 1500;    // ~375 tokens per chunk
const CHUNK_OVERLAP = 200;  // overlap for context continuity
const EMBEDDING_MODEL = 'google/gemini-2.5-flash-lite';
const BATCH_SIZE = 20;      // embeddings per batch

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  if (!text || text.length < 50) return chunks;

  // Try to split on paragraph boundaries first
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      // Keep overlap from end of previous chunk
      const overlapText = current.slice(-CHUNK_OVERLAP);
      current = overlapText + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If no paragraph splits worked (e.g., one giant block), fall back to character splitting
  if (chunks.length === 1 && chunks[0].length > CHUNK_SIZE * 2) {
    const bigText = chunks[0];
    chunks.length = 0;
    for (let i = 0; i < bigText.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      chunks.push(bigText.slice(i, i + CHUNK_SIZE).trim());
    }
  }

  return chunks.filter(c => c.length > 30);
}

async function getEmbeddings(texts: string[], apiKey: string): Promise<(number[] | null)[]> {
  // Use Lovable AI gateway for embeddings via chat completion trick:
  // We'll use Google's text-embedding model via the gateway
  const results: (number[] | null)[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    for (const text of batch) {
      try {
        // Use Gemini to generate embeddings via the embedding endpoint
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!GEMINI_API_KEY) {
          console.error('GEMINI_API_KEY not configured');
          results.push(null);
          continue;
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'models/gemini-embedding-001',
              content: { parts: [{ text: text.slice(0, 8000) }] },
              outputDimensionality: 768,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.text();
          console.error(`Embedding error: ${response.status} ${err}`);
          results.push(null);
          continue;
        }

        const data = await response.json();
        const embedding = data.embedding?.values;
        results.push(embedding || null);
      } catch (e) {
        console.error('Embedding request failed:', e);
        results.push(null);
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

function hashContent(text: string): string {
  // Simple hash for dedup
  let hash = 0;
  for (let i = 0; i < Math.min(text.length, 2000); i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { session_id, documents } = await req.json();

    if (!session_id || !documents || !Array.isArray(documents)) {
      return new Response(
        JSON.stringify({ error: 'session_id and documents array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[rag-ingest] Processing ${documents.length} documents for session ${session_id}`);

    const results: any[] = [];

    for (const doc of documents) {
      const { name, content, source_type = 'upload', source_key, skip_dedup } = doc;

      if (!name || !content) {
        results.push({ name, status: 'skipped', reason: 'missing name or content' });
        continue;
      }

      const contentHash = hashContent(content);

      // Check for existing document with same hash (skip if skip_dedup flag is set)
      if (!skip_dedup) {
        const { data: existing } = await supabase
          .from('knowledge_documents')
          .select('id')
          .eq('session_id', session_id)
          .eq('content_hash', contentHash)
          .maybeSingle();

        if (existing) {
          results.push({ name, status: 'skipped', reason: 'duplicate content' });
          continue;
        }
      }

      // Create document record
      const { data: docRecord, error: docError } = await supabase
        .from('knowledge_documents')
        .insert({
          session_id,
          name,
          source_type,
          source_key,
          content_hash: contentHash,
          char_count: content.length,
          status: 'processing',
        })
        .select('id')
        .single();

      if (docError || !docRecord) {
        console.error('Failed to create document:', docError);
        results.push({ name, status: 'error', reason: docError?.message });
        continue;
      }

      // Chunk the content
      const chunks = chunkText(content);
      console.log(`[rag-ingest] ${name}: ${chunks.length} chunks from ${content.length} chars`);

      // Generate embeddings
      const embeddings = await getEmbeddings(chunks, '');

      // Insert chunks with embeddings
      const chunkRows = chunks.map((chunk_text, idx) => ({
        document_id: docRecord.id,
        session_id,
        chunk_index: idx,
        chunk_text,
        embedding: embeddings[idx] ? `[${embeddings[idx]!.join(',')}]` : null,
      }));

      const { error: chunkError } = await supabase
        .from('knowledge_chunks')
        .insert(chunkRows);

      if (chunkError) {
        console.error('Failed to insert chunks:', chunkError);
        await supabase.from('knowledge_documents')
          .update({ status: 'error', error_message: chunkError.message })
          .eq('id', docRecord.id);
        results.push({ name, status: 'error', reason: chunkError.message });
        continue;
      }

      // Update document status
      const embeddedCount = embeddings.filter(e => e !== null).length;
      await supabase.from('knowledge_documents')
        .update({
          status: 'ready',
          chunk_count: chunks.length,
        })
        .eq('id', docRecord.id);

      results.push({
        name,
        status: 'ready',
        chunks: chunks.length,
        embedded: embeddedCount,
        chars: content.length,
      });
    }

    console.log(`[rag-ingest] Complete: ${results.filter(r => r.status === 'ready').length}/${documents.length} documents processed`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[rag-ingest] Error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
