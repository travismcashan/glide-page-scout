import { logUsage, extractOpenAIUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const SYSTEM_PROMPT = `You are an expert web designer and UX strategist helping a design agency decide which forms require CUSTOM DESIGN for a website redesign project.

CONTEXT: When redesigning a website, not every form needs a unique custom design. Many forms can use standard block-built patterns (simple contact forms, basic newsletter signups). Custom design means a designer creates a unique layout, visual treatment, and UX specifically for that form.

ALWAYS CUSTOM DESIGN (high priority):
- Primary contact/inquiry forms — the main way visitors reach out
- Quote request / lead generation forms — directly tied to revenue
- Demo/trial request forms — key conversion points
- Multi-step or complex forms (file uploads, conditional fields)
- Booking/scheduling forms — critical user journeys
- Registration/signup forms — first impressions matter

USUALLY BLOCK-BUILT (rarely need custom design):
- Simple newsletter signup (email-only field)
- Basic search forms
- Login/auth forms (use standard patterns)
- Cookie consent forms
- Simple feedback/rating widgets
- Duplicate forms that appear globally (design once, reuse)

KEY INSIGHT: Global forms (appearing on many pages) only need to be designed ONCE. Focus custom design effort on forms that drive conversions and represent key user journeys. A well-designed primary contact form template can often serve multiple similar forms.

For each tier (S, M, L), recommend which forms genuinely need custom design. Be opinionated and practical.`;

interface FormInfo {
  formType: string;
  platform: string | null;
  isGlobal: boolean;
  pageCount: number;
  fieldCount: number;
  hasFileUpload: boolean;
  hasCaptcha: boolean;
  description: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { forms, domain } = await req.json();

    if (!forms?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forms list is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiKey = Deno.env.get('GEMINI_API_KEY');
    if (!aiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formList = (forms as FormInfo[])
      .map((f, i) => `- "${f.formType}" (${f.platform || 'Native'}, ${f.fieldCount} fields, on ${f.pageCount} pages${f.isGlobal ? ', GLOBAL' : ''}${f.hasFileUpload ? ', has file upload' : ''}${f.hasCaptcha ? ', has captcha' : ''}${f.description ? ` — ${f.description}` : ''})`)
      .join('\n');

    const total = forms.length;
    const third = Math.round(total / 3);
    const sRange = { min: Math.max(1, third - 1), max: Math.max(2, third + 1) };
    const mRange = { min: Math.max(sRange.max + 1, third * 2 - 1), max: Math.min(total, third * 2 + 1) };
    const lRange = { min: Math.max(mRange.max + 1, total - 2), max: total };

    // Clamp ranges
    if (sRange.max >= mRange.min) mRange.min = sRange.max + 1;
    if (mRange.max >= lRange.min) lRange.min = mRange.max + 1;
    if (lRange.min > total) lRange.min = total;

    const userPrompt = `Website domain: ${domain || 'unknown'}

Here are all ${total} unique forms found on this site:
${formList}

There are ${total} total unique forms. For each tier, recommend which forms should get custom design using ranges relative to this site's form count:
- S tier (${sRange.min}–${sRange.max} forms): The absolute essential forms — the key conversion points
- M tier (${mRange.min}–${mRange.max} forms): A solid set covering all important user journeys
- L tier (${lRange.min}–${lRange.max} forms): Comprehensive — all forms that genuinely benefit from custom design

For each tier, list ONLY form types that need custom design. Everything not listed uses standard block-built form patterns. Choose the exact count within each range that feels right for this specific site.`;

    console.log(`[recommend-forms] Analyzing ${total} forms for ${domain}`);

    const validFormTypes = (forms as FormInfo[]).map(f => f.formType);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'recommend_form_tiers',
              description: 'Return the recommended custom-design forms for each tier. Form type names must exactly match the input list.',
              parameters: {
                type: 'object',
                properties: {
                  S: {
                    type: 'array',
                    items: { type: 'string' },
                    description: `Form types for Small tier (${sRange.min}–${sRange.max} custom designs)`,
                  },
                  M: {
                    type: 'array',
                    items: { type: 'string' },
                    description: `Form types for Medium tier (${mRange.min}–${mRange.max} custom designs)`,
                  },
                  L: {
                    type: 'array',
                    items: { type: 'string' },
                    description: `Form types for Large tier (${lRange.min}–${lRange.max} custom designs)`,
                  },
                  reasoning: {
                    type: 'string',
                    description: 'Brief overall form design strategy summary (1-2 sentences)',
                  },
                  reasoning_S: {
                    type: 'string',
                    description: 'Markdown-formatted explanation for the Small tier: why these forms were chosen, what trade-offs were made. Use **bold** for form names. This is the foundational tier.',
                  },
                  reasoning_M: {
                    type: 'string',
                    description: 'Markdown-formatted explanation for ONLY the forms added in Medium beyond Small. Do NOT repeat Small tier reasoning. Explain what new forms were added and why they matter. Use **bold** for form names.',
                  },
                  reasoning_L: {
                    type: 'string',
                    description: 'Markdown-formatted explanation for ONLY the forms added in Large beyond Medium. Do NOT repeat Small or Medium tier reasoning. Explain what new forms were added and why. Use **bold** for form names.',
                  },
                },
                required: ['S', 'M', 'L', 'reasoning', 'reasoning_S', 'reasoning_M', 'reasoning_L'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'recommend_form_tiers' } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI error:', response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds in Settings → Workspace → Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const userId = getUserIdFromRequest(req);
    const usage = extractOpenAIUsage(aiData);
    logUsage({ ...usage, user_id: userId, provider: 'gemini', model: 'gemini-3-flash-preview', edge_function: 'recommend-forms' });
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let result = { S: [] as string[], M: [] as string[], L: [] as string[], reasoning: '', reasoning_S: '', reasoning_M: '', reasoning_L: '' };

    // Fuzzy match AI-returned form names to actual form names
    function matchFormName(aiName: string, validNames: string[]): string | null {
      // Exact match first
      if (validNames.includes(aiName)) return aiName;
      // Case-insensitive match
      const lower = aiName.toLowerCase().trim();
      const ciMatch = validNames.find(v => v.toLowerCase().trim() === lower);
      if (ciMatch) return ciMatch;
      // Substring match: AI name contains valid name or vice versa
      const subMatch = validNames.find(v =>
        lower.includes(v.toLowerCase().trim()) || v.toLowerCase().trim().includes(lower)
      );
      if (subMatch) return subMatch;
      // Normalized word overlap (>50% of words match)
      const aiWords = new Set(lower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
      let bestScore = 0;
      let bestMatch: string | null = null;
      for (const v of validNames) {
        const vWords = v.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
        const overlap = vWords.filter(w => aiWords.has(w)).length;
        const score = overlap / Math.max(aiWords.size, vWords.length);
        if (score > 0.5 && score > bestScore) {
          bestScore = score;
          bestMatch = v;
        }
      }
      return bestMatch;
    }

    function matchTier(aiNames: string[], validNames: string[]): string[] {
      const matched: string[] = [];
      const used = new Set<string>();
      for (const name of aiNames) {
        const m = matchFormName(name, validNames.filter(v => !used.has(v)));
        if (m) { matched.push(m); used.add(m); }
        else console.warn(`[recommend-forms] Could not match AI form name: "${name}"`);
      }
      return matched;
    }

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        console.log(`[recommend-forms] AI returned S:${parsed.S?.length}, M:${parsed.M?.length}, L:${parsed.L?.length}`, JSON.stringify({ S: parsed.S, M: parsed.M, L: parsed.L }));
        result.S = matchTier(parsed.S || [], validFormTypes);
        result.M = matchTier(parsed.M || [], validFormTypes);
        result.L = matchTier(parsed.L || [], validFormTypes);
        result.reasoning = parsed.reasoning || '';
        result.reasoning_S = parsed.reasoning_S || '';
        result.reasoning_M = parsed.reasoning_M || '';
        result.reasoning_L = parsed.reasoning_L || '';
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    }

    console.log(`[recommend-forms] Results — S:${result.S.length}, M:${result.M.length}, L:${result.L.length}`);

    return new Response(
      JSON.stringify({ success: true, tiers: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in recommend-forms:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to analyze forms' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
