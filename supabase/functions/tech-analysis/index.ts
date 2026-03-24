const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { builtwithData, detectzestackData, wappalyzerData, domain } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI gateway key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build a concise tech inventory from all sources
    const allTechs = new Map<string, { sources: string[]; category: string; version?: string; confidence?: number }>();

    // BuiltWith
    if (builtwithData?.grouped) {
      for (const [cat, techs] of Object.entries(builtwithData.grouped)) {
        for (const t of techs as any[]) {
          const key = t.name.toLowerCase();
          if (allTechs.has(key)) {
            allTechs.get(key)!.sources.push('BuiltWith');
          } else {
            allTechs.set(key, { sources: ['BuiltWith'], category: cat });
          }
        }
      }
    }

    // DetectZeStack
    if (detectzestackData?.grouped) {
      for (const [cat, techs] of Object.entries(detectzestackData.grouped)) {
        for (const t of techs as any[]) {
          const key = t.name.toLowerCase();
          if (allTechs.has(key)) {
            const existing = allTechs.get(key)!;
            existing.sources.push('DetectZeStack');
            if (t.version) existing.version = t.version;
            if (t.confidence) existing.confidence = t.confidence;
          } else {
            allTechs.set(key, { sources: ['DetectZeStack'], category: cat, version: t.version || undefined, confidence: t.confidence || undefined });
          }
        }
      }
    }

    // Wappalyzer
    if (wappalyzerData?.grouped) {
      for (const [cat, techs] of Object.entries(wappalyzerData.grouped)) {
        for (const t of techs as any[]) {
          const key = (t.name || '').toLowerCase();
          if (allTechs.has(key)) {
            allTechs.get(key)!.sources.push('Wappalyzer');
          } else {
            allTechs.set(key, { sources: ['Wappalyzer'], category: cat, version: t.version || undefined });
          }
        }
      }
    }

    // Build concise summary for AI
    const techList = Array.from(allTechs.entries()).map(([name, info]) => {
      let line = `${name} (${info.category})`;
      if (info.version) line += ` v${info.version}`;
      line += ` [${[...new Set(info.sources)].join(', ')}]`;
      return line;
    }).join('\n');

    const sourceCount = [
      builtwithData?.grouped ? 'BuiltWith' : null,
      detectzestackData?.grouped ? 'DetectZeStack' : null,
      wappalyzerData?.grouped ? 'Wappalyzer' : null,
    ].filter(Boolean);

    const systemPrompt = `You are a senior web technology analyst at a digital agency. You've been given a merged tech stack detected across ${sourceCount.length} source(s) (${sourceCount.join(', ')}) for the domain "${domain}".

Provide a concise, actionable analysis in this exact JSON structure. Do NOT wrap in markdown code fences.

{
  "platform": { "name": "e.g. WordPress on WP Engine", "type": "CMS|eCommerce|Custom|SaaS|Static", "modernScore": 1-10 },
  "highlights": ["3-5 key findings about their stack — what stands out, what's outdated, what's strong"],
  "risks": ["2-4 technical risks or concerns based on detected technologies"],
  "recommendations": ["3-5 specific, actionable recommendations for a redesign"],
  "stackAge": "modern|aging|legacy",
  "complexity": "simple|moderate|complex|enterprise"
}

Be specific and reference actual detected technologies. Focus on what matters for a website redesign project.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here are ${allTechs.size} technologies detected for ${domain}:\n\n${techList}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: 'Rate limited — try again shortly' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: 'AI credits exhausted' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ success: false, error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse JSON from response (strip markdown fences if present)
    let analysis: any;
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', content.slice(0, 500));
      return new Response(JSON.stringify({ success: false, error: 'Failed to parse AI analysis' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Tech analysis complete for ${domain}: ${allTechs.size} techs from ${sourceCount.length} sources`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        techCount: allTechs.size,
        sourceCount: sourceCount.length,
        sources: sourceCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Tech analysis error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Tech analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
