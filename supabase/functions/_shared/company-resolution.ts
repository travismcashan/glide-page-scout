/**
 * Company Resolution Layer
 * Shared identity resolution for all sync functions.
 * One algorithm for finding or creating companies, one name fallback chain, forever.
 */

// ── Types ──

export interface CompanyCandidate {
  user_id: string;
  hubspot_company_id?: string | null;
  domain?: string | null;
  name?: string | null;
  industry?: string | null;
  employee_count?: string | null;
  annual_revenue?: string | null;
  location?: string | null;
  website_url?: string | null;
  status?: string;
}

export interface ResolvedCompany {
  companyId: string;
  created: boolean;
  matchType: "external_id" | "domain" | "created";
  nameUpgraded: boolean;
}

export interface NameSources {
  hubspotName?: string | null;
  existingName?: string | null;
  oceanName?: string | null;
  harvestName?: string | null;
  freshdeskName?: string | null;
  domain?: string | null;
}

// ── Normalization Utilities ──

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.toLowerCase().trim();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  if (!d || !d.includes(".")) return null;
  return d;
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^z_archive_/i, "")
    .replace(
      /[,.]\s*(inc|llc|ltd|corp|co|company|corporation|group|enterprises|lp|llp|pllc|pc)\b\.?/gi,
      ""
    )
    .replace(
      /\s+(inc|llc|ltd|corp|co|company|corporation|group|enterprises|lp|llp|pllc|pc)\s*$/gi,
      ""
    )
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDomainFromText(text: string): string | null {
  const urlMatch = text.match(/https?:\/\/([^\s\/]+)/i);
  if (urlMatch) return normalizeDomain(urlMatch[1]);
  const domainMatch = text.match(/\b([a-z0-9][a-z0-9-]*\.[a-z]{2,})\b/i);
  if (domainMatch) return normalizeDomain(domainMatch[1]);
  return null;
}

// ── Placeholder Detection ──

const PLACEHOLDER_PATTERNS = [
  /^HubSpot Company \d+$/i,
  /^Harvest Client \d+$/i,
  /^Freshdesk Company \d+$/i,
  /^Unknown Company/i,
];

export function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(name.trim()));
}

// ── Name Resolution ──

const COMPOUND_TLDS = [
  ".co.uk", ".co.nz", ".co.za", ".co.in", ".co.jp", ".co.kr",
  ".com.au", ".com.br", ".com.mx", ".com.sg", ".com.tw",
  ".us.com", ".uk.com", ".eu.com",
  ".org.uk", ".org.au", ".net.au",
];

export function deriveNameFromDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  let base = domain.toLowerCase().trim();
  // Strip compound TLDs first (longest match)
  for (const tld of COMPOUND_TLDS) {
    if (base.endsWith(tld)) {
      base = base.slice(0, -tld.length);
      break;
    }
  }
  // Strip simple TLD
  const dotIdx = base.lastIndexOf(".");
  if (dotIdx > 0) {
    base = base.slice(0, dotIdx);
  }
  if (!base) return null;
  // Split on hyphens/underscores, titlecase each word
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function resolveCompanyName(sources: NameSources): string {
  const candidates = [
    sources.hubspotName,
    sources.existingName,
    sources.oceanName,
    sources.harvestName,
    sources.freshdeskName,
  ];
  for (const name of candidates) {
    if (name && !isPlaceholderName(name)) return name;
  }
  // Last resort: derive from domain
  const derived = deriveNameFromDomain(sources.domain);
  if (derived) return derived;
  // Absolute fallback — should never happen if domain is set
  return "Unknown Company";
}

// ── Main Resolution Function ──

export async function resolveCompany(
  supabase: any,
  candidate: CompanyCandidate
): Promise<ResolvedCompany> {
  const normalizedDomain = normalizeDomain(candidate.domain);

  // ── Step 1: Look up by external ID ──
  if (candidate.hubspot_company_id) {
    const { data: byId } = await supabase
      .from("companies")
      .select("id, name, domain, enrichment_data, harvest_client_name, freshdesk_company_name")
      .eq("hubspot_company_id", candidate.hubspot_company_id)
      .maybeSingle();

    if (byId) {
      const nameUpgraded = await maybeUpgradeName(supabase, byId, candidate);
      return { companyId: byId.id, created: false, matchType: "external_id", nameUpgraded };
    }
  }

  // ── Step 2: Look up by domain ──
  if (normalizedDomain && normalizedDomain !== "na") {
    const { data: byDomain } = await supabase
      .from("companies")
      .select("id, name, domain, hubspot_company_id, enrichment_data, harvest_client_name, freshdesk_company_name")
      .eq("domain", normalizedDomain)
      .limit(1)
      .maybeSingle();

    if (byDomain) {
      // Link the hubspot_company_id to this existing company
      const updates: Record<string, any> = {};
      if (candidate.hubspot_company_id && !byDomain.hubspot_company_id) {
        updates.hubspot_company_id = candidate.hubspot_company_id;
      }
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase.from("companies").update(updates).eq("id", byDomain.id);
      }
      const nameUpgraded = await maybeUpgradeName(supabase, byDomain, candidate);
      return { companyId: byDomain.id, created: false, matchType: "domain", nameUpgraded };
    }
  }

  // ── Step 3: Create new company ──
  const bestName = resolveCompanyName({
    hubspotName: candidate.name,
    domain: normalizedDomain,
  });

  const { data: created, error } = await supabase
    .from("companies")
    .insert({
      user_id: candidate.user_id,
      name: bestName,
      domain: normalizedDomain,
      industry: candidate.industry || null,
      employee_count: candidate.employee_count || null,
      annual_revenue: candidate.annual_revenue || null,
      location: candidate.location || null,
      website_url: candidate.website_url || null,
      hubspot_company_id: candidate.hubspot_company_id || null,
      status: candidate.status || "prospect",
      last_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create company "${bestName}": ${JSON.stringify(error)}`);
  }

  return { companyId: created.id, created: true, matchType: "created", nameUpgraded: false };
}

// ── Internal: Opportunistic Name Upgrade ──

async function maybeUpgradeName(
  supabase: any,
  existing: {
    id: string;
    name: string;
    domain?: string | null;
    enrichment_data?: any;
    harvest_client_name?: string | null;
    freshdesk_company_name?: string | null;
  },
  candidate: CompanyCandidate
): Promise<boolean> {
  if (!isPlaceholderName(existing.name)) return false;

  const oceanName = existing.enrichment_data?.ocean?.name;
  const bestName = resolveCompanyName({
    hubspotName: candidate.name,
    existingName: null, // current name is placeholder, skip it
    oceanName,
    harvestName: existing.harvest_client_name,
    freshdeskName: existing.freshdesk_company_name,
    domain: existing.domain || candidate.domain,
  });

  if (bestName === existing.name || isPlaceholderName(bestName)) return false;

  await supabase
    .from("companies")
    .update({ name: bestName, updated_at: new Date().toISOString() })
    .eq("id", existing.id);

  return true;
}
