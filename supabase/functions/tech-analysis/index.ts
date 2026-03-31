import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractOrchestration } from "../_shared/orchestration.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const body = await req.json();
  const orch = extractOrchestration(body);
  if (orch) await orch.markRunning();

  try {
    let { builtwithData, detectzestackData, domain } = body;

    // If invoked via orchestration, fetch data from the session
    if (orch && (!builtwithData || !detectzestackData)) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sb = createClient(supabaseUrl, serviceKey);

      const { data: session } = await sb
        .from('crawl_sessions')
        .select('domain, builtwith_data, detectzestack_data')
        .eq('id', orch.sessionId)
        .single();

      if (session) {
        domain = domain || session.domain;
        builtwithData = builtwithData || session.builtwith_data;
        detectzestackData = detectzestackData || session.detectzestack_data;
      }
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      const err = 'AI gateway key not configured';
      if (orch) await orch.markFailed(err);
      return new Response(
        JSON.stringify({ success: false, error: err }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build a concise tech inventory from all sources
    const allTechs = new Map<string, { sources: string[]; category: string; version?: string; confidence?: number }>();

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

    // If no tech data available from either source, return a soft error
    if (allTechs.size === 0) {
      const err = 'No tech stack data available — neither BuiltWith nor DetectZeStack returned data';
      if (orch) await orch.markFailed(err);
      return new Response(
        JSON.stringify({ success: false, error: err }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Note: proceeds with whichever source(s) have data — builtwith alone, detectzestack alone, or both

    const techList = Array.from(allTechs.entries()).map(([name, info]) => {
      let line = `${name} (${info.category})`;
      if (info.version) line += ` v${info.version}`;
      line += ` [${[...new Set(info.sources)].join(', ')}]`;
      return line;
    }).join('\n');

    const sourceCount = [
      builtwithData?.grouped ? 'BuiltWith' : null,
      detectzestackData?.grouped ? 'DetectZeStack' : null,
    ].filter(Boolean);

    const systemPrompt = `You are a senior web technology analyst at a digital agency preparing a website redesign estimate. You've been given a merged tech stack detected across ${sourceCount.length} source(s) (${sourceCount.join(', ')}) for the domain "${domain}".

Return a JSON object with TWO sections. Do NOT wrap in markdown code fences.

{
  "findings": {
    "platform": { "name": "e.g. WordPress on WP Engine", "type": "CMS|eCommerce|Custom|SaaS|Static", "modernScore": 1-10 },
    "highlights": ["3-5 key findings about their stack — what stands out, what's outdated, what's strong"],
    "risks": ["2-4 technical risks or concerns based on detected technologies"],
    "stackAge": "modern|aging|legacy",
    "complexity": "simple|moderate|complex|enterprise"
  },
  "scope": {
    "platforms": [
      { "name": "e.g. WordPress", "role": "CMS", "note": "optional brief note" },
      { "name": "e.g. WP Engine", "role": "Hosting", "note": "optional" }
    ],
    "plugins": [
      { "name": "e.g. Gravity Forms", "purpose": "Form builder", "effort": "low|medium|high" },
      { "name": "e.g. Yoast SEO", "purpose": "SEO management", "effort": "low|medium|high" }
    ],
    "tagManagement": {
      "manager": "e.g. Google Tag Manager",
      "coveredTags": ["Google Analytics", "LinkedIn Ads", "etc — tags managed via the tag manager, no separate integration needed"]
    },
    "thirdPartyIntegrations": [
      { "name": "e.g. Salesforce", "type": "CRM|Payment|Newsletter|Chat|Booking|Auth|Search|Other", "effort": "low|medium|high", "note": "brief scope note" }
    ],
    "specialSetup": [
      { "name": "e.g. reCAPTCHA", "reason": "Requires API key setup and form integration", "effort": "low|medium|high" }
    ]
  }
}

IMPORTANT RULES for the scope section:
- "platforms" = the core hosting/CMS/eCommerce platforms the redesign will be built on
- "plugins" = CMS plugins (WordPress plugins, Shopify apps, etc.) that need to be configured
- "tagManagement" = if a tag manager exists, list it ONCE and put all analytics/tracking/ad tags under "coveredTags" — do NOT list each tag as a separate integration
- "thirdPartyIntegrations" = external services requiring human setup (CRM, payment, newsletter, live chat, booking, SSO, etc.)
- "specialSetup" = things requiring special technical configuration (CAPTCHA, SSO/SAML, CDN, custom API integrations)
- effort: "low" = config only, "medium" = some dev work, "high" = significant custom development
- Be specific — reference actual detected technologies, not generic categories`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here are ${allTechs.size} technologies detected for ${domain}:\n\n${techList}` },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      const errMsg = response.status === 429 ? 'Rate limited — try again shortly'
        : response.status === 402 ? 'AI credits exhausted'
        : 'AI analysis failed';
      if (orch) await orch.markFailed(errMsg);
      return new Response(JSON.stringify({ success: false, error: errMsg }),
        { status: response.status === 429 ? 429 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let analysis: any;
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', content.slice(0, 500));
      const errMsg = 'Failed to parse AI analysis';
      if (orch) await orch.markFailed(errMsg);
      return new Response(JSON.stringify({ success: false, error: errMsg }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Tech analysis complete for ${domain}: ${allTechs.size} techs from ${sourceCount.length} sources`);

    const result = {
      success: true,
      analysis,
      techCount: allTechs.size,
      sourceCount: sourceCount.length,
      sources: sourceCount,
    };

    if (orch) await orch.markDone(result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Tech analysis error:', error);
    const errMsg = error instanceof Error ? error.message : 'Tech analysis failed';
    if (orch) await orch.markFailed(errMsg);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
