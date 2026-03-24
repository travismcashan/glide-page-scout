const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Content Type Classification
 * 
 * Phase 1: URL-pattern based classification (all URLs)
 * Phase 2: AI classification for ambiguous URLs (scrapes a sample)
 */

type ContentType = {
  type: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'url-pattern' | 'schema-org' | 'meta-tags' | 'css-classes' | 'ai';
};

type ClassifiedUrl = {
  url: string;
  contentType: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
};

// URL path patterns → content types
const urlPatterns: [RegExp, string][] = [
  [/\/blog(s)?\//i, 'Blog Post'],
  [/\/article(s)?\//i, 'Article'],
  [/\/news\//i, 'News / Press'],
  [/\/press(-|\/)release/i, 'Press Release'],
  [/\/press\//i, 'News / Press'],
  [/\/media\//i, 'News / Press'],
  [/\/case(-|_)?stud(y|ies)\//i, 'Case Study'],
  [/\/customer(-|_)?stor(y|ies)\//i, 'Case Study'],
  [/\/success(-|_)?stor(y|ies)\//i, 'Case Study'],
  [/\/webinar(s)?\//i, 'Webinar'],
  [/\/event(s)?\//i, 'Event'],
  [/\/podcast(s)?\//i, 'Podcast'],
  [/\/episode(s)?\//i, 'Podcast'],
  [/\/white(-|_)?paper(s)?\//i, 'White Paper'],
  [/\/ebook(s)?\//i, 'eBook'],
  [/\/e-book(s)?\//i, 'eBook'],
  [/\/guide(s)?\//i, 'Guide'],
  [/\/how(-|_)?to\//i, 'Guide'],
  [/\/tutorial(s)?\//i, 'Tutorial'],
  [/\/resource(s)?\//i, 'Resource'],
  [/\/download(s)?\//i, 'Resource'],
  [/\/product(s)?\//i, 'Product'],
  [/\/shop\//i, 'Product'],
  [/\/store\//i, 'Product'],
  [/\/collection(s)?\//i, 'Product Collection'],
  [/\/categor(y|ies)\//i, 'Category'],
  [/\/solution(s)?\//i, 'Solution'],
  [/\/service(s)?\//i, 'Service'],
  [/\/feature(s)?\//i, 'Feature'],
  [/\/platform\//i, 'Platform'],
  [/\/pricing/i, 'Pricing'],
  [/\/plan(s)?$/i, 'Pricing'],
  [/\/about(-us)?$/i, 'About'],
  [/\/team$/i, 'About'],
  [/\/career(s)?/i, 'Careers'],
  [/\/job(s)?\//i, 'Careers'],
  [/\/contact(-us)?$/i, 'Contact'],
  [/\/faq(s)?$/i, 'FAQ'],
  [/\/help\//i, 'Help / Support'],
  [/\/support\//i, 'Help / Support'],
  [/\/knowledge(-|_)?base\//i, 'Knowledge Base'],
  [/\/doc(s|umentation)?\//i, 'Documentation'],
  [/\/api\//i, 'Documentation'],
  [/\/legal\//i, 'Legal'],
  [/\/privacy/i, 'Legal'],
  [/\/terms/i, 'Legal'],
  [/\/cookie/i, 'Legal'],
  [/\/partner(s)?\//i, 'Partner'],
  [/\/integration(s)?\//i, 'Integration'],
  [/\/testimonial(s)?\//i, 'Testimonial'],
  [/\/review(s)?\//i, 'Review'],
  [/\/video(s)?\//i, 'Video'],
  [/\/gallery\//i, 'Gallery'],
  [/\/portfolio\//i, 'Portfolio'],
  [/\/landing\//i, 'Landing Page'],
  [/\/lp\//i, 'Landing Page'],
  [/\/demo$/i, 'Landing Page'],
  [/\/report(s)?\//i, 'Report'],
  [/\/research\//i, 'Research'],
  [/\/infographic(s)?\//i, 'Infographic'],
  [/\/comparison\//i, 'Comparison'],
  [/\/vs\//i, 'Comparison'],
  [/\/alternative(s)?\//i, 'Comparison'],
  [/\/changelog/i, 'Changelog'],
  [/\/release(-|_)?note(s)?\//i, 'Changelog'],
  [/\/communit(y|ies)\//i, 'Community'],
  [/\/forum(s)?\//i, 'Community'],
];

function classifyByUrl(url: string): ContentType | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Homepage
    if (path === '/' || path === '') {
      return { type: 'Homepage', confidence: 'high', source: 'url-pattern' };
    }

    for (const [pattern, type] of urlPatterns) {
      if (pattern.test(path)) {
        return { type, confidence: 'high', source: 'url-pattern' };
      }
    }

    // Check depth — single-segment paths are likely top-level pages
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 1) {
      return { type: 'Page', confidence: 'low', source: 'url-pattern' };
    }

    return null;
  } catch {
    return null;
  }
}

// Extract content type signals from HTML
function classifyByHtml(html: string): ContentType | null {
  // 1. Schema.org JSON-LD
  const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      const content = match.replace(/<\/?script[^>]*>/gi, '');
      try {
        const data = JSON.parse(content);
        const schemaType = data['@type'] || (Array.isArray(data['@graph']) ? data['@graph'][0]?.['@type'] : null);
        if (schemaType) {
          const typeMap: Record<string, string> = {
            'BlogPosting': 'Blog Post',
            'NewsArticle': 'News / Press',
            'Article': 'Article',
            'Product': 'Product',
            'Event': 'Event',
            'FAQPage': 'FAQ',
            'HowTo': 'Guide',
            'Recipe': 'Recipe',
            'Course': 'Course',
            'VideoObject': 'Video',
            'PodcastEpisode': 'Podcast',
            'WebPage': 'Page',
            'AboutPage': 'About',
            'ContactPage': 'Contact',
            'CollectionPage': 'Category',
            'ItemList': 'Category',
            'SoftwareApplication': 'Product',
            'Service': 'Service',
            'Review': 'Review',
            'Organization': 'About',
          };
          const mapped = typeMap[schemaType];
          if (mapped && mapped !== 'Page') {
            return { type: mapped, confidence: 'high', source: 'schema-org' };
          }
        }
      } catch { /* skip invalid JSON-LD */ }
    }
  }

  // 2. Meta tags / Open Graph
  const ogTypeMatch = html.match(/<meta[^>]*property="og:type"[^>]*content="([^"]*)"[^>]*>/i);
  if (ogTypeMatch) {
    const ogType = ogTypeMatch[1].toLowerCase();
    const ogMap: Record<string, string> = {
      'article': 'Article',
      'blog': 'Blog Post',
      'product': 'Product',
      'video': 'Video',
      'music': 'Media',
      'profile': 'Profile',
    };
    if (ogMap[ogType]) {
      return { type: ogMap[ogType], confidence: 'medium', source: 'meta-tags' };
    }
  }

  // Article section meta
  const sectionMatch = html.match(/<meta[^>]*property="article:section"[^>]*content="([^"]*)"[^>]*>/i);
  if (sectionMatch) {
    return { type: `Article (${sectionMatch[1]})`, confidence: 'medium', source: 'meta-tags' };
  }

  // 3. Body/CSS class patterns
  const bodyMatch = html.match(/<body[^>]*class="([^"]*)"[^>]*>/i);
  if (bodyMatch) {
    const classes = bodyMatch[1].toLowerCase();
    const classPatterns: [RegExp, string][] = [
      [/single-post|blog-post|post-template/, 'Blog Post'],
      [/single-product|product-template/, 'Product'],
      [/page-template-landing/, 'Landing Page'],
      [/page-template-contact/, 'Contact'],
      [/page-template-about/, 'About'],
      [/archive|category|tag-/, 'Category'],
      [/single-case.?study/, 'Case Study'],
      [/single-event/, 'Event'],
      [/single-resource/, 'Resource'],
      [/single-webinar/, 'Webinar'],
      [/single-podcast/, 'Podcast'],
      [/post-type-archive/, 'Archive'],
    ];
    for (const [pattern, type] of classPatterns) {
      if (pattern.test(classes)) {
        return { type, confidence: 'medium', source: 'css-classes' };
      }
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, baseUrl, sampleSize = 20 } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'URLs array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Phase 1: URL pattern classification
    const classified: ClassifiedUrl[] = [];
    const ambiguous: string[] = [];

    for (const url of urls) {
      const result = classifyByUrl(url);
      if (result && result.confidence !== 'low') {
        classified.push({ url, contentType: result.type, confidence: result.confidence, source: result.source });
      } else {
        // Mark as ambiguous for Phase 2
        ambiguous.push(url);
        if (result) {
          classified.push({ url, contentType: result.type, confidence: result.confidence, source: result.source });
        } else {
          classified.push({ url, contentType: 'Uncategorized', confidence: 'low', source: 'url-pattern' });
        }
      }
    }

    // Phase 2: Scrape a sample of ambiguous URLs and classify by HTML
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (apiKey && ambiguous.length > 0) {
      const sample = ambiguous.slice(0, Math.min(sampleSize, ambiguous.length));
      
      const scrapePromises = sample.map(async (url) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          
          const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url,
              formats: ['rawHtml'],
              onlyMainContent: false,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeout);
          
          if (!response.ok) return null;
          const data = await response.json();
          const html = data?.data?.rawHtml || data?.rawHtml || '';
          if (!html) return null;

          const htmlResult = classifyByHtml(html);
          if (htmlResult) {
            return { url, ...htmlResult };
          }
          return null;
        } catch {
          return null;
        }
      });

      const htmlResults = await Promise.allSettled(scrapePromises);
      
      for (const result of htmlResults) {
        if (result.status === 'fulfilled' && result.value) {
          const { url, type, confidence, source } = result.value;
          // Update the classified entry
          const idx = classified.findIndex(c => c.url === url);
          if (idx !== -1) {
            classified[idx] = { url, contentType: type, confidence, source };
          }
        }
      }
    }

    // Phase 3: AI classification for remaining uncategorized (if many)
    const stillUncategorized = classified.filter(c => c.contentType === 'Uncategorized' || c.confidence === 'low');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY && stillUncategorized.length > 0 && stillUncategorized.length <= 200) {
      try {
        const urlList = stillUncategorized.map(c => c.url).join('\n');
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            tools: [{
              type: 'function',
              function: {
                name: 'classify_urls',
                description: 'Classify URLs by content type based on their path structure and naming conventions',
                parameters: {
                  type: 'object',
                  properties: {
                    classifications: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          url: { type: 'string' },
                          contentType: { type: 'string', description: 'Content type like Blog Post, Product, Case Study, Landing Page, About, Legal, Resource, etc.' },
                        },
                        required: ['url', 'contentType'],
                      },
                    },
                  },
                  required: ['classifications'],
                },
              },
            }],
            tool_choice: { type: 'function', function: { name: 'classify_urls' } },
            messages: [
              {
                role: 'system',
                content: `You are a web content strategist. Classify each URL into a content type. Common types: Blog Post, Article, Case Study, Product, Service, Landing Page, About, Contact, FAQ, Legal, Careers, News / Press, Resource, Guide, Documentation, Help / Support, Event, Webinar, Podcast, Video, Partner, Integration, Comparison, Pricing, Page. Base URL: ${baseUrl}`,
              },
              {
                role: 'user',
                content: `Classify these URLs by content type:\n${urlList}`,
              },
            ],
          }),
        });

        if (response.ok) {
          const aiData = await response.json();
          const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (parsed?.classifications) {
              for (const c of parsed.classifications) {
                const idx = classified.findIndex(x => x.url === c.url);
                if (idx !== -1 && (classified[idx].contentType === 'Uncategorized' || classified[idx].confidence === 'low')) {
                  classified[idx] = { url: c.url, contentType: c.contentType, confidence: 'medium', source: 'ai' };
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('AI classification failed:', e);
        // Non-fatal — keep existing classifications
      }
    }

    // Build summary
    const typeCounts: Record<string, { count: number; urls: string[]; confidence: Record<string, number> }> = {};
    for (const c of classified) {
      if (!typeCounts[c.contentType]) {
        typeCounts[c.contentType] = { count: 0, urls: [], confidence: { high: 0, medium: 0, low: 0 } };
      }
      typeCounts[c.contentType].count++;
      typeCounts[c.contentType].urls.push(c.url);
      typeCounts[c.contentType].confidence[c.confidence]++;
    }

    // Sort by count descending
    const summary = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([type, data]) => ({
        type,
        count: data.count,
        urls: data.urls.slice(0, 5), // top 5 examples
        totalUrls: data.urls.length,
        confidence: data.confidence,
      }));

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        classified,
        stats: {
          total: urls.length,
          bySource: {
            'url-pattern': classified.filter(c => c.source === 'url-pattern').length,
            'schema-org': classified.filter(c => c.source === 'schema-org').length,
            'meta-tags': classified.filter(c => c.source === 'meta-tags').length,
            'css-classes': classified.filter(c => c.source === 'css-classes').length,
            'ai': classified.filter(c => c.source === 'ai').length,
          },
          uniqueTypes: summary.length,
          ambiguousScanned: Math.min(ambiguous.length, sampleSize),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Content types error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to classify content types' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
