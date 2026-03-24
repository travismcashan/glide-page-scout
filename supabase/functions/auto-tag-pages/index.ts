const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const BATCH_SIZE = 100;

function normalizeUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return (parsed.origin + parsed.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return u.replace(/\/+$/, '').toLowerCase();
  }
}

// Industry-specific template presets
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

const industryList = Object.keys(INDUSTRY_PRESETS);

function buildSystemPrompt(knownIndustry?: string): string {
  const industryInstruction = knownIndustry
    ? `The website's industry has already been detected as "${knownIndustry}". Use this industry for template assignment.`
    : `Detect the website's INDUSTRY from these options:\n${industryList.map(i => `- ${i}`).join('\n')}`;

  return `You are an expert at classifying websites by industry and assigning page template types using a WordPress-inspired content model.

Your job:
1. ${knownIndustry ? `Use the pre-detected industry: "${knownIndustry}".` : 'Detect the website\'s INDUSTRY.'}
2. Classify each URL with a baseType (Page, Post, CPT, Archive, Search) and a template name.

baseType definitions:
- **Page**: One-off pages with unique designs (Homepage, About, Pricing, Contact, etc.)
- **Post**: Blog/news articles in a date-based feed
- **CPT**: Custom Post Type detail pages — repeating template with 3+ similar URLs (case studies, team members, products)
- **Archive**: List/index/category pages that aggregate other pages
- **Search**: Site search results pages

${industryInstruction}

Template assignment rules:
- Use the industry-appropriate template names. Templates per industry:
${industryList.map(i => `  ${i}: ${INDUSTRY_PRESETS[i].join(', ')}`).join('\n')}
- You may use ANY template name that fits.
- Use "List" suffix for archive/index pages (these are Archive type), "Detail" for individual items.
- Utility pages (Privacy Policy, Terms, Login, 404): type Page.
- Blog posts: type Post with template "Blog Detail".
- CPT entries: type CPT with template "[Name] Detail" and provide cptName.
- List/index pages: type Archive with template "Archive: [Name]" or "[Name] List".

You MUST classify EVERY URL provided.`;
}

async function classifyBatch(
  aiKey: string,
  urlBatch: string[],
  domain: string,
  homepageContent: string,
  navSummary: string,
  knownIndustry?: string,
): Promise<{ industry: string; industry_confidence: string; pages: any[] }> {
  const systemPrompt = buildSystemPrompt(knownIndustry);

  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Domain: ${domain || 'unknown'}

Homepage content (first 3000 chars):
${(homepageContent || '').substring(0, 3000)}

${navSummary}

URLs to classify (${urlBatch.length} URLs):
${urlBatch.join('\n')}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'classify_pages',
            description: 'Detect the industry and assign a baseType + template to each URL.',
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
                },
                pages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      url: { type: 'string', description: 'Exact URL from input' },
                      baseType: { type: 'string', enum: ['Page', 'Post', 'CPT', 'Archive', 'Search'] },
                      template: { type: 'string', description: 'Template name for this page' },
                      cptName: { type: 'string', description: 'CPT name if baseType is CPT' },
                    },
                    required: ['url', 'baseType', 'template'],
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
    console.error(`[auto-tag] AI error for batch: ${response.status}`, errText.slice(0, 300));
    if (response.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`AI returned ${response.status}`);
  }

  const aiText = await response.text();
  let aiData: any;
  try {
    aiData = JSON.parse(aiText);
  } catch {
    console.error('[auto-tag] Truncated AI response, length:', aiText.length, 'tail:', aiText.slice(-200));
    // Attempt to salvage truncated tool_call arguments
    const argMatch = aiText.match(/"arguments"\s*:\s*"([\s\S]+)/);
    if (argMatch) {
      console.log('[auto-tag] Attempting to salvage truncated response...');
    }
    return { industry: knownIndustry || 'Generic / Other', industry_confidence: 'low', pages: [] };
  }

  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    return { industry: knownIndustry || 'Generic / Other', industry_confidence: 'low', pages: [] };
  }

  try {
    return JSON.parse(toolCall.function.arguments);
  } catch {
    // Try to fix truncated JSON in arguments
    let args = toolCall.function.arguments;
    // Remove trailing incomplete object
    const lastComplete = args.lastIndexOf('}');
    if (lastComplete > 0) {
      args = args.substring(0, lastComplete + 1);
      // Close the array and outer object if needed
      const openBrackets = (args.match(/\[/g) || []).length - (args.match(/\]/g) || []).length;
      const openBraces = (args.match(/\{/g) || []).length - (args.match(/\}/g) || []).length;
      for (let i = 0; i < openBrackets; i++) args += ']';
      for (let i = 0; i < openBraces; i++) args += '}';
      try {
        const repaired = JSON.parse(args);
        console.log(`[auto-tag] Repaired truncated args, got ${repaired.pages?.length || 0} pages`);
        return repaired;
      } catch {
        console.error('[auto-tag] Could not repair truncated arguments');
      }
    }
    return { industry: knownIndustry || 'Generic / Other', industry_confidence: 'low', pages: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, homepageContent, navStructure, domain, knownIndustry } = await req.json();

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

    const navSummary = navStructure
      ? `Navigation structure:\n${JSON.stringify(navStructure, null, 1).substring(0, 2000)}`
      : '';

    // Single AI call — client handles batching across invocations
    console.log(`[auto-tag] Classifying ${dedupedUrls.length} URLs for domain: ${domain}`);

    const result = await classifyBatch(aiKey, dedupedUrls, domain, homepageContent || '', navSummary, knownIndustry || undefined);
    const industry = result.industry || 'Generic / Other';
    const industryConfidence = result.industry_confidence || 'low';
    const allPages: any[] = [...(result.pages || [])];

    console.log(`[auto-tag] Industry: "${industry}" (${industryConfidence}), ${allPages.length} pages classified`);

    // Fuzzy-match URLs back to originals
    const inputNormMap = new Map<string, string>();
    for (const u of urls) {
      inputNormMap.set(normalizeUrl(u), u);
    }

    const matchedPages: { url: string; baseType: string; template: string; cptName?: string }[] = [];
    const seen = new Set<string>();
    for (const page of allPages) {
      const url = urls.includes(page.url) ? page.url : inputNormMap.get(normalizeUrl(page.url));
      if (url && !seen.has(url)) {
        seen.add(url);
        matchedPages.push({
          url,
          baseType: page.baseType || 'Page',
          template: page.template,
          cptName: page.cptName,
        });
      }
    }

    console.log(`[auto-tag] Industry: ${industry} (${industryConfidence}), tagged ${matchedPages.length}/${urls.length} URLs across ${batches.length} batch(es)`);

    return new Response(
      JSON.stringify({
        success: true,
        industry,
        industryConfidence: industryConfidence,
        pages: matchedPages,
        presetTemplates: INDUSTRY_PRESETS[industry] || INDUSTRY_PRESETS['Generic / Other'],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-tag-pages:', error);
    const msg = error instanceof Error ? error.message : 'Failed to classify pages';
    const status = msg === 'RATE_LIMIT' ? 429 : 500;
    return new Response(
      JSON.stringify({ success: false, error: msg === 'RATE_LIMIT' ? 'Rate limit exceeded, please try again shortly.' : msg }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
