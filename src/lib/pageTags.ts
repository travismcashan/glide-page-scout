// Simplified Page Template Taxonomy System
// Each URL gets a single "template" name (e.g., "Homepage", "Blog List", "Privacy Policy")
// The category (custom/template/toolkit) is derived for color-coding purposes.

export interface PageTag {
  template: string;       // e.g. "Homepage", "About", "Blog List", "Blog Detail", "Privacy Policy"
  contentType?: string;   // from content classification
  notes?: string;
}

export type PageTagsMap = Record<string, PageTag>;

// ── Template category derivation ──

export type TemplateCategory = 'custom' | 'template' | 'toolkit';

const CUSTOM_TEMPLATES = new Set([
  'Homepage', 'About', 'Pricing', 'Contact', 'Demo',
  'Services', 'Solutions', 'Platform', 'Product', 'Features',
  'How It Works', 'Why Us', 'Partners', 'Integrations',
]);

const TEMPLATE_TEMPLATES = new Set([
  'Blog List', 'Blog Detail', 'Case Study List', 'Case Study Detail',
  'Resource List', 'Resource Detail', 'News List', 'News Detail',
  'Event List', 'Event Detail', 'Podcast List', 'Podcast Detail',
  'Webinar List', 'Webinar Detail', 'Video List', 'Video Detail',
  'Press List', 'Press Detail', 'Career List', 'Career Detail',
  'Job List', 'Job Detail', 'Team List', 'Team Detail',
  'Portfolio List', 'Portfolio Detail', 'Project List', 'Project Detail',
  'Guide List', 'Guide Detail', 'FAQ List', 'FAQ Detail',
  'Help List', 'Help Detail', 'Docs List', 'Docs Detail',
  'Documentation List', 'Documentation Detail',
]);

const TOOLKIT_TEMPLATES = new Set([
  'Privacy Policy', 'Terms', 'Cookie Policy', 'Legal', 'Disclaimer',
  'Accessibility', 'Sitemap', 'Search', 'Login', 'Sign Up', 'Register', '404',
]);

/** Derive color category from template name */
export function getTemplateCategory(template: string): TemplateCategory {
  if (CUSTOM_TEMPLATES.has(template)) return 'custom';
  if (TEMPLATE_TEMPLATES.has(template)) return 'template';
  if (TOOLKIT_TEMPLATES.has(template)) return 'toolkit';
  // Heuristic: if it ends with "List" or "Detail", it's a template
  if (/\bList$/i.test(template) || /\bDetail$/i.test(template)) return 'template';
  return 'toolkit';
}

/** All known template names, grouped by category */
export const TEMPLATE_OPTIONS: { category: TemplateCategory; label: string; templates: string[] }[] = [
  {
    category: 'custom',
    label: 'Custom Pages',
    templates: [...CUSTOM_TEMPLATES].sort(),
  },
  {
    category: 'template',
    label: 'Template Pages',
    templates: [
      'Blog List', 'Blog Detail',
      'Case Study List', 'Case Study Detail',
      'Resource List', 'Resource Detail',
      'News List', 'News Detail',
      'Event List', 'Event Detail',
      'Career List', 'Career Detail',
      'Portfolio List', 'Portfolio Detail',
      'Guide List', 'Guide Detail',
      'Docs List', 'Docs Detail',
    ],
  },
  {
    category: 'toolkit',
    label: 'Toolkit Pages',
    templates: [...TOOLKIT_TEMPLATES].sort(),
  },
];

// ── URL normalization ──

export function normalizeTagKey(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

// ── CRUD helpers ──

export function getPageTag(tags: PageTagsMap | null | undefined, url: string): PageTag | undefined {
  if (!tags) return undefined;
  return tags[normalizeTagKey(url)];
}

export function setPageTag(tags: PageTagsMap | null | undefined, url: string, tag: PageTag): PageTagsMap {
  const map = { ...(tags || {}) };
  map[normalizeTagKey(url)] = tag;
  return map;
}

export function setPageTemplate(
  tags: PageTagsMap | null | undefined,
  url: string,
  template: string,
): PageTagsMap {
  const key = normalizeTagKey(url);
  const existing = tags?.[key];
  return { ...(tags || {}), [key]: { ...existing, template } };
}

// ── Auto-seed logic ──

const LIST_PATTERNS: Array<[RegExp, string]> = [
  [/^\/blog\/?$/i, 'Blog List'],
  [/^\/resources\/?$/i, 'Resource List'],
  [/^\/case-studies\/?$/i, 'Case Study List'],
  [/^\/news\/?$/i, 'News List'],
  [/^\/articles?\/?$/i, 'Blog List'],
  [/^\/events?\/?$/i, 'Event List'],
  [/^\/podcasts?\/?$/i, 'Podcast List'],
  [/^\/webinars?\/?$/i, 'Webinar List'],
  [/^\/videos?\/?$/i, 'Video List'],
  [/^\/press\/?$/i, 'Press List'],
  [/^\/careers?\/?$/i, 'Career List'],
  [/^\/jobs?\/?$/i, 'Job List'],
  [/^\/team\/?$/i, 'Team List'],
  [/^\/portfolio\/?$/i, 'Portfolio List'],
  [/^\/projects?\/?$/i, 'Project List'],
  [/^\/guides?\/?$/i, 'Guide List'],
  [/^\/faqs?\/?$/i, 'FAQ List'],
  [/^\/help\/?$/i, 'Help List'],
  [/^\/docs?\/?$/i, 'Docs List'],
  [/^\/documentation\/?$/i, 'Documentation List'],
];

const CUSTOM_PATTERNS: Array<[RegExp, string]> = [
  [/^\/?$/, 'Homepage'],
  [/^\/about\/?$/i, 'About'],
  [/^\/pricing\/?$/i, 'Pricing'],
  [/^\/contact\/?$/i, 'Contact'],
  [/^\/demo\/?$/i, 'Demo'],
  [/^\/services?\/?$/i, 'Services'],
  [/^\/solutions?\/?$/i, 'Solutions'],
  [/^\/platform\/?$/i, 'Platform'],
  [/^\/product\/?$/i, 'Product'],
  [/^\/features?\/?$/i, 'Features'],
  [/^\/how-it-works\/?$/i, 'How It Works'],
  [/^\/why-.*\/?$/i, 'Why Us'],
  [/^\/partners?\/?$/i, 'Partners'],
  [/^\/integrations?\/?$/i, 'Integrations'],
];

const TOOLKIT_PATTERNS: Array<[RegExp, string]> = [
  [/^\/privacy/i, 'Privacy Policy'],
  [/^\/terms/i, 'Terms'],
  [/^\/cookie/i, 'Cookie Policy'],
  [/^\/legal/i, 'Legal'],
  [/^\/disclaimer/i, 'Disclaimer'],
  [/^\/accessibility/i, 'Accessibility'],
  [/^\/sitemap/i, 'Sitemap'],
  [/^\/404/i, '404'],
  [/^\/search/i, 'Search'],
  [/^\/login/i, 'Login'],
  [/^\/signup/i, 'Sign Up'],
  [/^\/register/i, 'Register'],
];

/** Map from content type keyword to detail template name */
const CONTENT_TYPE_TO_DETAIL: Array<[string, string]> = [
  ['blog post', 'Blog Detail'], ['article', 'Blog Detail'],
  ['case study', 'Case Study Detail'], ['resource', 'Resource Detail'],
  ['news', 'News Detail'], ['event', 'Event Detail'],
  ['podcast', 'Podcast Detail'], ['webinar', 'Webinar Detail'],
  ['video', 'Video Detail'], ['press release', 'Press Detail'],
  ['guide', 'Guide Detail'], ['whitepaper', 'Resource Detail'],
  ['ebook', 'Resource Detail'], ['documentation', 'Docs Detail'],
  ['help article', 'Help Detail'], ['career', 'Career Detail'],
  ['job listing', 'Job Detail'], ['team member', 'Team Detail'],
  ['portfolio item', 'Portfolio Detail'], ['project', 'Project Detail'],
];

/** Derive list parent pattern from pathname */
const LIST_PARENT_PATTERNS = LIST_PATTERNS.map(([regex, template]) => {
  // Extract the base path from the regex, e.g. /blog/ -> "blog"
  const base = regex.source.replace(/[\^\/\?\$\\]/g, '').replace(/i$/, '').toLowerCase();
  return { base, template: template.replace(' List', ' Detail') };
});

export function autoSeedPageTags(
  existingTags: PageTagsMap | null | undefined,
  urls: string[],
  contentTypesClassified?: Array<{ url: string; contentType: string }>,
  baseUrl?: string,
): PageTagsMap {
  const map = { ...(existingTags || {}) };

  const ctMap = new Map<string, string>();
  if (contentTypesClassified) {
    for (const c of contentTypesClassified) {
      ctMap.set(normalizeTagKey(c.url), c.contentType);
    }
  }

  for (const url of urls) {
    const key = normalizeTagKey(url);
    if (map[key]) continue;

    let pathname: string;
    try { pathname = new URL(url).pathname; } catch { pathname = url; }

    const contentType = ctMap.get(key);

    // 1. Custom page patterns
    const customMatch = CUSTOM_PATTERNS.find(([p]) => p.test(pathname));
    if (customMatch) {
      map[key] = { template: customMatch[1] };
      continue;
    }

    // 2. Toolkit patterns
    const toolkitMatch = TOOLKIT_PATTERNS.find(([p]) => p.test(pathname));
    if (toolkitMatch) {
      map[key] = { template: toolkitMatch[1] };
      continue;
    }

    // 3. List page patterns
    const listMatch = LIST_PATTERNS.find(([p]) => p.test(pathname));
    if (listMatch) {
      map[key] = { template: listMatch[1], contentType: contentType || undefined };
      continue;
    }

    // 4. Content type → detail template
    if (contentType) {
      const detailMatch = CONTENT_TYPE_TO_DETAIL.find(([keyword]) =>
        contentType.toLowerCase().includes(keyword)
      );
      if (detailMatch) {
        map[key] = { template: detailMatch[1], contentType };
        continue;
      }
    }

    // 5. Parent path heuristic for detail pages
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const parentMatch = LIST_PARENT_PATTERNS.find(p => segments[0].toLowerCase() === p.base);
      if (parentMatch) {
        map[key] = { template: parentMatch.template, contentType: contentType || undefined };
        continue;
      }
    }

    // 6. Default → generic toolkit
    map[key] = { template: 'Toolkit' };
  }

  return map;
}

/** Get summary counts by category */
export function getPageTagsSummary(tags: PageTagsMap | null | undefined): {
  custom: number;
  template: number;
  toolkit: number;
  total: number;
} {
  if (!tags) return { custom: 0, template: 0, toolkit: 0, total: 0 };
  const values = Object.values(tags);
  return {
    custom: values.filter(t => getTemplateCategory(t.template) === 'custom').length,
    template: values.filter(t => getTemplateCategory(t.template) === 'template').length,
    toolkit: values.filter(t => getTemplateCategory(t.template) === 'toolkit').length,
    total: values.length,
  };
}
