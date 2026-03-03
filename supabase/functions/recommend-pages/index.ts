const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, discoveredUrls } = await req.json();

    if (!url || !discoveredUrls?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL and discoveredUrls are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const aiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!firecrawlKey || !aiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Scrape the homepage to get its HTML links and structure
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping homepage for nav analysis:', formattedUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'links'],
        onlyMainContent: false, // We need the full page including nav
      }),
    });

    const scrapeData = await scrapeResponse.json();
    const pageLinks = scrapeData.data?.links || scrapeData.links || [];
    const pageMarkdown = scrapeData.data?.markdown || scrapeData.markdown || '';

    // Take the first ~3000 chars of markdown (header/nav area) + all links
    const headerContent = pageMarkdown.substring(0, 3000);

    console.log(`Found ${pageLinks.length} links on homepage, ${discoveredUrls.length} discovered URLs total`);

    // Step 2: Use AI to identify primary navigation pages
    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing website navigation structures. Given:
1. The markdown content from a homepage (especially the header/navigation area)
2. Links found on the homepage
3. All discovered URLs from the site map

Your job is to identify the PRIMARY NAVIGATION PAGES — the main pages a visitor would see in the site's top-level navigation menu (e.g., About, Services, Products, Pricing, Contact, Team, Careers, Case Studies, etc.).

Rules:
- Focus on pages that appear in the main navigation/header menu
- Include the homepage itself
- Include important landing pages that represent core business areas
- EXCLUDE: blog posts, individual articles, utility pages (privacy, terms, sitemap), login/signup, asset URLs, API endpoints, anchored links (#), pagination, search results
- EXCLUDE: deeply nested pages (more than 2 path segments) unless they're clearly primary nav items
- Return ONLY URLs that exist in the discovered URLs list
- Aim for 5-15 pages max — quality over quantity`,
          },
          {
            role: 'user',
            content: `Homepage URL: ${formattedUrl}

Homepage content (first ~3000 chars):
${headerContent}

Links found on homepage:
${pageLinks.slice(0, 100).join('\n')}

All discovered site URLs (${discoveredUrls.length} total):
${discoveredUrls.slice(0, 200).join('\n')}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'select_navigation_pages',
              description: 'Select the primary navigation pages from the discovered URLs',
              parameters: {
                type: 'object',
                properties: {
                  recommended_urls: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', description: 'The full URL of the page' },
                        reason: { type: 'string', description: 'Brief reason why this page was selected (e.g., "Main navigation - Services")' },
                      },
                      required: ['url', 'reason'],
                      additionalProperties: false,
                    },
                    description: 'List of recommended primary navigation page URLs with reasons',
                  },
                },
                required: ['recommended_urls'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'select_navigation_pages' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits in Settings.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await response.text();
      console.error('AI error:', response.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let recommendations: { url: string; reason: string }[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        recommendations = parsed.recommended_urls || [];
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    }

    // Filter to only include URLs that are actually in the discovered list
    const discoveredSet = new Set(discoveredUrls);
    recommendations = recommendations.filter(r => discoveredSet.has(r.url));

    console.log(`AI recommended ${recommendations.length} pages`);

    return new Response(
      JSON.stringify({ success: true, recommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in recommend-pages:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to analyze pages' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
