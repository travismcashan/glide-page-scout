const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

function normalizeUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return (parsed.origin + parsed.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return u.replace(/\/+$/, '').toLowerCase();
  }
}

function isCleanUrl(u: string): boolean {
  if (u.includes('#:~:text=')) return false;
  if (u.match(/sitemap.*\.xml$/i)) return false;
  if (u.includes('/feed')) return false;
  if (u.includes('/wp-json/')) return false;
  if (u.includes('/wp-admin/')) return false;
  if (u.includes('-thank-you')) return false;
  return true;
}

const PROMPTS: Record<string, { system: string; functionName: string; functionDesc: string }> = {
  screenshots: {
    system: `You are an expert at analyzing website navigation structures for visual audits.

Given a homepage's content and discovered URLs, identify the KEY TEMPLATE PAGES that represent the site's unique layouts — pages a web designer would screenshot to understand the site's design system.

Rules:
- Focus on pages that represent DISTINCT page templates/layouts
- Always include the homepage
- Include: services list page, a service detail page, blog/news list, a blog post detail, about page, contact page, careers page, portfolio/work page, team page
- Pick ONE representative page per template type (e.g., one blog post, not all of them)
- EXCLUDE: utility pages (privacy, terms, sitemap), login/signup, duplicate templates
- Aim for 5-15 pages — only the key visual templates
- You MUST return URLs exactly as they appear in the "Available URLs" list`,
    functionName: 'select_screenshot_pages',
    functionDesc: 'Select key template pages for screenshots. URLs must exactly match ones from the Available URLs list.',
  },
  content: {
    system: `You are an expert at analyzing websites to understand a company's full offering.

Given a homepage's content and discovered URLs, identify ALL SUBSTANTIVE CONTENT PAGES that help understand who this company is, what they do, and what they offer.

Rules:
- Include ALL service/product pages (every individual service, not just the list)
- Include ALL industry/solution pages
- Include about, team, leadership, values, mission pages
- Include case studies, testimonials, portfolio items
- Include pricing, FAQ, process/how-it-works pages
- Include career/culture pages
- EXCLUDE: blog posts, news articles, individual press releases
- EXCLUDE: utility pages (privacy, terms, sitemap, login/signup)
- EXCLUDE: thank-you pages, landing pages for ads
- Be comprehensive — aim for 10-40+ pages depending on site size
- You MUST return URLs exactly as they appear in the "Available URLs" list`,
    functionName: 'select_content_pages',
    functionDesc: 'Select all substantive content pages to understand the company. URLs must exactly match ones from the Available URLs list.',
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, discoveredUrls, mode = 'screenshots' } = await req.json();

    if (!url || !discoveredUrls?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL and discoveredUrls are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = PROMPTS[mode] || PROMPTS.screenshots;

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const aiKey = Deno.env.get('GEMINI_API_KEY');

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

    const cleanUrls = discoveredUrls.filter((u: string) => isCleanUrl(u));
    const normalizedMap = new Map<string, string>();
    for (const u of cleanUrls) {
      const norm = normalizeUrl(u);
      if (!normalizedMap.has(norm)) normalizedMap.set(norm, u);
    }
    const dedupedUrls = Array.from(normalizedMap.values());

    console.log(`[${mode}] Scraping homepage for nav analysis: ${formattedUrl}`);
    console.log(`[${mode}] Clean URLs: ${dedupedUrls.length} (from ${discoveredUrls.length} raw)`);

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

    const urlsForAI = dedupedUrls.slice(0, 200);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: prompt.system },
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
              name: prompt.functionName,
              description: prompt.functionDesc,
              parameters: {
                type: 'object',
                properties: {
                  recommended_urls: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', description: 'Exact URL from the Available URLs list' },
                        reason: { type: 'string', description: 'Why this page was selected' },
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
        tool_choice: { type: 'function', function: { name: prompt.functionName } },
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

    // Fuzzy match
    const discoveredNormalizedMap = new Map<string, string>();
    for (const u of discoveredUrls) {
      discoveredNormalizedMap.set(normalizeUrl(u), u);
    }

    const matched: { url: string; reason: string }[] = [];
    for (const rec of recommendations) {
      if (discoveredUrls.includes(rec.url)) {
        matched.push(rec);
        continue;
      }
      const norm = normalizeUrl(rec.url);
      const original = discoveredNormalizedMap.get(norm);
      if (original) {
        matched.push({ url: original, reason: rec.reason });
      }
    }

    console.log(`[${mode}] AI recommended ${matched.length} pages (${recommendations.length} raw)`);

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
