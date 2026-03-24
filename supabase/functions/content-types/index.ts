const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Three-Level Cascading Classification — Phased execution
 *
 * Phase 1 (grouping):  URL-pattern grouping → returns dirGroups
 * Phase 2 (sampling):  HTML signal extraction → returns htmlSignals
 * Phase 3 (classify):  AI classification + final assembly → returns full result
 *
 * Each phase is a separate call to avoid edge function timeouts.
 */

type BaseType = 'Page' | 'Post' | 'CPT' | 'Archive' | 'Search';

type ClassifiedUrl = {
  url: string;
  contentType: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  baseType: BaseType;
  template: string;
  cptName?: string;
};

// ---------------------------------------------------------------------------
// Phase 1 helpers
// ---------------------------------------------------------------------------

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

function groupByDirectory(urls: string[], baseUrl: string): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  let baseHost = '';
  try { baseHost = new URL(baseUrl).hostname; } catch { /* ignore */ }

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (baseHost && parsed.hostname !== baseHost) continue;
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length === 0) continue;
      if (segments.length === 1) {
        if (SINGLE_PAGE_SLUGS.has(segments[0].toLowerCase())) continue;
        continue;
      }
      // Group by deepest meaningful prefix (up to 2 levels)
      // e.g., /testing-services/package-testing/drop/ → "testing-services/package-testing"
      // e.g., /industry-solutions/medical-device/ → "industry-solutions/medical-device" 
      // e.g., /blog/my-post/ → "blog"
      const dir1 = segments[0].toLowerCase();
      const dir2 = segments.length >= 3 ? `${dir1}/${segments[1].toLowerCase()}` : dir1;
      
      // Add to both first-level and second-level groups
      if (!groups[dir1]) groups[dir1] = [];
      groups[dir1].push(url);
      
      if (dir2 !== dir1) {
        if (!groups[dir2]) groups[dir2] = [];
        groups[dir2].push(url);
      }
    } catch { /* skip bad URLs */ }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Phase 2 — HTML signal extraction
// ---------------------------------------------------------------------------

function classifyByHtml(html: string): { type: string; confidence: 'high' | 'medium'; source: string; baseType: BaseType } | null {
  // Schema.org JSON-LD
  const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      const content = match.replace(/<\/?script[^>]*>/gi, '');
      try {
        const data = JSON.parse(content);
        const schemaType = data['@type'] || (Array.isArray(data['@graph']) ? data['@graph'][0]?.['@type'] : null);
        if (schemaType) {
          const typeMap: Record<string, { name: string; baseType: BaseType }> = {
            'BlogPosting': { name: 'Blog Post', baseType: 'Post' },
            'NewsArticle': { name: 'News Article', baseType: 'Post' },
            'Article': { name: 'Article', baseType: 'Post' },
            'Product': { name: 'Product', baseType: 'CPT' },
            'Event': { name: 'Event', baseType: 'CPT' },
            'HowTo': { name: 'Guide', baseType: 'Post' },
            'Recipe': { name: 'Recipe', baseType: 'CPT' },
            'Course': { name: 'Course', baseType: 'CPT' },
            'VideoObject': { name: 'Video', baseType: 'CPT' },
            'PodcastEpisode': { name: 'Podcast Episode', baseType: 'CPT' },
            'SoftwareApplication': { name: 'Product', baseType: 'CPT' },
            'Service': { name: 'Service', baseType: 'Page' },
            'Review': { name: 'Review', baseType: 'CPT' },
            'CollectionPage': { name: 'Archive', baseType: 'Archive' },
            'ItemList': { name: 'Archive', baseType: 'Archive' },
          };
          if (['WebPage', 'AboutPage', 'ContactPage', 'FAQPage', 'Organization'].includes(schemaType)) continue;
          const mapped = typeMap[schemaType];
          if (mapped) return { type: mapped.name, confidence: 'high', source: 'schema-org', baseType: mapped.baseType };
        }
      } catch { /* skip */ }
    }
  }

  // WordPress body classes
  const bodyMatch = html.match(/<body[^>]*class="([^"]*)"[^>]*>/i);
  if (bodyMatch) {
    const classes = bodyMatch[1].toLowerCase();
    const cptMatch = classes.match(/\bsingle-([a-z][a-z0-9_-]+)\b/);
    if (cptMatch && !['post', 'page', 'attachment'].includes(cptMatch[1])) {
      const name = cptMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { type: name, confidence: 'high', source: 'css-classes', baseType: 'CPT' };
    }
    const archiveMatch = classes.match(/\bpost-type-archive-([a-z][a-z0-9_-]+)\b/);
    if (archiveMatch && !['post', 'page'].includes(archiveMatch[1])) {
      const name = archiveMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { type: name, confidence: 'high', source: 'css-classes', baseType: 'Archive' };
    }
    if (/\bsingle-post\b/.test(classes)) return { type: 'Blog Post', confidence: 'high', source: 'css-classes', baseType: 'Post' };
    if (/\bblog\b/.test(classes) && /\barchive\b/.test(classes)) return { type: 'Archive', confidence: 'high', source: 'css-classes', baseType: 'Archive' };
  }

  // OG type
  const ogMatch = html.match(/<meta[^>]*property="og:type"[^>]*content="([^"]*)"[^>]*>/i);
  if (ogMatch) {
    const ogType = ogMatch[1].toLowerCase();
    if (ogType === 'article') return { type: 'Article', confidence: 'medium', source: 'meta-tags', baseType: 'Post' };
    if (ogType === 'product') return { type: 'Product', confidence: 'medium', source: 'meta-tags', baseType: 'CPT' };
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
    const body = await req.json();
    const { phase = 'all', urls, baseUrl, sampleSize = 20, minCount = 3, sitemapHints } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'URLs array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // =====================================================================
    // PHASE 1: URL grouping (instant)
    // =====================================================================
    if (phase === 'group') {
      const dirGroups = groupByDirectory(urls, baseUrl);
      const groupCount = Object.keys(dirGroups).length;
      const totalGrouped = Object.values(dirGroups).reduce((s, g) => s + g.length, 0);
      console.info(`Phase 1: ${groupCount} directory groups, ${totalGrouped} grouped URLs out of ${urls.length}`);

      return new Response(
        JSON.stringify({ success: true, phase: 'group', dirGroups, groupCount, totalGrouped }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // =====================================================================
    // PHASE 2: HTML signal sampling
    // =====================================================================
    if (phase === 'sample') {
      const dirGroups: Record<string, string[]> = body.dirGroups || groupByDirectory(urls, baseUrl);
      const htmlSignals: Record<string, { type: string; confidence: 'high' | 'medium'; source: string; baseType: BaseType }> = {};

      const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (apiKey) {
        const samplesToScrape: string[] = [];
        for (const groupUrls of Object.values(dirGroups)) {
          if ((groupUrls as string[]).length >= 2) {
            samplesToScrape.push(...(groupUrls as string[]).slice(0, 2));
          }
        }
        const finalSample = samplesToScrape.slice(0, sampleSize);

        if (finalSample.length > 0) {
          // Process in batches of 5 to avoid overwhelming
          const batchSize = 5;
          for (let i = 0; i < finalSample.length; i += batchSize) {
            const batch = finalSample.slice(i, i + batchSize);
            const scrapePromises = batch.map(async (url) => {
              try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);
                const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url, formats: ['rawHtml'], onlyMainContent: false }),
                  signal: controller.signal,
                });
                clearTimeout(timeout);
                if (!response.ok) { await response.text(); return null; }
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
                htmlSignals[r.value.url] = { type: r.value.type, confidence: r.value.confidence, source: r.value.source, baseType: r.value.baseType };
              }
            }
          }
        }
      }

      console.info(`Phase 2: ${Object.keys(htmlSignals).length} HTML signals from sampling`);

      return new Response(
        JSON.stringify({ success: true, phase: 'sample', htmlSignals, signalCount: Object.keys(htmlSignals).length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // =====================================================================
    // PHASE 3: AI classification + final assembly
    // =====================================================================
    if (phase === 'classify') {
      const dirGroups: Record<string, string[]> = body.dirGroups || groupByDirectory(urls, baseUrl);
      const htmlSignals: Record<string, { type: string; confidence: 'high' | 'medium'; source: string; baseType: BaseType }> = body.htmlSignals || {};

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      let aiGroups: Array<{ baseType: BaseType; cptName?: string; template: string; directoryPrefix: string; confidence: 'high' | 'medium' }> = [];

      if (LOVABLE_API_KEY) {
        try {
          const htmlContext = Object.entries(htmlSignals)
            .map(([url, sig]) => `${url} → ${sig.type} [${sig.baseType}] (via ${sig.source})`)
            .join('\n');

          let homepage = '';
          const singleSegUrls: string[] = [];
          for (const url of urls) {
            try {
              const segs = new URL(url).pathname.split('/').filter(Boolean);
              if (segs.length === 0) { homepage = url; continue; }
              if (segs.length === 1) singleSegUrls.push(url);
            } catch { /* skip */ }
          }

          const sitemapContext = sitemapHints && Array.isArray(sitemapHints) && sitemapHints.length > 0
            ? sitemapHints
                .map((h: { label: string; urls: string[] }) => `Sitemap "${h.label}" (${h.urls.length} URLs) — samples: ${h.urls.slice(0, 3).join(', ')}`)
                .join('\n')
            : '';

          const systemPrompt = `You are a web content strategist classifying URL directory groups by their WordPress content model type.

Classify each DIRECTORY GROUP into exactly ONE type:
- **Page**: One-off pages with unique designs. Only for directories with 1-2 child URLs or utility pages.
- **Post**: Blog/news articles in a date-based feed. Usually under /blog/, /news/, /articles/.
- **CPT** (Custom Post Type): ANY directory group with ${minCount}+ child URLs that follow a repeating template. This includes services, industries, solutions, test standards, team members, case studies, products, portfolio items, locations, resources, etc. Provide the CPT name.
- **Archive**: The top-level index/list page of a CPT or blog section (e.g., /blog/ with no slug, /services/ as a listing page).
- **Search**: Site search results pages.

Then assign a TEMPLATE name:
- Page templates: Homepage, About, Pricing, Contact, Careers, etc.
- Post templates: Blog Detail
- CPT templates: [CPT Name] Detail (e.g., "Service Detail", "Industry Detail", "Test Standard Detail", "Team Member Detail")
- Archive templates: Archive: [What] (e.g., "Archive: Blog", "Archive: Services")

THE MOST IMPORTANT RULE — READ CAREFULLY:
**If a directory group has ${minCount} or more child URLs, it is ALMOST CERTAINLY a CPT, not a Page.**
For example:
- /testing-services/ with 34 URLs → CPT (cptName: "Testing Service")
- /industry-solutions/ with 23 URLs → CPT (cptName: "Industry Solution")  
- /test-standards/ with 8 URLs → CPT (cptName: "Test Standard")
- /resources/ with 18 URLs → CPT (cptName: "Resource")
- /team_members/ with 4 URLs → CPT (cptName: "Team Member")

Additional rules:
1. The homepage (/) is ALWAYS Page with template Homepage.
2. Blog/news posts are Post, not CPT.
3. A single index/listing page at a directory root (e.g., /services/ itself with no child slug) is Archive.
4. Only truly unique one-off pages (About, Contact, Careers) are Page type.
5. When in doubt between Page and CPT for a group with ${minCount}+ URLs, ALWAYS choose CPT.

You MUST classify EVERY directory group.`;

          // Build directory listing — show both top-level and sub-directory groups
          const dirEntries = Object.entries(dirGroups);
          // Filter: only show groups that add info (skip sub-dirs if they ARE the top-level)
          const dirListing = dirEntries
            .map(([dir, v]) => `/${dir}/ (${v.length} URLs) — samples: ${v.slice(0, 4).join(', ')}`)
            .join('\n');

          const userPrompt = `Analyze this website (${baseUrl}) and classify its URL structure.

IMPORTANT: Classify DIRECTORY GROUPS, not individual URLs. Each group shares a URL prefix.

Homepage: ${homepage || 'not found'}

Top-level pages (single-segment): 
${singleSegUrls.join('\n') || 'none'}

Directory groups:
${dirListing || '(none)'}

HTML signals from sampled pages:
${htmlContext || '(none)'}

${sitemapContext ? `XML Sitemap groupings (STRONG signal — CMS organizes content by type):\n${sitemapContext}\n` : ''}
For each directory group, classify the group as a whole. Return the DIRECTORY PREFIX (e.g., "/testing-services/", "/industry-solutions/", "/blog/") — NOT every individual URL.
${sitemapContext ? 'Sitemap groupings are the strongest signal — use them.' : ''}`;

          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              tools: [{
                type: 'function',
                function: {
                  name: 'classify_urls',
                  description: 'Classify URL directory groups with their WordPress content model type and template.',
                  parameters: {
                    type: 'object',
                    properties: {
                      groups: {
                        type: 'array',
                        description: 'Groups classified by directory prefix or individual top-level URLs',
                        items: {
                          type: 'object',
                          properties: {
                            baseType: { type: 'string', enum: ['Page', 'Post', 'CPT', 'Archive', 'Search'], description: 'WordPress content model type' },
                            cptName: { type: 'string', description: 'CPT name (required for CPT type, e.g. "Case Study", "Team Member", "Industry", "Service")' },
                            template: { type: 'string', description: 'Template name describing the page purpose' },
                            directoryPrefix: { type: 'string', description: 'The URL directory prefix for this group, e.g. "/blog/", "/testing-services/", "/team_members/". Use "/" for homepage.' },
                            confidence: { type: 'string', enum: ['high', 'medium'], description: 'Classification confidence' },
                          },
                          required: ['baseType', 'template', 'directoryPrefix', 'confidence'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['groups'],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: 'function', function: { name: 'classify_urls' } },
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
              try {
                const parsed = JSON.parse(toolCall.function.arguments);
                if (parsed?.groups) {
                  aiGroups = parsed.groups;
                  console.info(`Phase 3: AI classified ${aiGroups.length} directory groups`);
                }
              } catch (parseErr) {
                console.error('Failed to parse AI response:', parseErr);
              }
            }
          } else {
            console.error('AI classification failed:', response.status, await response.text());
          }
        } catch (e) {
          console.error('AI classification error:', e);
        }
      }

      // Build final classifications using directory prefix matching
      const classified: ClassifiedUrl[] = [];

      const sortedGroups = [...aiGroups].sort((a, b) =>
        (b.directoryPrefix?.length || 0) - (a.directoryPrefix?.length || 0)
      );

      function findAiGroup(url: string): typeof aiGroups[0] | null {
        try {
          const pathname = new URL(url).pathname.toLowerCase();
          for (const group of sortedGroups) {
            const prefix = (group.directoryPrefix || '').toLowerCase().replace(/\/$/, '');
            if (!prefix || prefix === '/') {
              if (pathname === '/' || pathname === '') return group;
              continue;
            }
            if (pathname.startsWith(prefix + '/') || pathname === prefix) return group;
          }
        } catch { /* skip */ }
        return null;
      }

      for (const url of urls) {
        const htmlSig = htmlSignals[url];
        const aiGroup = findAiGroup(url);

        if (aiGroup) {
          const conf = htmlSig ? 'high' : (aiGroup.confidence || 'medium');
          classified.push({
            url,
            contentType: aiGroup.cptName || aiGroup.template,
            confidence: conf as 'high' | 'medium' | 'low',
            source: htmlSig ? htmlSig.source : 'ai',
            baseType: aiGroup.baseType as BaseType,
            template: aiGroup.template,
            cptName: aiGroup.cptName,
          });
        } else if (htmlSig) {
          classified.push({
            url,
            contentType: htmlSig.type,
            confidence: htmlSig.confidence,
            source: htmlSig.source,
            baseType: htmlSig.baseType,
            template: htmlSig.type,
          });
        } else {
          classified.push({
            url,
            contentType: 'Uncategorized',
            confidence: 'low',
            source: 'url-pattern',
            baseType: 'Page',
            template: 'Page',
          });
        }
      }

      // Post-processing: CPT groups below minCount get demoted to Page
      const cptCounts = new Map<string, number>();
      for (const c of classified) {
        if (c.baseType === 'CPT' && c.cptName) {
          cptCounts.set(c.cptName, (cptCounts.get(c.cptName) || 0) + 1);
        }
      }
      for (const c of classified) {
        if (c.baseType === 'CPT' && c.cptName && (cptCounts.get(c.cptName) || 0) < minCount) {
          c.baseType = 'Page';
          c.contentType = c.template;
          c.cptName = undefined;
        }
      }

      // Build summary
      const typeCounts: Record<string, { count: number; urls: string[]; confidence: Record<string, number>; baseType: BaseType; cptName?: string }> = {};
      for (const c of classified) {
        if (!typeCounts[c.contentType]) {
          typeCounts[c.contentType] = { count: 0, urls: [], confidence: { high: 0, medium: 0, low: 0 }, baseType: c.baseType, cptName: c.cptName };
        }
        typeCounts[c.contentType].count++;
        typeCounts[c.contentType].urls.push(c.url);
        typeCounts[c.contentType].confidence[c.confidence]++;
      }

      const typeOrder: Record<BaseType, number> = { Post: 0, CPT: 1, Archive: 2, Search: 3, Page: 4 };
      const summary = Object.entries(typeCounts)
        .sort(([a, aData], [b, bData]) => {
          if (a === 'Uncategorized') return 1;
          if (b === 'Uncategorized') return -1;
          const orderDiff = (typeOrder[aData.baseType] || 4) - (typeOrder[bData.baseType] || 4);
          if (orderDiff !== 0) return orderDiff;
          return bData.count - aData.count;
        })
        .map(([type, data]) => ({
          type,
          count: data.count,
          urls: data.urls,
          totalUrls: data.urls.length,
          confidence: data.confidence,
          baseType: data.baseType,
          cptName: data.cptName,
        }));

      const realTypes = summary.filter(s => s.type !== 'Uncategorized');

      return new Response(
        JSON.stringify({
          success: true,
          phase: 'classify',
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
            ambiguousScanned: Object.keys(htmlSignals).length,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Default: return error for unknown phase
    return new Response(
      JSON.stringify({ success: false, error: `Unknown phase: ${phase}. Use "group", "sample", or "classify".` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Content types error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
