const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('READABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Readable API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Readable.com scoring URL:', url);

    const timestamp = Math.floor(Date.now() / 1000).toString();

    // MD5(apiKey + timestamp) per Readable docs
    const { crypto: denoCrypto } = await import("https://deno.land/std@0.224.0/crypto/mod.ts");
    const encoder = new TextEncoder();
    const msgBytes = encoder.encode(apiKey + timestamp);
    const hashBuffer = await denoCrypto.subtle.digest("MD5", msgBytes);
    const hashArray = new Uint8Array(hashBuffer);
    const signature = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

    const response = await fetch('https://api.readable.com/api/url/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'API_REQUEST_TIME': timestamp,
        'API_SIGNATURE': signature,
      },
      body: new URLSearchParams({ url }),
    });

    const data = await response.json();

    if (data.result === 'error') {
      console.error('Readable API error:', data.messages);
      return new Response(JSON.stringify({ success: false, error: data.messages?.join('; ') || 'Readable API error' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (data.result !== 'success' && data.result !== 'pass') {
      return new Response(JSON.stringify({ success: false, error: `Unexpected result: ${data.result}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const s = data.scoring || data;

    const result = {
      success: true,
      url: data.url || url,
      // Composite score
      readabilityScore: s.readabilityScore ?? s.readability_score ?? null,
      gradeLevel: s.gradeLevel ?? s.grade_level ?? null,
      rating: s.rating ?? null,
      // Individual formulas
      fleschKincaid: s.fleschKincaid ?? s.flesch_kincaid ?? null,
      fleschReadingEase: s.fleschReadingEase ?? s.flesch_reading_ease ?? null,
      gunningFog: s.gunningFog ?? s.gunning_fog ?? null,
      colemanLiau: s.colemanLiau ?? s.coleman_liau ?? null,
      ari: s.ari ?? s.automated_readability_index ?? null,
      smog: s.smog ?? null,
      daleChall: s.daleChall ?? s.dale_chall ?? null,
      spacheScore: s.spache ?? s.spache_score ?? null,
      linsearWrite: s.linsearWrite ?? s.linsear_write ?? null,
      // Text statistics
      wordCount: s.wordCount ?? s.word_count ?? null,
      sentenceCount: s.sentenceCount ?? s.sentence_count ?? null,
      syllableCount: s.syllableCount ?? s.syllable_count ?? null,
      avgWordsPerSentence: s.avgWordsPerSentence ?? s.average_words_per_sentence ?? null,
      avgSyllablesPerWord: s.avgSyllablesPerWord ?? s.average_syllables_per_word ?? null,
      // Keyword density
      keywordDensity: s.keywordDensity ?? s.keyword_density ?? null,
      // Score ID for highlights
      scoreId: data.score_id ?? data.scoreId ?? null,
      // Raw data for debugging
      raw: data,
    };

    console.log('Readable scoring complete');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Readable error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to score' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
