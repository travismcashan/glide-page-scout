const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Content Type Classification — v2
 *
 * Focuses on identifying REPEATING content types (custom post types / templates
 * with multiple entries) rather than labelling every individual page.
 *
 * Phase 1: URL-pattern grouping to find repeating directory structures
 * Phase 2: HTML signal extraction on a sample (Schema.org, body classes, OG)
 * Phase 3: AI analysis using the best model to identify true content types
 * Phase 4: Post-processing — demote types with < minCount URLs
 */

type ClassifiedUrl = {
  url: string;
  contentType: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
};

// ---------------------------------------------------------------------------
// Phase 1 helpers — group URLs by their directory prefix
// ---------------------------------------------------------------------------

/** Known single-page slugs that should never form a content type */
const SINGLE_PAGE_SLUGS = new Set([
  'about', 'about-us', 'contact', 'contact-us', 'careers', 'jobs',
  'pricing', 'plans', 'faq', 'faqs', 'privacy', 'privacy-policy',
  'terms', 'terms-of-service', 'terms-and-conditions', 'cookie-policy',
  'legal', 'disclaimer', 'sitemap', 'login', 'signin', 'sign-in',
  'signup', 'sign-up', 'register', 'forgot-password', 'reset-password',
  'dashboard', 'account', 'settings', 'profile', 'cart', 'checkout',
  '404', 'search', 'thank-you', 'thanks', 'confirmation', 'unsubscribe',
  'demo', 'request-demo', 'get-started', 'getting-started', 'home',
  'team', 'our-team', 'leadership', 'mission', 'values', 'culture',
  'press', 'newsroom', 'media', 'investors', 'accessibility',
]);

/**
 * Group URLs by their first path segment (directory).
 * Returns groups of 2+ URLs sharing the same directory.
 */
function groupByDirectory(urls: string[], baseUrl: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  let baseHost = '';
  try { baseHost = new URL(baseUrl).hostname; } catch { /* ignore */ }

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      // Skip off-domain
      if (baseHost && parsed.hostname !== baseHost) continue;

      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length === 0) continue; // homepage
      if (segments.length === 1) {
        // Top-level page — skip known singles
        if (SINGLE_PAGE_SLUGS.has(segments[0].toLowerCase())) continue;
        // Could still be a type index page, skip for now
        continue;
      }
      // Use first segment as group key
      const dir = segments[0].toLowerCase();
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir)!.push(url);
    } catch { /* skip bad URLs */ }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Phase 2 — HTML signal extraction
// ---------------------------------------------------------------------------

function classifyByHtml(html: string): { type: string; confidence: 'high' | 'medium'; source: string } | null {
  // Schema.org JSON-LD
  const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      const content = match.replace(/<\/?script[^>]*>/gi, '');
      try {
        const data = JSON.parse(content);
        const schemaType = data['@type'] || (Array.isArray(data['@graph']) ? data['@graph'][0]?.['@type'] : null);
        if (schemaType) {
          const typeMap: Record<string, string> = {
            'BlogPosting': 'Blog Post', 'NewsArticle': 'News Article', 'Article': 'Article',
            'Product': 'Product', 'Event': 'Event', 'HowTo': 'Guide', 'Recipe': 'Recipe',
            'Course': 'Course', 'VideoObject': 'Video', 'PodcastEpisode': 'Podcast Episode',
            'SoftwareApplication': 'Product', 'Service': 'Service', 'Review': 'Review',
            'CollectionPage': 'Collection', 'ItemList': 'Collection',
          };
          // Skip generic page types — they don't help
          if (['WebPage', 'AboutPage', 'ContactPage', 'FAQPage', 'Organization'].includes(schemaType)) continue;
          const mapped = typeMap[schemaType];
          if (mapped) return { type: mapped, confidence: 'high', source: 'schema-org' };
        }
      } catch { /* skip */ }
    }
  }

  // WordPress body classes — look for CPT patterns
  const bodyMatch = html.match(/<body[^>]*class="([^"]*)"[^>]*>/i);
  if (bodyMatch) {
    const classes = bodyMatch[1].toLowerCase();
    // Look for single-{cpt} patterns which indicate a custom post type
    const cptMatch = classes.match(/\bsingle-([a-z][a-z0-9_-]+)\b/);
    if (cptMatch && !['post', 'page', 'attachment'].includes(cptMatch[1])) {
      // Format CPT name nicely
      const name = cptMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { type: name, confidence: 'high', source: 'css-classes' };
    }
    // Archive patterns
    const archiveMatch = classes.match(/\bpost-type-archive-([a-z][a-z0-9_-]+)\b/);
    if (archiveMatch && !['post', 'page'].includes(archiveMatch[1])) {
      const name = archiveMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { type: name, confidence: 'high', source: 'css-classes' };
    }
    // Blog posts
    if (/\bsingle-post\b/.test(classes)) return { type: 'Blog Post', confidence: 'high', source: 'css-classes' };
  }

  // OG type
  const ogMatch = html.match(/<meta[^>]*property="og:type"[^>]*content="([^"]*)"[^>]*>/i);
  if (ogMatch) {
    const ogType = ogMatch[1].toLowerCase();
    if (ogType === 'article') return { type: 'Article', confidence: 'medium', source: 'meta-tags' };
    if (ogType === 'product') return { type: 'Product', confidence: 'medium', source: 'meta-tags' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, baseUrl, sampleSize = 30, minCount = 3 } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'URLs array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const classified: ClassifiedUrl[] = [];
    const htmlSignals = new Map<string, { type: string; confidence: 'high' | 'medium'; source: string }>();

    // Phase 1: Group by directory to find repeating patterns
    const dirGroups = groupByDirectory(urls, baseUrl);

    // Phase 2: Scrape a sample for HTML signals
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (apiKey) {
      // Pick a sample across different directories
      const samplesToScrape: string[] = [];
      for (const [, groupUrls] of dirGroups) {
        if (groupUrls.length >= 2) {
          // Take up to 2 from each directory group
          samplesToScrape.push(...groupUrls.slice(0, 2));
        }
      }
      const finalSample = samplesToScrape.slice(0, sampleSize);

      if (finalSample.length > 0) {
        const scrapePromises = finalSample.map(async (url) => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, formats: ['rawHtml'], onlyMainContent: false }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!response.ok) return null;
            const data = await response.json();
            const html = data?.data?.rawHtml || data?.rawHtml || '';
            if (!html) return null;
            const result = classifyByHtml(html);
            if (result) return { url, ...result };
            return null;
          } catch { return null; }
        });

        const results = await Promise.allSettled(scrapePromises);
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            htmlSignals.set(r.value.url, { type: r.value.type, confidence: r.value.confidence, source: r.value.source });
          }
        }
      }
    }

    // Phase 3: AI classification — send ALL URLs + directory groups + HTML signals to the best model
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiClassifications = new Map<string, string>();

    if (LOVABLE_API_KEY) {
      try {
        // Build context for AI
        const dirSummary = Array.from(dirGroups.entries())
          .filter(([, v]) => v.length >= 2)
          .map(([dir, v]) => `/${dir}/ (${v.length} URLs) — samples: ${v.slice(0, 3).join(', ')}`)
          .join('\n');

        const htmlContext = Array.from(htmlSignals.entries())
          .map(([url, sig]) => `${url} → ${sig.type} (via ${sig.source})`)
          .join('\n');

        // Identify homepage and top-level single pages
        const topLevelPages: string[] = [];
        let homepage = '';
        for (const url of urls) {
          try {
            const parsed = new URL(url);
            const segs = parsed.pathname.split('/').filter(Boolean);
            if (segs.length === 0) { homepage = url; continue; }
            if (segs.length === 1) topLevelPages.push(url);
          } catch { /* skip */ }
        }

        const allUrlsList = urls.join('\n');

        const systemPrompt = `You are a web content strategist analyzing a website to identify its CONTENT TYPES (also known as Custom Post Types or repeating page templates).

CRITICAL RULES:
1. A "content type" is a REPEATING template used for multiple similar pages. Examples: Blog Posts, Case Studies, Products, Team Members, Resources, Locations.
2. Individual pages are NOT content types. Pages like Homepage, About, Pricing, Contact, Careers, Privacy Policy, Terms — these are individual pages, not content types. Do NOT classify them.
3. A valid content type MUST have at least ${minCount} pages using that template.
4. Focus on the URL STRUCTURE: pages sharing a common directory prefix (e.g., /blog/*, /case-studies/*, /products/*) are likely the same content type.
5. Name content types using their singular form where appropriate (e.g., "Blog Post" not "Blog Posts", "Case Study" not "Case Studies").
6. If a URL group is clearly just a section with sub-pages (like /solutions/enterprise, /solutions/smb), that's a section with individual pages, NOT a content type — unless there are many similar detail pages.
7. Return ONLY URLs that belong to a genuine repeating content type. Skip everything else.`;

        const userPrompt = `Analyze this website (${baseUrl}) and identify the repeating content types.

ALL URLs on the site:
${allUrlsList}

Directory groups with 2+ URLs:
${dirSummary || '(none detected)'}

HTML signals detected:
${htmlContext || '(none detected)'}

Homepage: ${homepage || 'not found'}
Top-level pages: ${topLevelPages.join(', ') || 'none'}

Identify ONLY genuine repeating content types. For each URL that belongs to a content type, classify it. Skip individual/one-off pages entirely.`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            tools: [{
              type: 'function',
              function: {
                name: 'classify_content_types',
                description: 'Classify URLs that belong to repeating content types. Only include URLs that are part of a genuine content type with multiple entries.',
                parameters: {
                  type: 'object',
                  properties: {
                    contentTypes: {
                      type: 'array',
                      description: 'List of identified content types with their URLs',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string', description: 'Content type name (singular form, e.g., "Blog Post", "Case Study")' },
                          urls: { type: 'array', items: { type: 'string' }, description: 'URLs belonging to this content type' },
                          confidence: { type: 'string', enum: ['high', 'medium'], description: 'Classification confidence' },
                        },
                        required: ['name', 'urls', 'confidence'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['contentTypes'],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: 'function', function: { name: 'classify_content_types' } },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        });

        if (response.ok) {
          const aiData = await response.json();
          const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (parsed?.contentTypes) {
              for (const ct of parsed.contentTypes) {
                // Enforce minimum count
                if (ct.urls && ct.urls.length >= minCount) {
                  for (const url of ct.urls) {
                    aiClassifications.set(url, ct.name);
                  }
                }
              }
            }
          }
        } else {
          console.error('AI classification failed:', response.status, await response.text());
        }
      } catch (e) {
        console.error('AI classification error:', e);
      }
    }

    // Phase 4: Build final classifications
    // Priority: HTML signals > AI > skip (uncategorized)
    const classifiedUrls = new Set<string>();

    for (const url of urls) {
      const htmlSig = htmlSignals.get(url);
      const aiType = aiClassifications.get(url);

      if (htmlSig) {
        classified.push({ url, contentType: htmlSig.type, confidence: htmlSig.confidence, source: htmlSig.source });
        classifiedUrls.add(url);
      } else if (aiType) {
        classified.push({ url, contentType: aiType, confidence: 'medium', source: 'ai' });
        classifiedUrls.add(url);
      } else {
        classified.push({ url, contentType: 'Uncategorized', confidence: 'low', source: 'url-pattern' });
      }
    }

    // Post-processing: enforce minimum count threshold
    const typeCounts: Record<string, { count: number; urls: string[]; confidence: Record<string, number> }> = {};
    for (const c of classified) {
      if (!typeCounts[c.contentType]) {
        typeCounts[c.contentType] = { count: 0, urls: [], confidence: { high: 0, medium: 0, low: 0 } };
      }
      typeCounts[c.contentType].count++;
      typeCounts[c.contentType].urls.push(c.url);
      typeCounts[c.contentType].confidence[c.confidence]++;
    }

    // Demote types below threshold (except Uncategorized)
    for (const [type, data] of Object.entries(typeCounts)) {
      if (type !== 'Uncategorized' && data.count < minCount) {
        // Move these URLs to Uncategorized
        for (const c of classified) {
          if (c.contentType === type) {
            c.contentType = 'Uncategorized';
            c.confidence = 'low';
          }
        }
      }
    }

    // Rebuild summary after demotions
    const finalCounts: Record<string, { count: number; urls: string[]; confidence: Record<string, number> }> = {};
    for (const c of classified) {
      if (!finalCounts[c.contentType]) {
        finalCounts[c.contentType] = { count: 0, urls: [], confidence: { high: 0, medium: 0, low: 0 } };
      }
      finalCounts[c.contentType].count++;
      finalCounts[c.contentType].urls.push(c.url);
      finalCounts[c.contentType].confidence[c.confidence]++;
    }

    // Sort: real content types first (by count desc), Uncategorized last
    const summary = Object.entries(finalCounts)
      .sort(([a, aData], [b, bData]) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return bData.count - aData.count;
      })
      .map(([type, data]) => ({
        type,
        count: data.count,
        urls: data.urls,
        totalUrls: data.urls.length,
        confidence: data.confidence,
      }));

    const realTypes = summary.filter(s => s.type !== 'Uncategorized');

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
          uniqueTypes: realTypes.length,
          ambiguousScanned: htmlSignals.size,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Content types error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
