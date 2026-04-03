import { logUsage, extractOpenAIUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";

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
        timeout: 15000, // 15s scrape timeout to stay within edge function limits
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
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pre-process HTML: extract only nav-relevant elements to dramatically reduce size
    let processedHtml = html;

    // Remove script, style, SVG, and comment tags (never nav-relevant)
    processedHtml = processedHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
    processedHtml = processedHtml.replace(/<style[\s\S]*?<\/style>/gi, '');
    processedHtml = processedHtml.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    processedHtml = processedHtml.replace(/<!--[\s\S]*?-->/g, '');

    // Try to extract just the nav-relevant sections
    const navSections: string[] = [];
    // Extract <header> elements
    const headerMatches = processedHtml.match(/<header[\s\S]*?<\/header>/gi) || [];
    navSections.push(...headerMatches);
    // Extract <nav> elements (may be outside header)
    const navMatches = processedHtml.match(/<nav[\s\S]*?<\/nav>/gi) || [];
    for (const nav of navMatches) {
      if (!headerMatches.some(h => h.includes(nav))) navSections.push(nav);
    }
    // Extract <footer> elements
    const footerMatches = processedHtml.match(/<footer[\s\S]*?<\/footer>/gi) || [];
    navSections.push(...footerMatches);

    // Use extracted sections if we found meaningful nav content, otherwise fall back to truncated full HTML
    let truncatedHtml: string;
    const extractedNav = navSections.join('\n');
    if (extractedNav.length > 500 && extractedNav.includes('<a ')) {
      truncatedHtml = extractedNav;
      console.log(`HTML size: ${html.length} -> ${truncatedHtml.length} (extracted header/nav/footer only)`);
    } else {
      // Fallback: remove large non-nav sections
      processedHtml = processedHtml.replace(/<(main|article|section)[\s\S]*?<\/\1>/gi, (match) => {
        if (/<nav/i.test(match)) return match;
        if (match.length < 5000) return match;
        return '';
      });
      processedHtml = processedHtml.replace(/\s{2,}/g, ' ');
      truncatedHtml = processedHtml.length > 60000
        ? processedHtml.substring(0, 30000) + '\n<!-- TRUNCATED -->\n' + processedHtml.substring(processedHtml.length - 30000)
        : processedHtml;
      console.log(`HTML size: ${html.length} -> ${truncatedHtml.length} (fallback truncation)`);
    }

    // Final safety: cap at 60k
    if (truncatedHtml.length > 60000) {
      truncatedHtml = truncatedHtml.substring(0, 30000) + '\n<!-- TRUNCATED -->\n' + truncatedHtml.substring(truncatedHtml.length - 30000);
    }

    // Add 45s timeout on AI call so we fall back to regex sooner
    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 45000);

    let aiResponse: Response;
    try {
    aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      signal: aiController.signal,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${geminiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash-lite',
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
- IMPORTANT: Normalize label casing. Many sites use CSS text-transform to show labels in ALL CAPS, but the underlying text is normal. If a label appears to be ALL CAPS (like "ABOUT US", "END-OF-LIFE CARE", "CONTACT"), convert it to Title Case ("About Us", "End-of-Life Care", "Contact"). Preserve genuine acronyms like FAQ, SEO, CRM, B2B, HIPAA, IT, HR, etc. Use your language understanding to distinguish between acronyms and regular words that were just styled uppercase.
- IMPORTANT: Always include the Homepage as the FIRST item in the primary navigation array, with label "Home" and the base URL of the site. Most sites don't list "Home" explicitly in their nav bar — the logo serves as the homepage link — but you must always add it at the top. If a "Home" link already exists in the nav, keep it as-is in its original position and do NOT add a duplicate.`
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
    } catch (fetchErr: any) {
      clearTimeout(aiTimeout);
      console.error(`AI fetch failed (likely timeout): ${fetchErr.message}`);
      // Fall through to regex fallback below
      aiResponse = null as any;
    }

    let aiData: any = null;
    let aiSuccess = false;

    if (aiResponse && !aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      // Don't return -- fall through to regex fallback
    } else if (aiResponse) {
      try {
        aiData = await aiResponse.json();
        aiSuccess = true;
      } catch {
        console.error('Failed to parse AI response JSON');
      }
    } else {
      console.log('AI request timed out or failed to connect');
    }

    const userId = getUserIdFromRequest(req);
    if (aiData) {
      const usage = extractOpenAIUsage(aiData);
      logUsage({ ...usage, user_id: userId, provider: 'gemini', model: 'gemini-2.5-flash-lite', edge_function: 'nav-extract' });
    }

    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      // Log the full AI response to diagnose the issue
      const msgContent = aiData?.choices?.[0]?.message?.content;
      const finishReason = aiData?.choices?.[0]?.finish_reason;
      if (aiData) {
        console.error(`No tool call in AI response. finish_reason: ${finishReason}, has content: ${!!msgContent}, content preview: ${(msgContent || '').substring(0, 300)}`);
        console.error('Full response keys:', JSON.stringify(Object.keys(aiData?.choices?.[0]?.message || {})));
      } else {
        console.log('No AI data available (timeout or connection error)');
      }

      // Try to parse if AI returned JSON in content instead of tool call
      if (msgContent) {
        try {
          const parsed = JSON.parse(msgContent);
          if (parsed.primary && Array.isArray(parsed.primary)) {
            console.log('Recovered nav data from content instead of tool call');
            // Fall through to normal processing
            const fakeToolCall = { function: { arguments: msgContent } };
            Object.assign(aiData, { choices: [{ ...aiData?.choices?.[0], message: { ...aiData?.choices?.[0]?.message, tool_calls: [fakeToolCall] } }] });
          }
        } catch {
          // Not JSON, continue to error
        }
      }

      // If still no tool call after recovery attempt, use regex-based fallback
      if (!aiData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
        console.log('AI failed, trying regex-based nav extraction fallback');

        function extractLinks(htmlStr: string, baseUrl: string): { label: string; url: string | null }[] {
          const links: { label: string; url: string | null }[] = [];
          const seen = new Set<string>();
          const regex = /<a[^>]*href=["']([^"'#]*)["'][^>]*>([\s\S]*?)<\/a>/gi;
          let match;
          while ((match = regex.exec(htmlStr)) !== null) {
            let href = match[1].trim();
            let label = match[2].replace(/<[^>]*>/g, '').trim();
            if (!label || label.length > 100 || !href) continue;
            // Resolve relative URLs
            if (href.startsWith('/')) href = new URL(href, baseUrl).href;
            if (seen.has(href)) continue;
            seen.add(href);
            links.push({ label, url: href });
          }
          return links;
        }

        const headerHtml = (html.match(/<header[\s\S]*?<\/header>/gi) || []).join('\n');
        const navHtml = (html.match(/<nav[\s\S]*?<\/nav>/gi) || []).join('\n');
        const footerHtml = (html.match(/<footer[\s\S]*?<\/footer>/gi) || []).join('\n');

        const primaryLinks = extractLinks(headerHtml || navHtml, formattedUrl);
        const footerLinks = extractLinks(footerHtml, formattedUrl);
        const primaryUrls = new Set(primaryLinks.map(l => l.url));
        const dedupedFooter = footerLinks.filter(l => !primaryUrls.has(l.url));

        if (primaryLinks.length > 0 || dedupedFooter.length > 0) {
          const result = {
            success: true,
            primary: [{ label: 'Home', url: formattedUrl }, ...primaryLinks],
            secondary: [],
            footer: dedupedFooter,
            totalLinks: primaryLinks.length + dedupedFooter.length + 1,
            items: [{ label: 'Home', url: formattedUrl }, ...primaryLinks],
            extractionMethod: 'regex_fallback',
          };
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({ success: false, error: 'AI did not return structured navigation data and regex fallback found no links' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
