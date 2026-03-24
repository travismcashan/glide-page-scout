const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

function normalizeUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return (parsed.origin + parsed.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return u.replace(/\/+$/, '').toLowerCase();
  }
}

// Industry-specific template presets — the AI picks one and maps URLs accordingly
const INDUSTRY_PRESETS: Record<string, string[]> = {
  'B2B SaaS / Tech': [
    'Homepage', 'Product', 'Features', 'Pricing', 'Platform', 'Solutions', 'Integrations',
    'Demo', 'About', 'Contact', 'Blog List', 'Blog Detail', 'Case Study List', 'Case Study Detail',
    'Resource List', 'Resource Detail', 'Docs List', 'Docs Detail', 'Career List', 'Career Detail',
    'Partners', 'Security', 'API', 'Changelog', 'Status', 'How It Works', 'Why Us',
    'Privacy Policy', 'Terms', 'Cookie Policy',
  ],
  'Agency / Professional Services': [
    'Homepage', 'Services', 'Service Detail', 'About', 'Team List', 'Team Detail',
    'Portfolio List', 'Portfolio Detail', 'Case Study List', 'Case Study Detail',
    'Blog List', 'Blog Detail', 'Contact', 'Pricing', 'Process', 'Industries',
    'Industry Detail', 'Careers', 'FAQ', 'Privacy Policy', 'Terms',
  ],
  'eCommerce / Retail': [
    'Homepage', 'Product List', 'Product Detail', 'Category', 'Cart', 'Checkout',
    'About', 'Contact', 'Blog List', 'Blog Detail', 'FAQ', 'Shipping', 'Returns',
    'Size Guide', 'Gift Cards', 'Loyalty Program', 'Store Locator',
    'Privacy Policy', 'Terms', 'Cookie Policy',
  ],
  'Nonprofit / NGO': [
    'Homepage', 'Mission', 'Programs', 'Program Detail', 'Impact', 'Stories',
    'Story Detail', 'Donate', 'Get Involved', 'Volunteer', 'Events', 'Event Detail',
    'News List', 'News Detail', 'About', 'Team List', 'Team Detail', 'Partners',
    'Annual Report', 'Contact', 'Privacy Policy', 'Terms',
  ],
  'Healthcare / Medical': [
    'Homepage', 'Services', 'Service Detail', 'Providers', 'Provider Detail',
    'Locations', 'Location Detail', 'Patient Portal', 'Appointments', 'Insurance',
    'Blog List', 'Blog Detail', 'FAQ', 'About', 'Contact', 'Careers',
    'Privacy Policy', 'Terms', 'HIPAA Notice',
  ],
  'Education / University': [
    'Homepage', 'Programs', 'Program Detail', 'Admissions', 'Tuition', 'Campus Life',
    'Faculty', 'Faculty Detail', 'Research', 'News List', 'News Detail', 'Events',
    'Event Detail', 'About', 'Contact', 'Apply', 'Alumni', 'Library',
    'Privacy Policy', 'Terms',
  ],
  'Media / Publishing': [
    'Homepage', 'Article List', 'Article Detail', 'Category', 'Author',
    'Video List', 'Video Detail', 'Podcast List', 'Podcast Detail',
    'Newsletter', 'Subscribe', 'About', 'Contact', 'Advertise',
    'Privacy Policy', 'Terms',
  ],
  'Real Estate': [
    'Homepage', 'Listings', 'Listing Detail', 'Neighborhoods', 'Neighborhood Detail',
    'Agents', 'Agent Detail', 'Sold', 'Blog List', 'Blog Detail',
    'About', 'Contact', 'Valuation', 'Mortgage Calculator',
    'Privacy Policy', 'Terms',
  ],
  'Restaurant / Hospitality': [
    'Homepage', 'Menu', 'Reservations', 'Locations', 'Location Detail',
    'Catering', 'Events', 'About', 'Contact', 'Gallery', 'Gift Cards',
    'Blog List', 'Blog Detail', 'Careers', 'Privacy Policy', 'Terms',
  ],
  'Generic / Other': [
    'Homepage', 'About', 'Services', 'Contact', 'Blog List', 'Blog Detail',
    'FAQ', 'Pricing', 'Team', 'Careers', 'Privacy Policy', 'Terms',
  ],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, homepageContent, navStructure, domain } = await req.json();

    if (!urls?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'URLs are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!aiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate
    const normalizedMap = new Map<string, string>();
    for (const u of urls) {
      const norm = normalizeUrl(u);
      if (!normalizedMap.has(norm)) normalizedMap.set(norm, u);
    }
    const dedupedUrls = Array.from(normalizedMap.values());

    const industryList = Object.keys(INDUSTRY_PRESETS);

    const navSummary = navStructure
      ? `Navigation structure:\n${JSON.stringify(navStructure, null, 1).substring(0, 3000)}`
      : '';

    const systemPrompt = `You are an expert at classifying websites by industry and assigning page template types.

Your job:
1. Detect the website's INDUSTRY from the homepage content, navigation, domain, and URL patterns.
2. Assign each URL a single "template" label that best describes its page type.

Industry options (pick the closest match):
${industryList.map(i => `- ${i}`).join('\n')}

Template assignment rules:
- Use the industry-appropriate template names. For the detected industry, here are typical templates:
${industryList.map(i => `  ${i}: ${INDUSTRY_PRESETS[i].join(', ')}`).join('\n')}
- You may use ANY template name that fits — you're not limited to the preset list.
- Be specific: "Service Detail" not just "Services" for individual service pages.
- Use "List" suffix for index/archive pages, "Detail" for individual items.
- Assign "Uncategorized" only if truly ambiguous.
- Common utility pages: Privacy Policy, Terms, Cookie Policy, Sitemap, 404, Login, Search.

You MUST classify EVERY URL provided. Return the exact URL strings as given.`;

    const urlsForAI = dedupedUrls.slice(0, 300);

    console.log(`[auto-tag] Classifying ${urlsForAI.length} URLs for domain: ${domain}`);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Domain: ${domain || 'unknown'}

Homepage content (first 4000 chars):
${(homepageContent || '').substring(0, 4000)}

${navSummary}

URLs to classify (assign a template to each):
${urlsForAI.join('\n')}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'classify_pages',
              description: 'Detect the industry and assign a template label to each URL.',
              parameters: {
                type: 'object',
                properties: {
                  industry: {
                    type: 'string',
                    description: 'The detected industry/vertical for this website',
                  },
                  industry_confidence: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                    description: 'Confidence in the industry detection',
                  },
                  pages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', description: 'Exact URL from the input list' },
                        template: { type: 'string', description: 'Template name for this page' },
                      },
                      required: ['url', 'template'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['industry', 'industry_confidence', 'pages'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'classify_pages' } },
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
        JSON.stringify({ success: false, error: 'AI classification failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let result = { industry: 'Generic / Other', industry_confidence: 'low', pages: [] as any[] };

    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    }

    // Fuzzy-match URLs back to originals
    const inputNormMap = new Map<string, string>();
    for (const u of urls) {
      inputNormMap.set(normalizeUrl(u), u);
    }

    const matchedPages: { url: string; template: string }[] = [];
    for (const page of (result.pages || [])) {
      // Exact match first
      if (urls.includes(page.url)) {
        matchedPages.push(page);
        continue;
      }
      // Normalized match
      const original = inputNormMap.get(normalizeUrl(page.url));
      if (original) {
        matchedPages.push({ url: original, template: page.template });
      }
    }

    console.log(`[auto-tag] Industry: ${result.industry} (${result.industry_confidence}), tagged ${matchedPages.length}/${urls.length} URLs`);

    return new Response(
      JSON.stringify({
        success: true,
        industry: result.industry,
        industryConfidence: result.industry_confidence,
        pages: matchedPages,
        presetTemplates: INDUSTRY_PRESETS[result.industry] || INDUSTRY_PRESETS['Generic / Other'],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-tag-pages:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to classify pages' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
