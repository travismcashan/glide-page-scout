import { format } from 'date-fns';

/** Valid tab slugs for deep-linking (audit-only — company features moved to CompanyDetailPage) */
export const TAB_SLUGS = ['analysis'] as const;
export type TabSlug = typeof TAB_SLUGS[number];

/** Map URL tab slugs ↔ internal tab values */
const SLUG_TO_TAB: Record<string, string> = {
  analysis: 'raw-data',
  // backward compat: old URLs → analysis
  prompts: 'raw-data',
  prospecting: 'raw-data',
  knowledge: 'raw-data',
  chat: 'raw-data',
  estimates: 'raw-data',
  roadmap: 'raw-data',
  proposal: 'raw-data',
};

const TAB_TO_SLUG: Record<string, string> = { 'raw-data': 'analysis' };

export function tabSlugToValue(slug: string | undefined): string {
  if (!slug) return 'raw-data';
  return SLUG_TO_TAB[slug] ?? 'raw-data';
}

export function tabValueToSlug(value: string): string {
  return TAB_TO_SLUG[value] ?? 'analysis';
}

/**
 * Build a friendly path: /sites/example.com or /sites/example.com/crawls/mar-27-2026
 */
export function buildSitePath(
  domain: string,
  createdAt?: string,
  needsTimestamp = false,
  tab?: string,
): string {
  const slug = domain.replace(/^www\./, '');
  let path = `/sites/${slug}`;

  if (needsTimestamp && createdAt) {
    const dateSlug = format(new Date(createdAt), "MMM-dd-yyyy").toLowerCase();
    path += `/crawls/${dateSlug}`;
  }

  return path;
}

/** @deprecated Use buildSitePath instead */
export function buildResultsPath(domain: string, createdAt: string, needsTimestamp = false): string {
  return buildSitePath(domain, createdAt, needsTimestamp);
}

/**
 * Check if a string looks like a UUID
 */
export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Generate a URL-friendly slug from a list name.
 * Matches the DB slugify() function logic.
 */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build a friendly list path: /lists/signature-health-v6
 */
export function buildListPath(slug: string): string {
  return `/lists/${slug}`;
}
