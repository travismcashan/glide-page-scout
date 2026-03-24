// Three-Level Cascading Classification System
// Level 1: Type (Page, Post, CPT, Archive, Search)
// Level 2: Template (Homepage, Blog Detail, Case Study Detail, etc.)
// Level 3: Repeating Content (filtered view — Post + CPT only)

export type BaseType = 'Page' | 'Post' | 'CPT' | 'Archive' | 'Search';

export interface PageTag {
  template: string;       // e.g. "Homepage", "About", "Blog Detail", "Case Study Detail"
  baseType?: BaseType;    // Level 1 classification
  contentType?: string;   // from content classification
  cptName?: string;       // CPT name for CPT types (e.g., "Case Study")
  notes?: string;
}

export type PageTagsMap = Record<string, PageTag>;

// ── Template category derivation (for badge colors) ──

export type TemplateCategory = 'custom' | 'template' | 'toolkit';

/** Map baseType to color category */
export function getTemplateCategoryFromBaseType(baseType?: BaseType): TemplateCategory {
  if (!baseType) return 'custom';
  switch (baseType) {
    case 'Page': return 'custom';
    case 'Post': return 'template';
    case 'CPT': return 'template';
    case 'Archive': return 'template';
    case 'Search': return 'toolkit';
    default: return 'custom';
  }
}

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

/** Derive color category from template name (fallback when baseType not set) */
export function getTemplateCategory(template: string): TemplateCategory {
  if (CUSTOM_TEMPLATES.has(template)) return 'custom';
  if (TEMPLATE_TEMPLATES.has(template)) return 'template';
  if (TOOLKIT_TEMPLATES.has(template)) return 'toolkit';
  if (/\bList$/i.test(template) || /\bDetail$/i.test(template)) return 'template';
  if (/\bArchive/i.test(template)) return 'template';
  return 'custom';
}

// ── Runtime custom templates (persist for session) ──

const runtimeCustom: string[] = [];
const runtimeTemplate: string[] = [];
const runtimeToolkit: string[] = [];

export function addCustomTemplate(name: string, category: TemplateCategory) {
  const target = category === 'custom' ? runtimeCustom : category === 'template' ? runtimeTemplate : runtimeToolkit;
  if (!target.includes(name)) target.push(name);
  const set = category === 'custom' ? CUSTOM_TEMPLATES : category === 'template' ? TEMPLATE_TEMPLATES : TOOLKIT_TEMPLATES;
  set.add(name);
}

/** All known template names, grouped by category (includes user-added) */
export function getTemplateOptions(): { category: TemplateCategory; label: string; templates: string[] }[] {
  return [
    {
      category: 'custom',
      label: 'Custom Pages',
      templates: [...new Set([...[...CUSTOM_TEMPLATES].sort(), ...runtimeCustom])],
    },
    {
      category: 'template',
      label: 'Template Pages',
      templates: [...new Set([
        'Blog List', 'Blog Detail',
        'Case Study List', 'Case Study Detail',
        'Resource List', 'Resource Detail',
        'News List', 'News Detail',
        'Event List', 'Event Detail',
        'Career List', 'Career Detail',
        'Portfolio List', 'Portfolio Detail',
        'Guide List', 'Guide Detail',
        'Docs List', 'Docs Detail',
        ...runtimeTemplate,
      ])],
    },
    {
      category: 'toolkit',
      label: 'Toolkit Pages',
      templates: [...new Set([...[...TOOLKIT_TEMPLATES].sort(), ...runtimeToolkit])],
    },
  ];
}

/** @deprecated Use getTemplateOptions() instead */
export const TEMPLATE_OPTIONS = getTemplateOptions();

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
  const base = regex.source.replace(/[\^\/\?\$\\]/g, '').replace(/i$/, '').toLowerCase();
  return { base, template: template.replace(' List', ' Detail') };
});

export function autoSeedPageTags(
  existingTags: PageTagsMap | null | undefined,
  urls: string[],
  contentTypesClassified?: Array<{ url: string; contentType: string; baseType?: BaseType; cptName?: string }>,
  baseUrl?: string,
): PageTagsMap {
  const map = { ...(existingTags || {}) };

  const ctMap = new Map<string, { contentType: string; baseType?: BaseType; cptName?: string }>();
  if (contentTypesClassified) {
    for (const c of contentTypesClassified) {
      ctMap.set(normalizeTagKey(c.url), { contentType: c.contentType, baseType: c.baseType, cptName: c.cptName });
    }
  }

  for (const url of urls) {
    const key = normalizeTagKey(url);
    if (map[key]) continue;

    let pathname: string;
    try { pathname = new URL(url).pathname; } catch { pathname = url; }

    const ct = ctMap.get(key);

    // 1. Custom page patterns
    const customMatch = CUSTOM_PATTERNS.find(([p]) => p.test(pathname));
    if (customMatch) {
      map[key] = { template: customMatch[1], baseType: 'Page' };
      continue;
    }

    // 2. Toolkit patterns
    const toolkitMatch = TOOLKIT_PATTERNS.find(([p]) => p.test(pathname));
    if (toolkitMatch) {
      map[key] = { template: toolkitMatch[1], baseType: 'Page' };
      continue;
    }

    // 3. List page patterns → Archive
    const listMatch = LIST_PATTERNS.find(([p]) => p.test(pathname));
    if (listMatch) {
      map[key] = { template: listMatch[1], baseType: 'Archive', contentType: ct?.contentType || undefined };
      continue;
    }

    // 4. Content type classification → use baseType from classifier
    if (ct?.baseType) {
      map[key] = {
        template: ct.contentType,
        baseType: ct.baseType,
        contentType: ct.contentType,
        cptName: ct.cptName,
      };
      continue;
    }

    // 5. Content type → detail template (legacy fallback)
    if (ct?.contentType) {
      const detailMatch = CONTENT_TYPE_TO_DETAIL.find(([keyword]) =>
        ct.contentType.toLowerCase().includes(keyword)
      );
      if (detailMatch) {
        map[key] = { template: detailMatch[1], baseType: 'Post', contentType: ct.contentType };
        continue;
      }
    }

    // 6. Parent path heuristic for detail pages
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const parentMatch = LIST_PARENT_PATTERNS.find(p => segments[0].toLowerCase() === p.base);
      if (parentMatch) {
        map[key] = { template: parentMatch.template, baseType: 'Post', contentType: ct?.contentType || undefined };
        continue;
      }
    }

    // 7. Default → Page
    map[key] = { template: 'Page', baseType: 'Page' };
  }

  return map;
}

/** Get summary counts by base type */
export function getPageTagsSummary(tags: PageTagsMap | null | undefined): {
  page: number;
  post: number;
  cpt: number;
  archive: number;
  search: number;
  total: number;
  // Legacy compat
  custom: number;
  template: number;
  toolkit: number;
} {
  if (!tags) return { page: 0, post: 0, cpt: 0, archive: 0, search: 0, total: 0, custom: 0, template: 0, toolkit: 0 };
  const values = Object.values(tags);
  return {
    page: values.filter(t => t.baseType === 'Page').length,
    post: values.filter(t => t.baseType === 'Post').length,
    cpt: values.filter(t => t.baseType === 'CPT').length,
    archive: values.filter(t => t.baseType === 'Archive').length,
    search: values.filter(t => t.baseType === 'Search').length,
    total: values.length,
    custom: values.filter(t => getTemplateCategory(t.template) === 'custom').length,
    template: values.filter(t => getTemplateCategory(t.template) === 'template').length,
    toolkit: values.filter(t => getTemplateCategory(t.template) === 'toolkit').length,
  };
}
