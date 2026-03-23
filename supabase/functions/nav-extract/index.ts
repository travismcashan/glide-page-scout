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
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Scrape the homepage HTML using Firecrawl
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping homepage HTML for nav extraction:', formattedUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['html'],
        onlyMainContent: false, // We need the FULL page including header/nav/footer
        waitFor: 3000, // Wait for JS-rendered mega-menus
      }),
    });

    const scrapeData = await scrapeResponse.json();
    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error('Firecrawl scrape error:', scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || 'Failed to scrape page' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = scrapeData.data?.html || scrapeData.html || '';
    if (!html) {
      return new Response(
        JSON.stringify({ success: false, error: 'No HTML content received from scrape' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Send HTML to AI to extract navigation structure
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Truncate HTML if very large (keep first 150k chars which should include header)
    const truncatedHtml = html.length > 150000 ? html.substring(0, 150000) : html;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a web navigation structure extraction expert. You analyze HTML to extract the primary navigation menu structure from website headers and top-level navigation bars.

Your job is to return a JSON structure representing the navigation hierarchy. Focus on:
1. The PRIMARY header/top navigation (not footer, sidebar, or in-content links)
2. Dropdown/mega-menu items and their children
3. The exact labels and URLs as they appear

Return a JSON object using this tool call structure.

Rules:
- Only extract navigation items from <nav>, <header>, or elements clearly serving as primary navigation
- Preserve the exact hierarchy (parent → children → grandchildren)
- Include the href/URL for each item (resolve relative URLs against the base URL: ${formattedUrl})
- If a nav item is a section header with no link, set url to null
- Ignore social media icon links, search buttons, login/signup buttons, and language selectors
- Ignore utility nav items like "Cart", "My Account" unless they're part of the main nav structure
- Include both desktop and mobile nav structures (they often have the same items)
- Deduplicate items that appear in both desktop and mobile nav`
          },
          {
            role: 'user',
            content: `Extract the primary navigation structure from this HTML:\n\n${truncatedHtml}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_navigation',
              description: 'Extract the website navigation structure as a hierarchical tree',
              parameters: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    description: 'Top-level navigation items',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string', description: 'Display text of the nav item' },
                        url: { type: ['string', 'null'], description: 'URL of the nav item, null if section header only' },
                        children: {
                          type: 'array',
                          description: 'Child/dropdown items',
                          items: {
                            type: 'object',
                            properties: {
                              label: { type: 'string' },
                              url: { type: ['string', 'null'] },
                              children: {
                                type: 'array',
                                items: {
                                  type: 'object',
                                  properties: {
                                    label: { type: 'string' },
                                    url: { type: ['string', 'null'] }
                                  },
                                  required: ['label']
                                }
                              }
                            },
                            required: ['label']
                          }
                        }
                      },
                      required: ['label']
                    }
                  },
                  totalLinks: { type: 'number', description: 'Total count of all nav links (including nested)' }
                },
                required: ['items', 'totalLinks'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_navigation' } }
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds in Settings > Workspace > Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let aiData: any;
    try {
      aiData = await aiResponse.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error('No tool call in AI response:', JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ success: false, error: 'AI did not return structured navigation data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let navStructure: any;
    try {
      navStructure = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error('Failed to parse tool call arguments:', toolCall.function.arguments);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse navigation structure' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Navigation extracted: ${navStructure.totalLinks} links, ${navStructure.items?.length} top-level items`);

    return new Response(
      JSON.stringify({
        success: true,
        items: navStructure.items || [],
        totalLinks: navStructure.totalLinks || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('nav-extract error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
