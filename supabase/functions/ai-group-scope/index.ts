const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const SYSTEM_PROMPT = `You are an expert web strategist helping a digital agency scope a multi-site redesign project. You're analyzing a GROUP of similar websites (same industry/vertical) to determine which templates, content types, and navigation items should be included in a unified design system.

CONTEXT: The agency is proposing to redesign multiple sites using a shared design system. Items that appear across many sites are strong candidates for the shared system. Items unique to one site may or may not be worth including depending on their strategic value.

YOUR JOB: Recommend which items to INCLUDE in the project scope for each category (templates, content types, nav items). Think like a strategist building a proposal:

TEMPLATES - Which page templates need custom design?
- Homepage, About, Contact, Services are almost always needed
- Template that appears on 80%+ of sites = definitely include
- Template on 40-80% = include if strategically important
- Template on <40% = only include if it's high-value (e.g., Provider Directory for healthcare)
- Utility pages (404, sitemap, privacy) rarely need custom design

CONTENT TYPES - Which content types should the CMS support?
- Types appearing across most sites = core content model
- Types on fewer sites = consider if they add strategic value
- Rare types = usually skip unless specifically requested

NAV ITEMS - Which navigation items belong in the shared nav structure?
- Items on most sites = core navigation
- Items on some sites = optional/secondary
- Items on very few sites = site-specific customization

Be opinionated and practical. The goal is a focused, achievable scope that covers the common patterns while noting important exceptions.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templates, contentTypes, navItems, siteCount, groupName } = await req.json();

    const aiKey = Deno.env.get('GEMINI_API_KEY');
    if (!aiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the analysis prompt
    const templateList = (templates || [])
      .map((t: any) => `- "${t.name}" (${t.baseType}, on ${t.siteCount}/${siteCount} sites)`)
      .join('\n');

    const contentTypeList = (contentTypes || [])
      .map((c: any) => `- "${c.name}" (${c.baseType}, on ${c.siteCount}/${siteCount} sites, ~${c.avgPages} pages/site)`)
      .join('\n');

    const navItemList = (navItems || [])
      .map((n: any) => `- "${n.name}" (on ${n.siteCount}/${siteCount} sites)`)
      .join('\n');

    const userPrompt = `Group: "${groupName || 'Multi-site project'}" (${siteCount} sites)

TEMPLATES (${templates?.length || 0} unique):
${templateList || 'No template data available'}

CONTENT TYPES (${contentTypes?.length || 0} unique):
${contentTypeList || 'No content type data available'}

NAVIGATION ITEMS (${navItems?.length || 0} unique):
${navItemList || 'No navigation data available'}

Recommend which items to include in the unified project scope. For each category, select the items that should be part of the shared design system. Be strategic — include items that are common across sites AND items that are uncommon but strategically important.`;

    console.log(`[ai-group-scope] Analyzing ${siteCount} sites: ${templates?.length || 0} templates, ${contentTypes?.length || 0} content types, ${navItems?.length || 0} nav items`);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'recommend_scope',
              description: 'Return the recommended items to include in the project scope. Item names must EXACTLY match the input list.',
              parameters: {
                type: 'object',
                properties: {
                  templates: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Template names to include in scope',
                  },
                  contentTypes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Content type names to include in scope',
                  },
                  navItems: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Navigation item labels to include in scope',
                  },
                  reasoning: {
                    type: 'string',
                    description: 'Brief explanation of the scope strategy (2-3 sentences)',
                  },
                },
                required: ['templates', 'contentTypes', 'navItems', 'reasoning'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'recommend_scope' } },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ai-group-scope] AI error: ${response.status}`, errText);
      return new Response(
        JSON.stringify({ success: false, error: `AI request failed: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error('[ai-group-scope] No tool call in response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ success: false, error: 'AI did not return structured recommendations' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recommendations = JSON.parse(toolCall.function.arguments);
    console.log(`[ai-group-scope] Recommended: ${recommendations.templates?.length} templates, ${recommendations.contentTypes?.length} content types, ${recommendations.navItems?.length} nav items`);

    return new Response(
      JSON.stringify({ success: true, recommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[ai-group-scope] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
