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
            content: `You are a web navigation structure extraction expert. You analyze full-page HTML to extract THREE distinct navigation sections from websites.

## Navigation Sections to Extract

### 1. Primary Navigation
The main menu — usually the largest nav bar in the header. Contains the core pages and dropdowns (Services, About, Work, etc.). This is what most people think of as "the nav."

### 2. Secondary Navigation (optional, deduplicated)
A smaller utility bar that often appears ABOVE the primary nav. Common items: phone numbers, "Request a Quote", "Client Login", "Careers", location links, or quick-access utility links. Many sites don't have this — return an empty array if absent. Do NOT confuse CTA buttons within the primary nav (like "Contact Us" or "Get Started") with secondary nav. IMPORTANT: Only include items whose URLs are NOT already present in the primary navigation.

### 3. Footer Navigation (deduplicated)
Links found in the <footer> element. IMPORTANT: Only include footer links whose URLs are NOT already present in the primary OR secondary navigation. If a footer link points to the same URL as a primary/secondary nav item, exclude it. This ensures the footer section only shows unique pages that aren't already represented above.

## Rules
- Preserve the exact hierarchy (parent → children → grandchildren)
- Include the href/URL for each item (resolve relative URLs against: ${formattedUrl})
- If a nav item is a section header with no link, set url to null
- Ignore social media icon links, search buttons, login/signup buttons, and language selectors
- Deduplicate items that appear in both desktop and mobile nav (same URL = same item)
- For footer deduplication: compare by URL path, not label (same URL with different label = duplicate)
- IMPORTANT: Normalize label casing. Many sites use CSS text-transform to show labels in ALL CAPS, but the underlying text is normal. If a label appears to be ALL CAPS (like "ABOUT US", "END-OF-LIFE CARE", "CONTACT"), convert it to Title Case ("About Us", "End-of-Life Care", "Contact"). Preserve genuine acronyms like FAQ, SEO, CRM, B2B, HIPAA, IT, HR, etc. Use your language understanding to distinguish between acronyms and regular words that were just styled uppercase.`
          },
          {
            role: 'user',
            content: `Extract the primary, secondary, and footer navigation from this HTML:\n\n${truncatedHtml}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_navigation',
              description: 'Extract the website navigation structure split into primary, secondary, and deduplicated footer sections',
              parameters: {
                type: 'object',
                properties: {
                  primary: {
                    type: 'array',
                    description: 'Primary/main header navigation items',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string', description: 'Display text of the nav item' },
                        url: { type: ['string', 'null'], description: 'URL, null if section header only' },
                        children: {
                          type: 'array',
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
                  secondary: {
                    type: 'array',
                    description: 'Secondary/utility navigation items (above primary nav). Empty array if none found.',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string' },
                        url: { type: ['string', 'null'] }
                      },
                      required: ['label']
                    }
                  },
                  footer: {
                    type: 'array',
                    description: 'Footer navigation items NOT already in primary or secondary nav (deduplicated by URL)',
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
                  },
                  totalLinks: { type: 'number', description: 'Total count of all unique nav links across all sections' }
                },
                required: ['primary', 'secondary', 'footer', 'totalLinks'],
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

    // Server-side dedup: ensure secondary and footer don't repeat primary URLs
    function collectUrls(items: any[]): Set<string> {
      const urls = new Set<string>();
      for (const item of items) {
        if (item.url) urls.add(item.url.toLowerCase().replace(/\/$/, ''));
        if (item.children) {
          for (const child of item.children) {
            if (child.url) urls.add(child.url.toLowerCase().replace(/\/$/, ''));
            if (child.children) {
              for (const gc of child.children) {
                if (gc.url) urls.add(gc.url.toLowerCase().replace(/\/$/, ''));
              }
            }
          }
        }
      }
      return urls;
    }

    function filterItems(items: any[], excludeUrls: Set<string>): any[] {
      return items.filter((item: any) => {
        if (!item.url) return true; // keep section headers
        return !excludeUrls.has(item.url.toLowerCase().replace(/\/$/, ''));
      }).map((item: any) => ({
        ...item,
        children: item.children ? filterItems(item.children, excludeUrls) : undefined,
      }));
    }

    const primaryUrls = collectUrls(navStructure.primary || []);
    const dedupedSecondary = filterItems(navStructure.secondary || [], primaryUrls);
    const secondaryUrls = collectUrls(dedupedSecondary);
    const allHeaderUrls = new Set([...primaryUrls, ...secondaryUrls]);
    const dedupedFooter = filterItems(navStructure.footer || [], allHeaderUrls);

    const totalLinks = primaryUrls.size + collectUrls(dedupedSecondary).size + collectUrls(dedupedFooter).size;

    console.log(`Navigation extracted: ${totalLinks} total links | Primary: ${navStructure.primary?.length} | Secondary: ${dedupedSecondary.length} | Footer (unique): ${dedupedFooter.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        primary: navStructure.primary || [],
        secondary: dedupedSecondary,
        footer: dedupedFooter,
        totalLinks,
        // Keep backward compat
        items: navStructure.primary || [],
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
