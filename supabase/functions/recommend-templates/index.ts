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

    const tierSizes = { S: 5, M: 10, L: 15 };
    const requestedTier = tier && tierSizes[tier as keyof typeof tierSizes] ? tier : null;

    const userPrompt = `Website domain: ${domain || 'unknown'}

Here are all ${templates.length} unique page templates found on this site:
${templateList}

${requestedTier
  ? `Recommend exactly which templates should get CUSTOM DESIGN for a "${requestedTier}" tier (target ~${tierSizes[requestedTier as keyof typeof tierSizes]} templates). Pick only the ones that truly need unique design work.`
  : `For each tier, recommend which templates should get custom design:
- S tier (~5 templates): The absolute essentials — if you could only design 5 pages
- M tier (~10 templates): A solid redesign covering all key experiences  
- L tier (~15 templates): Comprehensive — all pages that benefit from custom design

For each tier, list ONLY template names that need custom design. Everything not listed is "block-built" (assembled from generic components).`
}`;

    console.log(`[recommend-templates] Analyzing ${templates.length} templates for ${domain}, tier=${requestedTier || 'all'}`);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        reasoning: { effort: 'high' },
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
                    description: 'Template names for Small tier (~5 custom designs)',
                  },
                  M: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Template names for Medium tier (~10 custom designs)',
                  },
                  L: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Template names for Large tier (~15 custom designs)',
                  },
                  reasoning: {
                    type: 'string',
                    description: 'Brief explanation of the design strategy and why certain templates were grouped together or excluded',
                  },
                },
                required: ['S', 'M', 'L', 'reasoning'],
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

    let result = { S: [] as string[], M: [] as string[], L: [] as string[], reasoning: '' };
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        // Validate template names match input
        const validNames = new Set((templates as TemplateInfo[]).map(t => t.name));
        result.S = (parsed.S || []).filter((n: string) => validNames.has(n));
        result.M = (parsed.M || []).filter((n: string) => validNames.has(n));
        result.L = (parsed.L || []).filter((n: string) => validNames.has(n));
        result.reasoning = parsed.reasoning || '';
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
