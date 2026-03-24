const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const SYSTEM_PROMPT = `You are an expert web designer and information architect. You're helping a design agency decide which page templates require CUSTOM DESIGN for a website redesign project.

CONTEXT: When redesigning a website, not every page needs a unique custom design. Many pages can be built with generic blocks/components (text, accordions, forms). Custom design means a designer creates a unique layout, visual treatment, and UX specifically for that template.

ALWAYS CUSTOM DESIGN (high priority):
- Homepage — always the #1 priority
- Core marketing pages: About, Services/Solutions overview, Pricing, Contact
- Key landing pages that drive conversions
- Portfolio/Case Studies/Work showcase pages
- Product detail or service detail pages (one template covers many)
- Resource hub / listing pages (one template for blog list, one for resource list)

USUALLY BLOCK-BUILT (rarely need custom design):
- Legal/compliance: Privacy Policy, Terms & Conditions, Cookie Policy, Disclaimers
- Utility: Thank You pages, 404, Search Results, Sitemap
- Simple content: FAQ (just accordions), individual team member bios
- Repetitive content detail pages when the listing page template already exists
- Archive/taxonomy pages (category, tag pages)

KEY INSIGHT: A single well-designed "Resource List" template can serve blogs, webinars, podcasts, news, etc. A single "Resource Detail" template can serve blog posts, case studies, whitepapers. Think in terms of REUSABLE design templates, not individual content types.

For each tier (S, M, L), recommend which templates genuinely need custom design. Be opinionated and practical — a 5-template site should still feel complete and professional.`;

interface TemplateInfo {
  name: string;
  baseType: string;
  urlCount: number;
  navSection: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templates, domain, tier } = await req.json();

    if (!templates?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Templates list is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!aiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const templateList = (templates as TemplateInfo[])
      .map(t => `- "${t.name}" (${t.baseType}, ${t.urlCount} URLs${t.navSection ? `, in ${t.navSection} nav` : ''})`)
      .join('\n');

    // Calculate dynamic tier ranges based on total non-toolkit template count
    const total = templates.length;
    const third = Math.round(total / 3);
    const sRange = { min: Math.max(2, third - 1), max: third + 1 };
    const mRange = { min: Math.max(sRange.max + 1, third * 2 - 2), max: third * 2 + 1 };
    const lRange = { min: Math.max(mRange.max + 1, total - 3), max: total };

    const tierSizes = { S: sRange, M: mRange, L: lRange };
    const requestedTier = tier && tierSizes[tier as keyof typeof tierSizes] ? tier : null;

    const userPrompt = `Website domain: ${domain || 'unknown'}

Here are all ${total} unique page templates found on this site:
${templateList}

${requestedTier
  ? `Recommend exactly which templates should get CUSTOM DESIGN for a "${requestedTier}" tier (target ${tierSizes[requestedTier as keyof typeof tierSizes].min}–${tierSizes[requestedTier as keyof typeof tierSizes].max} templates). Pick only the ones that truly need unique design work.`
  : `There are ${total} total templates. For each tier, recommend which templates should get custom design using ranges relative to this site's size:
- S tier (${sRange.min}–${sRange.max} templates): The absolute essentials — the minimum viable set of custom-designed pages
- M tier (${mRange.min}–${mRange.max} templates): A solid redesign covering all key experiences  
- L tier (${lRange.min}–${lRange.max} templates): Comprehensive — all pages that genuinely benefit from custom design

For each tier, list ONLY template names that need custom design. Everything not listed is "block-built" (assembled from generic components). Choose the exact count within each range that feels right for this specific site.`
}`;

    console.log(`[recommend-templates] Analyzing ${templates.length} templates for ${domain}, tier=${requestedTier || 'all'}`);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'recommend_template_tiers',
              description: 'Return the recommended custom-design templates for each tier. Template names must exactly match the input list.',
              parameters: {
                type: 'object',
                properties: {
                  S: {
                    type: 'array',
                    items: { type: 'string' },
                    description: `Template names for Small tier (${sRange.min}–${sRange.max} custom designs)`,
                  },
                  M: {
                    type: 'array',
                    items: { type: 'string' },
                    description: `Template names for Medium tier (${mRange.min}–${mRange.max} custom designs)`,
                  },
                  L: {
                    type: 'array',
                    items: { type: 'string' },
                    description: `Template names for Large tier (${lRange.min}–${lRange.max} custom designs)`,
                  },
                  reasoning: {
                    type: 'string',
                    description: 'Brief overall design strategy summary (1-2 sentences)',
                  },
                  reasoning_S: {
                    type: 'string',
                    description: 'Markdown-formatted explanation for the Small tier: why these ~5 templates were chosen, what trade-offs were made. Use **bold** for template names. This is the foundational tier.',
                  },
                  reasoning_M: {
                    type: 'string',
                    description: 'Markdown-formatted explanation for ONLY the templates added in Medium beyond Small. Do NOT repeat Small tier reasoning. Explain what new templates were added and why they matter. Use **bold** for template names.',
                  },
                  reasoning_L: {
                    type: 'string',
                    description: 'Markdown-formatted explanation for ONLY the templates added in Large beyond Medium. Do NOT repeat Small or Medium tier reasoning. Explain what new templates were added and why. Use **bold** for template names.',
                  },
                },
                required: ['S', 'M', 'L', 'reasoning', 'reasoning_S', 'reasoning_M', 'reasoning_L'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'recommend_template_tiers' } },
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
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let result = { S: [] as string[], M: [] as string[], L: [] as string[], reasoning: '', reasoning_S: '', reasoning_M: '', reasoning_L: '' };
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        const validNames = new Set((templates as TemplateInfo[]).map(t => t.name));
        result.S = (parsed.S || []).filter((n: string) => validNames.has(n));
        result.M = (parsed.M || []).filter((n: string) => validNames.has(n));
        result.L = (parsed.L || []).filter((n: string) => validNames.has(n));
        result.reasoning = parsed.reasoning || '';
        result.reasoning_S = parsed.reasoning_S || '';
        result.reasoning_M = parsed.reasoning_M || '';
        result.reasoning_L = parsed.reasoning_L || '';
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    }

    console.log(`[recommend-templates] Results — S:${result.S.length}, M:${result.M.length}, L:${result.L.length}`);

    return new Response(
      JSON.stringify({ success: true, tiers: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in recommend-templates:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to analyze templates' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
