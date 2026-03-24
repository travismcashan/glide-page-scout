// Unified Page Template Taxonomy System

export type PageTemplateType = 'custom' | 'template' | 'toolkit';
export type PageTemplateVariant = 'list' | 'detail';

export interface PageTag {
  template: PageTemplateType;
  variant?: PageTemplateVariant;
  contentType?: string;
  label?: string;
  notes?: string;
}

export type PageTagsMap = Record<string, PageTag>;

/** Normalize URL key for consistent lookups */
export function normalizeTagKey(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/** Get a page tag for a URL */
export function getPageTag(tags: PageTagsMap | null | undefined, url: string): PageTag | undefined {
  if (!tags) return undefined;
  return tags[normalizeTagKey(url)];
}

/** Set a page tag for a URL, returns new map */
export function setPageTag(tags: PageTagsMap | null | undefined, url: string, tag: PageTag): PageTagsMap {
  const map = { ...(tags || {}) };
  map[normalizeTagKey(url)] = tag;
  return map;
}

/** Set template type for a URL, preserving other fields */
export function setPageTemplate(
  tags: PageTagsMap | null | undefined,
  url: string,
  template: PageTemplateType,
  variant?: PageTemplateVariant
): PageTagsMap {
  const key = normalizeTagKey(url);
  const existing = tags?.[key];
  const newTag: PageTag = { ...existing, template };
  if (variant) newTag.variant = variant;
  else if (template !== 'template') delete newTag.variant;
  return { ...(tags || {}), [key]: newTag };
}

/** Bulk-set template for multiple URLs */
export function bulkSetTemplate(
  tags: PageTagsMap | null | undefined,
  urls: string[],
  template: PageTemplateType,
  variant?: PageTemplateVariant,
  contentType?: string
): PageTagsMap {
  const map = { ...(tags || {}) };
  for (const url of urls) {
    const key = normalizeTagKey(url);
    const existing = map[key];
    const newTag: PageTag = { ...existing, template };
    if (variant) newTag.variant = variant;
    if (contentType) newTag.contentType = contentType;
    map[key] = newTag;
  }
  return map;
}

// ── List patterns for auto-detection ──

const LIST_PATTERNS = [
  /^\/blog\/?$/i,
  /^\/resources\/?$/i,
  /^\/case-studies\/?$/i,
  /^\/news\/?$/i,
  /^\/articles\/?$/i,
  /^\/events\/?$/i,
  /^\/podcasts?\/?$/i,
  /^\/webinars?\/?$/i,
  /^\/videos?\/?$/i,
  /^\/press\/?$/i,
  /^\/careers?\/?$/i,
  /^\/jobs?\/?$/i,
  /^\/team\/?$/i,
  /^\/portfolio\/?$/i,
  /^\/projects?\/?$/i,
  /^\/guides?\/?$/i,
  /^\/faqs?\/?$/i,
  /^\/help\/?$/i,
  /^\/docs?\/?$/i,
  /^\/documentation\/?$/i,
];

const CUSTOM_PATTERNS = [
  /^\/?$/,                    // homepage
  /^\/about\/?$/i,
  /^\/pricing\/?$/i,
  /^\/contact\/?$/i,
  /^\/demo\/?$/i,
  /^\/services?\/?$/i,
  /^\/solutions?\/?$/i,
  /^\/platform\/?$/i,
  /^\/product\/?$/i,
  /^\/features?\/?$/i,
  /^\/how-it-works\/?$/i,
  /^\/why-.*\/?$/i,
  /^\/partners?\/?$/i,
  /^\/integrations?\/?$/i,
];

const TOOLKIT_PATTERNS = [
  /^\/privacy/i,
  /^\/terms/i,
  /^\/cookie/i,
  /^\/legal/i,
  /^\/disclaimer/i,
  /^\/accessibility/i,
  /^\/sitemap/i,
  /^\/404/i,
  /^\/search/i,
  /^\/login/i,
  /^\/signup/i,
  /^\/register/i,
];

/** Content type names that suggest template detail pages */
const TEMPLATE_CONTENT_TYPES = [
  'blog post', 'article', 'case study', 'resource', 'news',
  'event', 'podcast', 'webinar', 'video', 'press release',
  'guide', 'whitepaper', 'ebook', 'documentation', 'help article',
  'career', 'job listing', 'team member', 'portfolio item', 'project',
];

/**
 * Auto-seed page tags from discovered URLs and content types data.
 * Never overwrites existing manual tags.
 */
export function autoSeedPageTags(
  existingTags: PageTagsMap | null | undefined,
  urls: string[],
  contentTypesClassified?: Array<{ url: string; contentType: string }>,
  baseUrl?: string,
): PageTagsMap {
  const map = { ...(existingTags || {}) };

  // Build a content type lookup
  const ctMap = new Map<string, string>();
  if (contentTypesClassified) {
    for (const c of contentTypesClassified) {
      ctMap.set(normalizeTagKey(c.url), c.contentType);
    }
  }

  for (const url of urls) {
    const key = normalizeTagKey(url);
    // Don't overwrite existing tags
    if (map[key]) continue;

    let pathname: string;
    try { pathname = new URL(url).pathname; } catch { pathname = url; }

    const contentType = ctMap.get(key);

    // 1. Homepage → custom
    if (pathname === '/' || pathname === '') {
      map[key] = { template: 'custom', label: 'Homepage' };
      continue;
    }

    // 2. Known custom page patterns
    if (CUSTOM_PATTERNS.some(p => p.test(pathname))) {
      map[key] = { template: 'custom' };
      continue;
    }

    // 3. Known toolkit patterns
    if (TOOLKIT_PATTERNS.some(p => p.test(pathname))) {
      map[key] = { template: 'toolkit' };
      continue;
    }

    // 4. List page patterns
    if (LIST_PATTERNS.some(p => p.test(pathname))) {
      map[key] = { template: 'template', variant: 'list', contentType: contentType || undefined };
      continue;
    }

    // 5. If content type matches a template type → detail
    if (contentType && TEMPLATE_CONTENT_TYPES.some(t => contentType.toLowerCase().includes(t))) {
      map[key] = { template: 'template', variant: 'detail', contentType };
      continue;
    }

    // 6. Heuristic: if URL has 3+ path segments and a parent matches a list pattern
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const parentPath = '/' + segments[0] + '/';
      if (LIST_PATTERNS.some(p => p.test('/' + segments[0]))) {
        map[key] = { template: 'template', variant: 'detail', contentType: contentType || undefined };
        continue;
      }
    }

    // 7. Default → toolkit
    map[key] = { template: 'toolkit' };
  }

  return map;
}

/** Get summary counts from page tags */
export function getPageTagsSummary(tags: PageTagsMap | null | undefined): {
  custom: number;
  templateList: number;
  templateDetail: number;
  toolkit: number;
  total: number;
} {
  if (!tags) return { custom: 0, templateList: 0, templateDetail: 0, toolkit: 0, total: 0 };
  const values = Object.values(tags);
  return {
    custom: values.filter(t => t.template === 'custom').length,
    templateList: values.filter(t => t.template === 'template' && t.variant === 'list').length,
    templateDetail: values.filter(t => t.template === 'template' && t.variant === 'detail').length,
    toolkit: values.filter(t => t.template === 'toolkit').length,
    total: values.length,
  };
}
