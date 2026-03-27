import { format } from 'date-fns';

/**
 * Build a friendly results path: /results/example.com or /results/example.com/mar-27-2026-12-00am
 */
export function buildResultsPath(domain: string, createdAt: string, needsTimestamp = false): string {
  const slug = domain.replace(/^www\./, '');
  if (!needsTimestamp) return `/results/${slug}`;
  const dateSlug = format(new Date(createdAt), "MMM-dd-yyyy-hh-mma").toLowerCase();
  return `/results/${slug}/${dateSlug}`;
}

/**
 * Check if a string looks like a UUID
 */
export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
