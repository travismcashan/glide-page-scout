/**
 * Company normalization utilities for cleanup, matching, and deduplication.
 * Ported from supabase/functions/global-sync/index.ts with additions.
 */

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.toLowerCase().trim();
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  if (!d || !d.includes('.')) return null;
  return d;
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.]?\s*(inc|llc|ltd|corp|co|company|corporation|group|enterprises|lp|llp|pllc|pc)\b\.?/gi, '')
    .replace(/\s+(inc|llc|ltd|corp|co|company|corporation|group|enterprises|lp|llp|pllc|pc)\s*$/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check if a string looks like a domain (e.g. "brokengrill.com") */
export function looksLikeDomain(name: string): boolean {
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(name.trim());
}

/**
 * Jaro-Winkler similarity between two strings.
 * Returns 0-1 where 1 is an exact match.
 */
export function computeSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Containment: one string fully inside the other = very high match
  if (a.includes(b) || b.includes(a)) return 0.95;

  // Word overlap: all words in the shorter string appear in the longer
  const aWords = a.split(/\s+/).filter(w => w.length > 1);
  const bWords = b.split(/\s+/).filter(w => w.length > 1);
  const [shorter, longer] = aWords.length <= bWords.length ? [aWords, bWords] : [bWords, aWords];
  if (shorter.length > 0) {
    const longerStr = longer.join(' ');
    const matched = shorter.filter(w => longerStr.includes(w)).length;
    if (matched === shorter.length) return 0.92; // all words found
    if (matched > 0 && matched / shorter.length >= 0.8) return 0.85; // most words found
  }

  // Jaro-Winkler for fuzzy character-level matching
  const matchWindow = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler boost for common prefix (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(a.length, b.length)); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

export type MatchConfidence = 'high' | 'medium' | 'low';

export type MatchResult = {
  targetId: string;
  targetName: string;
  targetDomain: string | null;
  confidence: MatchConfidence;
  matchType: 'exact_domain' | 'normalized_domain' | 'fuzzy_name';
  score: number;
};

/** Find the best match for a company name/domain among candidates */
export function findBestMatch(
  name: string,
  domain: string | null,
  candidates: { id: string; name: string; domain: string | null }[],
  minScore = 0.75
): MatchResult | null {
  const normDomain = normalizeDomain(domain);
  const normName = normalizeCompanyName(name);

  let best: MatchResult | null = null;

  for (const c of candidates) {
    const cDomain = normalizeDomain(c.domain);

    // Exact domain match
    if (normDomain && cDomain && normDomain === cDomain) {
      return {
        targetId: c.id,
        targetName: c.name,
        targetDomain: c.domain,
        confidence: 'high',
        matchType: 'exact_domain',
        score: 1,
      };
    }

    // Fuzzy name match
    const score = computeSimilarity(normName, normalizeCompanyName(c.name));
    if (score >= minScore && (!best || score > best.score)) {
      best = {
        targetId: c.id,
        targetName: c.name,
        targetDomain: c.domain,
        confidence: score >= 0.92 ? 'high' : score >= 0.82 ? 'medium' : 'low',
        matchType: 'fuzzy_name',
        score,
      };
    }
  }

  return best;
}

export type DuplicateGroup = {
  key: string;
  matchType: 'name' | 'domain';
  companies: CompanyRecord[];
  recommended: CompanyRecord; // the one to keep
};

export type CompanyRecord = {
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  status: string;
  hubspot_company_id: string | null;
  harvest_client_id: string | null;
  harvest_client_name: string | null;
  freshdesk_company_id: string | null;
  freshdesk_company_name: string | null;
  quickbooks_client_name: string | null;
  asana_project_gids: string[] | null;
  industry: string | null;
  employee_count: string | null;
  enrichment_data: any;
  created_at: string;
  last_synced_at: string | null;
};

/** Count how many cross-system IDs a company has */
function systemIdCount(c: CompanyRecord): number {
  let count = 0;
  if (c.hubspot_company_id) count++;
  if (c.harvest_client_id) count++;
  if (c.freshdesk_company_id) count++;
  if (c.quickbooks_client_name) count++;
  if (c.asana_project_gids?.length) count++;
  if (c.domain) count++;
  if (c.industry) count++;
  if (c.enrichment_data && Object.keys(c.enrichment_data).length > 0) count++;
  return count;
}

/** Find all duplicate groups (exact name or exact domain) */
export function findDuplicates(companies: CompanyRecord[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  // Group by normalized name
  const byName = new Map<string, CompanyRecord[]>();
  for (const c of companies) {
    const key = normalizeCompanyName(c.name);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(c);
  }
  for (const [key, group] of byName) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => systemIdCount(b) - systemIdCount(a));
    groups.push({ key, matchType: 'name', companies: group, recommended: sorted[0] });
  }

  // Group by normalized domain (skip if already caught by name)
  const seenIds = new Set(groups.flatMap(g => g.companies.map(c => c.id)));
  const byDomain = new Map<string, CompanyRecord[]>();
  for (const c of companies) {
    if (seenIds.has(c.id)) continue;
    const d = normalizeDomain(c.domain);
    if (!d) continue;
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(c);
  }
  for (const [key, group] of byDomain) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => systemIdCount(b) - systemIdCount(a));
    groups.push({ key, matchType: 'domain', companies: group, recommended: sorted[0] });
  }

  return groups;
}
