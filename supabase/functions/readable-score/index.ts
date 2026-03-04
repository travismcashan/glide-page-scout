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

    const rawKey = Deno.env.get('READABLE_API_KEY');
    if (!rawKey) {
      return new Response(JSON.stringify({ success: false, error: 'Readable API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const apiKey = rawKey.trim();

    console.log('Readable.com scoring URL:', url);
    console.log('API key length:', apiKey.length);

    const timestamp = Math.floor(Date.now() / 1000).toString();

    // MD5(apiKey + timestamp) per Readable docs — PHP: md5($api_key . $request_time)
    const { crypto: denoCrypto } = await import("https://deno.land/std@0.224.0/crypto/mod.ts");
    const encoder = new TextEncoder();
    const toSign = apiKey + timestamp;
    const msgBytes = encoder.encode(toSign);
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
      body: new URLSearchParams({ url, extract: 'true' }),
    });

    const d = await response.json();

    if (d.result === 'error') {
      console.error('Readable API error:', d.messages);
      return new Response(JSON.stringify({ success: false, error: d.messages?.join('; ') || 'Readable API error' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (d.result !== 'success') {
      return new Response(JSON.stringify({ success: false, error: `Unexpected result: ${d.result}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map exact API field names to our result
    const result = {
      success: true,
      url,
      // Rating & scores
      rating: d.rating ?? null,
      reach: d.reach ?? null,
      reachPublic: d.reach_public ?? null,
      averageGradeLevel: d.average_grade_level ?? null,
      cefrLevel: d.cefr_level ?? null,
      ieltsLevel: d.ielts_level ?? null,
      // Readability formulas
      fleschReadingEase: d.flesch_reading_ease ?? d.flesch_kincaid_reading_ease ?? null,
      fleschKincaidGradeLevel: d.flesch_kincaid_grade_level ?? null,
      gunningFogScore: d.gunning_fog_score ?? null,
      colemanLiauIndex: d.coleman_liau_index ?? null,
      automatedReadabilityIndex: d.automated_readability_index ?? null,
      smogIndex: d.smog_index ?? null,
      daleChallScore: d.dale_chall_readability_score ?? null,
      spacheScore: d.spache_readability_score ?? null,
      forcastGrade: d.forcast_grade ?? null,
      lixScore: d.lix_score ?? null,
      rixScore: d.rix_score ?? null,
      lensearWrite: d.lensear_write ?? null,
      fryGrade: d.fry_grade ?? null,
      raygorGrade: d.raygor_grade ?? null,
      powersSumnerKearlScore: d.powers_sumner_kearl_score ?? null,
      // Basic statistics
      wordCount: d.word_count ?? null,
      sentenceCount: d.sentence_count ?? null,
      paragraphCount: d.paragraph_count ?? null,
      syllableCount: d.syllable_count ?? null,
      letterCount: d.letter_count ?? null,
      uniqueWordCount: d.unique_word_count ?? null,
      wordsPerSentence: d.words_per_sentence ?? null,
      syllablesPerWord: d.syllables_per_word ?? null,
      lettersPerWord: d.letters_per_word ?? null,
      sentencesPerParagraph: d.sentences_per_paragraph ?? null,
      readingTime: d.reading_time ?? null,
      speakingTime: d.speaking_time ?? null,
      // Tone & sentiment
      sentiment: d.sentiment ?? null,
      sentimentNumber: d.sentiment_number ?? null,
      tone: d.tone ?? null,
      toneNumber: d.tone_number ?? null,
      personal: d.personal ?? null,
      personalNumber: d.personal_number ?? null,
      gender: d.gender ?? null,
      genderNumber: d.gender_number ?? null,
      // Composition
      compositionNouns: d.composition_noun_count ?? null,
      compositionVerbs: d.composition_verb_count ?? null,
      compositionAdjectives: d.composition_adjective_count ?? null,
      compositionAdverbs: d.composition_adverb_count ?? null,
      compositionPronouns: d.composition_pronoun_count ?? null,
      compositionPrepositions: d.composition_preposition_count ?? null,
      compositionConjunctions: d.composition_conjunction_count ?? null,
      // Keyword density
      keywordDensity: d.keyword_density ?? null,
      // Score ID for highlights
      scoreId: d.score_id ?? null,
    };

    console.log('Readable scoring complete, rating:', result.rating);

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
