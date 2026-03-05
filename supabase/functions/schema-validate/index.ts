import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the page HTML with retry + timeout
    let html = '';
    let lastErr = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteAnalyzer/1.0)' },
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          return new Response(JSON.stringify({ success: false, error: `Failed to fetch page: HTTP ${res.status}` }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        html = await res.text();
        lastErr = '';
        break;
      } catch (e) {
        lastErr = e.message || String(e);
        console.warn(`schema-validate fetch attempt ${attempt + 1} failed: ${lastErr}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    if (lastErr) {
      return new Response(JSON.stringify({ success: false, error: `Could not reach site after 3 attempts: ${lastErr}` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Extract JSON-LD blocks
    const jsonLdBlocks = extractJsonLd(html);

    // 2. Detect Microdata
    const microdata = detectMicrodata(html);

    // 3. Detect RDFa
    const rdfa = detectRdfa(html);

    // 4. Analyze all schemas for rich results eligibility
    const richResults = analyzeRichResults(jsonLdBlocks);

    // 5. Validate JSON-LD for common errors
    const errors: any[] = [];
    const warnings: any[] = [];

    for (let i = 0; i < jsonLdBlocks.length; i++) {
      const block = jsonLdBlocks[i];
      if (block.parseError) {
        errors.push({ type: 'parse_error', block: i, message: block.parseError, raw: block.raw?.slice(0, 200) });
        continue;
      }
      const validation = validateSchema(block.parsed, i);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }

    const allTypes = [
      ...jsonLdBlocks.filter(b => !b.parseError).flatMap(b => extractTypes(b.parsed)),
      ...microdata.types,
      ...rdfa.types,
    ];
    const uniqueTypes = [...new Set(allTypes)];

    return new Response(JSON.stringify({
      success: true,
      summary: {
        totalSchemas: jsonLdBlocks.length + microdata.count + rdfa.count,
        jsonLdCount: jsonLdBlocks.length,
        microdataCount: microdata.count,
        rdfaCount: rdfa.count,
        detectedTypes: uniqueTypes,
        errorCount: errors.length,
        warningCount: warnings.length,
        eligibleRichResults: richResults,
      },
      jsonLd: jsonLdBlocks.map(b => b.parseError ? { parseError: b.parseError, raw: b.raw?.slice(0, 500) } : b.parsed),
      microdata: microdata.items.slice(0, 30),
      rdfa: rdfa.items.slice(0, 30),
      errors,
      warnings,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('schema-validate error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractJsonLd(html: string): any[] {
  const blocks: any[] = [];
  const regex = /<script\s+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      blocks.push({ parsed, raw });
    } catch (e) {
      blocks.push({ parseError: e.message, raw });
    }
  }
  return blocks;
}

function detectMicrodata(html: string): { count: number; types: string[]; items: any[] } {
  const items: any[] = [];
  const types: string[] = [];
  const regex = /itemtype\s*=\s*["'](https?:\/\/schema\.org\/[^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const type = match[1].replace(/https?:\/\/schema\.org\//, '');
    types.push(type);
    // Extract nearby itemprop values
    const contextStart = Math.max(0, match.index - 200);
    const contextEnd = Math.min(html.length, match.index + 500);
    const context = html.slice(contextStart, contextEnd);
    const props: string[] = [];
    const propRegex = /itemprop\s*=\s*["']([^"']+)["']/gi;
    let propMatch;
    while ((propMatch = propRegex.exec(context)) !== null) {
      props.push(propMatch[1]);
    }
    items.push({ type, properties: [...new Set(props)].slice(0, 20) });
  }
  return { count: items.length, types: [...new Set(types)], items };
}

function detectRdfa(html: string): { count: number; types: string[]; items: any[] } {
  const items: any[] = [];
  const types: string[] = [];
  const regex = /typeof\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const typeVal = match[1].trim();
    // Filter to schema.org-ish types
    if (typeVal.includes('schema') || typeVal.match(/^[A-Z][a-zA-Z]+$/)) {
      types.push(typeVal);
      items.push({ type: typeVal });
    }
  }
  return { count: items.length, types: [...new Set(types)], items };
}

function extractTypes(obj: any): string[] {
  if (!obj) return [];
  const types: string[] = [];
  if (typeof obj === 'object') {
    if (obj['@type']) {
      const t = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
      types.push(...t);
    }
    if (Array.isArray(obj)) {
      for (const item of obj) types.push(...extractTypes(item));
    } else if (obj['@graph']) {
      for (const item of obj['@graph']) types.push(...extractTypes(item));
    }
  }
  return types;
}

// Map schema types to Google rich result types
const richResultMap: Record<string, string> = {
  'Article': 'Article',
  'NewsArticle': 'Article',
  'BlogPosting': 'Article',
  'BreadcrumbList': 'Breadcrumb',
  'FAQPage': 'FAQ',
  'HowTo': 'How-to',
  'LocalBusiness': 'Local Business',
  'Restaurant': 'Local Business',
  'Organization': 'Logo / Knowledge Panel',
  'Product': 'Product',
  'AggregateOffer': 'Product',
  'Review': 'Review Snippet',
  'AggregateRating': 'Review Snippet',
  'Recipe': 'Recipe',
  'Event': 'Event',
  'JobPosting': 'Job Posting',
  'VideoObject': 'Video',
  'Course': 'Course',
  'Dataset': 'Dataset',
  'SoftwareApplication': 'Software App',
  'Book': 'Book',
  'MusicGroup': 'Music',
  'Person': 'Profile Page',
  'WebSite': 'Sitelinks Search Box',
  'SearchAction': 'Sitelinks Search Box',
  'ItemList': 'Carousel',
  'ImageObject': 'Image',
  'ClaimReview': 'Fact Check',
  'SpeakableSpecification': 'Speakable',
};

function analyzeRichResults(blocks: any[]): string[] {
  const eligible = new Set<string>();
  for (const block of blocks) {
    if (block.parseError) continue;
    const types = extractTypes(block.parsed);
    for (const t of types) {
      if (richResultMap[t]) eligible.add(richResultMap[t]);
    }
  }
  return [...eligible];
}

// Required fields per schema type
const requiredFields: Record<string, string[]> = {
  'Article': ['headline', 'author', 'datePublished', 'image'],
  'NewsArticle': ['headline', 'author', 'datePublished', 'image'],
  'BlogPosting': ['headline', 'author', 'datePublished'],
  'Product': ['name', 'image'],
  'LocalBusiness': ['name', 'address'],
  'Organization': ['name', 'url'],
  'FAQPage': ['mainEntity'],
  'HowTo': ['name', 'step'],
  'Event': ['name', 'startDate', 'location'],
  'JobPosting': ['title', 'datePosted', 'description', 'hiringOrganization'],
  'Recipe': ['name', 'image', 'recipeIngredient', 'recipeInstructions'],
  'VideoObject': ['name', 'description', 'thumbnailUrl', 'uploadDate'],
  'BreadcrumbList': ['itemListElement'],
  'WebSite': ['name', 'url'],
  'Review': ['itemReviewed', 'author'],
  'Course': ['name', 'description', 'provider'],
};

const recommendedFields: Record<string, string[]> = {
  'Article': ['publisher', 'dateModified', 'description'],
  'Product': ['description', 'offers', 'aggregateRating', 'brand', 'sku'],
  'LocalBusiness': ['telephone', 'openingHours', 'geo', 'image'],
  'Organization': ['logo', 'sameAs', 'contactPoint'],
  'Event': ['description', 'image', 'offers', 'performer', 'endDate'],
  'Recipe': ['cookTime', 'prepTime', 'nutrition', 'aggregateRating'],
  'VideoObject': ['contentUrl', 'duration', 'embedUrl'],
};

function validateSchema(obj: any, blockIndex: number): { errors: any[]; warnings: any[] } {
  const errors: any[] = [];
  const warnings: any[] = [];

  const items = obj['@graph'] ? obj['@graph'] : Array.isArray(obj) ? obj : [obj];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const type = Array.isArray(item['@type']) ? item['@type'][0] : item['@type'];
    if (!type) {
      warnings.push({ block: blockIndex, type: 'missing_type', message: 'Schema object missing @type property' });
      continue;
    }

    // Check required fields
    const required = requiredFields[type];
    if (required) {
      for (const field of required) {
        if (!item[field] && item[field] !== 0 && item[field] !== false) {
          errors.push({ block: blockIndex, type: 'missing_required', schemaType: type, field, message: `${type} is missing required field "${field}"` });
        }
      }
    }

    // Check recommended fields
    const recommended = recommendedFields[type];
    if (recommended) {
      for (const field of recommended) {
        if (!item[field] && item[field] !== 0 && item[field] !== false) {
          warnings.push({ block: blockIndex, type: 'missing_recommended', schemaType: type, field, message: `${type} is missing recommended field "${field}" for rich results` });
        }
      }
    }

    // Check for empty string values in important fields
    for (const [key, val] of Object.entries(item)) {
      if (val === '' && key !== '@context') {
        warnings.push({ block: blockIndex, type: 'empty_value', schemaType: type, field: key, message: `${type}.${key} has an empty string value` });
      }
    }
  }

  return { errors, warnings };
}
