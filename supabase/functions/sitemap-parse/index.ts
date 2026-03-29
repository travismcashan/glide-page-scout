const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Sitemap Parser Edge Function
 *
 * Fetches /sitemap.xml (and follows sitemap index entries), extracts all URLs,
 * and groups them by sub-sitemap filename to provide content type hints.
 *
 * E.g. /work-sitemap.xml → content type hint "Work"
 *      /post-sitemap.xml → content type hint "Post"
 */

type SitemapGroup = {
  sitemapUrl: string;
  label: string;
  urls: string[];
};

/** Extract a human-readable label from a sitemap filename */
function labelFromSitemapUrl(sitemapUrl: string): string {
  try {
    const pathname = new URL(sitemapUrl).pathname;
    const filename = pathname.split('/').pop() || '';
    // Common patterns: post-sitemap.xml, post-sitemap1.xml, sitemap-posts.xml, posts.xml
    let name = filename
      .replace(/\.xml(\.gz)?$/i, '')       // strip extension
      .replace(/\d+$/, '')                  // strip trailing page numbers
      .replace(/[-_]sitemap$/i, '')         // "work-sitemap" → "work"
      .replace(/^sitemap[-_]/i, '')         // "sitemap-work" → "work"
      .replace(/^sitemap$/i, '')            // bare "sitemap" → empty
      .trim();

    if (!name) return 'General';

    // Nicely format: kebab/snake → Title Case
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return 'General';
  }
}

/** Known non-content-type sitemap labels to skip for content type hints */
const SKIP_LABELS = new Set([
  'general', 'page', 'pages', 'author', 'authors', 'category', 'categories',
  'tag', 'tags', 'taxonomy', 'taxonomies', 'archive', 'archives',
]);

/** Parse URLs from a sitemap XML string */
function parseUrlsFromSitemap(xml: string): string[] {
  const urls: string[] = [];
  // Match <loc>...</loc> tags
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url) urls.push(url);
  }
  return urls;
}

/** Check if XML is a sitemap index (contains <sitemapindex>) */
function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

async function fetchXml(url: string, timeoutMs = 10000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'GlidePageScout/1.0' },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const text = await response.text();
    return text;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl } = await req.json();

    if (!baseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'baseUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let origin: string;
    try {
      origin = new URL(baseUrl).origin;
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid baseUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Try common sitemap locations
    const sitemapCandidates = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap-index.xml`,
      `${origin}/wp-sitemap.xml`,
    ];

    let rootXml: string | null = null;
    let rootUrl = '';

    for (const candidate of sitemapCandidates) {
      rootXml = await fetchXml(candidate);
      if (rootXml) {
        rootUrl = candidate;
        console.log(`Found sitemap at ${candidate}`);
        break;
      }
    }

    // Also try robots.txt for Sitemap: directives
    if (!rootXml) {
      const robotsTxt = await fetchXml(`${origin}/robots.txt`);
      if (robotsTxt) {
        const sitemapLines = robotsTxt.match(/^Sitemap:\s*(.+)$/gmi);
        if (sitemapLines) {
          for (const line of sitemapLines) {
            const url = line.replace(/^Sitemap:\s*/i, '').trim();
            rootXml = await fetchXml(url);
            if (rootXml) {
              rootUrl = url;
              console.log(`Found sitemap via robots.txt: ${url}`);
              break;
            }
          }
        }
      }
    }

    if (!rootXml) {
      return new Response(
        JSON.stringify({ success: true, found: false, urls: [], groups: [], stats: { totalUrls: 0, sitemapsFound: 0 } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const allUrls: string[] = [];
    const groups: SitemapGroup[] = [];

    if (isSitemapIndex(rootXml)) {
      // Parse child sitemaps from the index
      const childSitemapUrls = parseUrlsFromSitemap(rootXml);
      console.log(`Sitemap index with ${childSitemapUrls.length} child sitemaps`);

      // Fetch all child sitemaps in parallel (limit concurrency)
      const BATCH = 10;
      for (let i = 0; i < childSitemapUrls.length; i += BATCH) {
        const batch = childSitemapUrls.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(async (childUrl) => {
            const xml = await fetchXml(childUrl, 15000);
            if (!xml) return null;
            const urls = parseUrlsFromSitemap(xml);
            // If this child sitemap is itself an index, recurse one level
            if (isSitemapIndex(xml)) {
              const nestedUrls = parseUrlsFromSitemap(xml);
              const nestedResults = await Promise.allSettled(
                nestedUrls.slice(0, 20).map(async (nestedUrl) => {
                  const nestedXml = await fetchXml(nestedUrl, 15000);
                  return nestedXml ? parseUrlsFromSitemap(nestedXml) : [];
                }),
              );
              const flatNested = nestedResults
                .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
                .flatMap(r => r.value);
              return { childUrl, urls: flatNested };
            }
            return { childUrl, urls };
          }),
        );

        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            const { childUrl, urls } = r.value;
            const label = labelFromSitemapUrl(childUrl);
            allUrls.push(...urls);
            groups.push({ sitemapUrl: childUrl, label, urls });
          }
        }
      }
    } else {
      // Single flat sitemap
      const urls = parseUrlsFromSitemap(rootXml);
      allUrls.push(...urls);
      groups.push({ sitemapUrl: rootUrl, label: 'General', urls });
    }

    // Deduplicate
    const uniqueUrls = [...new Set(allUrls)];

    // Build content type hints from groups (only groups with meaningful labels and 2+ URLs)
    const contentTypeHints: { label: string; urls: string[]; sitemapUrl: string }[] = [];
    for (const group of groups) {
      const lowerLabel = group.label.toLowerCase();
      if (SKIP_LABELS.has(lowerLabel)) continue;
      if (group.urls.length < 2) continue;
      contentTypeHints.push({
        label: group.label,
        urls: group.urls,
        sitemapUrl: group.sitemapUrl,
      });
    }

    console.log(`Sitemap parse complete: ${uniqueUrls.length} URLs, ${groups.length} sitemaps, ${contentTypeHints.length} content type hints`);

    return new Response(
      JSON.stringify({
        success: true,
        found: true,
        urls: uniqueUrls,
        groups,
        contentTypeHints,
        stats: {
          totalUrls: uniqueUrls.length,
          sitemapsFound: groups.length,
          contentTypeHintsCount: contentTypeHints.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Sitemap parse error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
