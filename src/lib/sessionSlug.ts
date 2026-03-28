import { format } from 'date-fns';

/** Valid tab slugs for deep-linking */
export const TAB_SLUGS = ['analysis', 'prospecting', 'prompts', 'knowledge', 'chat', 'estimates'] as const;
export type TabSlug = typeof TAB_SLUGS[number];

/** Map URL tab slugs ↔ internal tab values */
const SLUG_TO_TAB: Record<string, string> = {
  analysis: 'raw-data',
  prospecting: 'prospecting',
  prompts: 'prompts',
  knowledge: 'knowledge',
  chat: 'chat',
  estimates: 'estimates',
};

const TAB_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_TAB).map(([k, v]) => [v, k])
);

export function tabSlugToValue(slug: string | undefined): string {
  if (!slug) return 'raw-data';
  return SLUG_TO_TAB[slug] ?? 'raw-data';
}

export function tabValueToSlug(value: string): string {
  return TAB_TO_SLUG[value] ?? 'analysis';
}

/**
 * Build a friendly path: /sites/example.com or /sites/example.com/crawls/mar-27-2026
 * Optionally append a tab: /sites/example.com/crawls/mar-27-2026/knowledge
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

  if (tab && tab !== 'raw-data') {
    const tabSlug = tabValueToSlug(tab);
    if (tabSlug !== 'analysis') {
      path += `/${tabSlug}`;
    }
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
