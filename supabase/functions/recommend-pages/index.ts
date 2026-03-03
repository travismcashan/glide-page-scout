const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Normalize URL for comparison: strip trailing slash, fragment, query
function normalizeUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return (parsed.origin + parsed.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return u.replace(/\/+$/, '').toLowerCase();
  }
}

// Filter out junk URLs before sending to AI
function isCleanUrl(u: string): boolean {
  // Skip fragment-heavy URLs, sitemaps, feeds
  if (u.includes('#:~:text=')) return false;
  if (u.match(/sitemap.*\.xml$/i)) return false;
  if (u.includes('/feed')) return false;
  if (u.includes('/wp-json/')) return false;
  if (u.includes('/wp-admin/')) return false;
  // Skip thank-you pages
  if (u.includes('-thank-you')) return false;
  return true;
}

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

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Pre-clean discovered URLs - remove fragments, sitemaps, etc.
    const cleanUrls = discoveredUrls.filter((u: string) => isCleanUrl(u));
    // Deduplicate by normalized form, keep original URL
    const normalizedMap = new Map<string, string>();
    for (const u of cleanUrls) {
      const norm = normalizeUrl(u);
      if (!normalizedMap.has(norm)) {
        normalizedMap.set(norm, u);
      }
    }
    const dedupedUrls = Array.from(normalizedMap.values());

    console.log(`Scraping homepage for nav analysis: ${formattedUrl}`);
    console.log(`Clean URLs: ${dedupedUrls.length} (from ${discoveredUrls.length} raw)`);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'links'],
        onlyMainContent: false,
      }),
    });

    const scrapeData = await scrapeResponse.json();
    const pageLinks: string[] = (scrapeData.data?.links || scrapeData.links || []).filter((u: string) => isCleanUrl(u));
    const pageMarkdown: string = scrapeData.data?.markdown || scrapeData.markdown || '';

    const headerContent = pageMarkdown.substring(0, 4000);

    console.log(`Found ${pageLinks.length} clean links on homepage`);

    // Only send clean, deduped URLs to AI (cap at 150)
    const urlsForAI = dedupedUrls.slice(0, 150);

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
            content: `You are an expert at analyzing website navigation structures.

Given a homepage's content and discovered URLs, identify the PRIMARY NAVIGATION PAGES — the pages in the site's main nav menu (e.g., About, Services, Products, Pricing, Contact, Team, Work/Portfolio, Industries, etc.).

Rules:
- Focus on pages visible in the header/main navigation
- Include the homepage
- Include key service/product pages and important landing pages
- EXCLUDE: blog posts, individual articles, utility pages (privacy, terms, sitemap), login/signup
- You MUST return URLs exactly as they appear in the "Available URLs" list below — copy them character-for-character
- Aim for 5-15 pages`,
          },
          {
            role: 'user',
            content: `Homepage: ${formattedUrl}

Homepage content (header/nav area):
${headerContent}

Links found on homepage (likely nav items):
${pageLinks.slice(0, 50).join('\n')}

Available URLs to choose from:
${urlsForAI.join('\n')}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'select_navigation_pages',
              description: 'Select the primary navigation pages. URLs must exactly match ones from the Available URLs list.',
              parameters: {
                type: 'object',
                properties: {
                  recommended_urls: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', description: 'Exact URL from the Available URLs list' },
                        reason: { type: 'string', description: 'Why this page matters (e.g., "Primary nav — Services")' },
                      },
                      required: ['url', 'reason'],
                      additionalProperties: false,
                    },
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
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits in Settings.' }),
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

    console.log('AI raw response tool_calls:', JSON.stringify(aiData.choices?.[0]?.message?.tool_calls));

    let recommendations: { url: string; reason: string }[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        recommendations = parsed.recommended_urls || [];
        console.log(`AI returned ${recommendations.length} raw recommendations`);
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    } else {
      // Fallback: check if the model returned content instead of tool call
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        console.log('AI returned content instead of tool call:', content.substring(0, 200));
      }
    }

    // Fuzzy match: normalize both sides for comparison
    const discoveredNormalizedMap = new Map<string, string>();
    for (const u of discoveredUrls) {
      discoveredNormalizedMap.set(normalizeUrl(u), u);
    }

    const matched: { url: string; reason: string }[] = [];
    for (const rec of recommendations) {
      // Try exact match first
      if (discoveredUrls.includes(rec.url)) {
        matched.push(rec);
        continue;
      }
      // Try normalized match
      const norm = normalizeUrl(rec.url);
      const original = discoveredNormalizedMap.get(norm);
      if (original) {
        matched.push({ url: original, reason: rec.reason });
      } else {
        console.log(`No match for AI recommendation: ${rec.url}`);
      }
    }

    console.log(`AI recommended ${matched.length} pages (${recommendations.length} raw, ${matched.length} matched)`);

    return new Response(
      JSON.stringify({ success: true, recommendations: matched }),
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
