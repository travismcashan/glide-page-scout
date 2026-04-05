/**
 * Company Resolution Layer
 * Shared identity resolution for all sync functions.
 * One algorithm for finding or creating companies, one name fallback chain, forever.
 */

// ── Types ──

export interface CompanyCandidate {
  user_id: string;
  hubspot_company_id?: string | null;
  harvest_client_id?: string | null;
  freshdesk_company_id?: string | null;
  harvest_client_name?: string | null;
  freshdesk_company_name?: string | null;
  domain?: string | null;
  name?: string | null;
  industry?: string | null;
  employee_count?: string | null;
  annual_revenue?: string | null;
  location?: string | null;
  website_url?: string | null;
  status?: string;
}

export type MatchType =
  | "hubspot_id"
  | "harvest_id"
  | "freshdesk_id"
  | "domain"
  | "name"
  | "created";

export interface ResolvedCompany {
  companyId: string;
  created: boolean;
  matchType: MatchType;
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

// ── Resolution Logging ──

interface ResolutionLog {
  step: MatchType;
  matched: boolean;
  companyId?: string;
  detail?: string;
}

function logResolution(candidateName: string | null | undefined, steps: ResolutionLog[]): void {
  const tag = candidateName || "(unnamed)";
  const matched = steps.find((s) => s.matched);
  if (matched) {
    console.log(
      `[company-resolution] "${tag}" → matched by ${matched.step} (id: ${matched.companyId})` +
        (matched.detail ? ` — ${matched.detail}` : "")
    );
  } else {
    console.log(`[company-resolution] "${tag}" → no match, created new company`);
  }
  for (const s of steps) {
    if (!s.matched) {
      console.log(`[company-resolution]   ✗ ${s.step}${s.detail ? ` — ${s.detail}` : ""}`);
    }
  }
}

// ── Opportunistic External ID Linking ──

const EXTERNAL_ID_FIELDS = [
  "hubspot_company_id",
  "harvest_client_id",
  "freshdesk_company_id",
] as const;

async function opportunisticallyLink(
  supabase: any,
  existing: Record<string, any>,
  candidate: CompanyCandidate
): Promise<void> {
  const updates: Record<string, any> = {};

  for (const field of EXTERNAL_ID_FIELDS) {
    const candidateValue = candidate[field];
    if (candidateValue && !existing[field]) {
      updates[field] = candidateValue;
    }
  }

  // Also link source names if available
  if (candidate.harvest_client_name && !existing.harvest_client_name) {
    updates.harvest_client_name = candidate.harvest_client_name;
  }
  if (candidate.freshdesk_company_name && !existing.freshdesk_company_name) {
    updates.freshdesk_company_name = candidate.freshdesk_company_name;
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    await supabase.from("companies").update(updates).eq("id", existing.id);
  }
}

// ── Main Resolution Function ──

const COMPANY_SELECT =
  "id, name, domain, hubspot_company_id, harvest_client_id, freshdesk_company_id, harvest_client_name, freshdesk_company_name, enrichment_data";

export async function resolveCompany(
  supabase: any,
  candidate: CompanyCandidate
): Promise<ResolvedCompany> {
  const normalizedDomain = normalizeDomain(candidate.domain);
  const steps: ResolutionLog[] = [];

  // ── Step 1: Look up by hubspot_company_id ──
  if (candidate.hubspot_company_id) {
    const { data: byHubspot } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("hubspot_company_id", candidate.hubspot_company_id)
      .maybeSingle();

    if (byHubspot) {
      steps.push({ step: "hubspot_id", matched: true, companyId: byHubspot.id });
      logResolution(candidate.name, steps);
      await opportunisticallyLink(supabase, byHubspot, candidate);
      const nameUpgraded = await maybeUpgradeName(supabase, byHubspot, candidate);
      return { companyId: byHubspot.id, created: false, matchType: "hubspot_id", nameUpgraded };
    }
    steps.push({ step: "hubspot_id", matched: false, detail: `id=${candidate.hubspot_company_id}` });
  } else {
    steps.push({ step: "hubspot_id", matched: false, detail: "no candidate ID" });
  }

  // ── Step 2: Look up by harvest_client_id ──
  if (candidate.harvest_client_id) {
    const { data: byHarvest } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("harvest_client_id", candidate.harvest_client_id)
      .maybeSingle();

    if (byHarvest) {
      steps.push({ step: "harvest_id", matched: true, companyId: byHarvest.id });
      logResolution(candidate.name, steps);
      await opportunisticallyLink(supabase, byHarvest, candidate);
      const nameUpgraded = await maybeUpgradeName(supabase, byHarvest, candidate);
      return { companyId: byHarvest.id, created: false, matchType: "harvest_id", nameUpgraded };
    }
    steps.push({ step: "harvest_id", matched: false, detail: `id=${candidate.harvest_client_id}` });
  } else {
    steps.push({ step: "harvest_id", matched: false, detail: "no candidate ID" });
  }

  // ── Step 3: Look up by freshdesk_company_id ──
  if (candidate.freshdesk_company_id) {
    const { data: byFreshdesk } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("freshdesk_company_id", candidate.freshdesk_company_id)
      .maybeSingle();

    if (byFreshdesk) {
      steps.push({ step: "freshdesk_id", matched: true, companyId: byFreshdesk.id });
      logResolution(candidate.name, steps);
      await opportunisticallyLink(supabase, byFreshdesk, candidate);
      const nameUpgraded = await maybeUpgradeName(supabase, byFreshdesk, candidate);
      return { companyId: byFreshdesk.id, created: false, matchType: "freshdesk_id", nameUpgraded };
    }
    steps.push({ step: "freshdesk_id", matched: false, detail: `id=${candidate.freshdesk_company_id}` });
  } else {
    steps.push({ step: "freshdesk_id", matched: false, detail: "no candidate ID" });
  }

  // ── Step 4: Look up by domain ──
  if (normalizedDomain && normalizedDomain !== "na") {
    const { data: byDomain } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("domain", normalizedDomain)
      .limit(1)
      .maybeSingle();

    if (byDomain) {
      steps.push({ step: "domain", matched: true, companyId: byDomain.id, detail: normalizedDomain });
      logResolution(candidate.name, steps);
      await opportunisticallyLink(supabase, byDomain, candidate);
      const nameUpgraded = await maybeUpgradeName(supabase, byDomain, candidate);
      return { companyId: byDomain.id, created: false, matchType: "domain", nameUpgraded };
    }
    steps.push({ step: "domain", matched: false, detail: normalizedDomain });
  } else {
    steps.push({ step: "domain", matched: false, detail: "no candidate domain" });
  }

  // ── Step 5: Look up by normalized name ──
  if (candidate.name && !isPlaceholderName(candidate.name)) {
    const candidateNormalized = normalizeCompanyName(candidate.name);
    if (candidateNormalized.length >= 2) {
      // Load companies for this user and compare normalized names in JS
      // (SQL can't easily do suffix-stripping + normalization)
      const { data: userCompanies } = await supabase
        .from("companies")
        .select(COMPANY_SELECT)
        .eq("user_id", candidate.user_id)
        .not("name", "is", null);

      if (userCompanies?.length) {
        const nameMatch = userCompanies.find(
          (c: any) => c.name && normalizeCompanyName(c.name) === candidateNormalized
        );

        if (nameMatch) {
          // Domain-conflict guard: if both have domains and they differ, don't merge
          const existingDomain = normalizeDomain(nameMatch.domain);
          if (existingDomain && normalizedDomain && existingDomain !== normalizedDomain) {
            steps.push({
              step: "name",
              matched: false,
              detail: `name "${candidateNormalized}" matched but domains differ (${normalizedDomain} vs ${existingDomain})`,
            });
          } else {
            steps.push({ step: "name", matched: true, companyId: nameMatch.id, detail: `"${candidateNormalized}"` });
            logResolution(candidate.name, steps);
            await opportunisticallyLink(supabase, nameMatch, candidate);
            const nameUpgraded = await maybeUpgradeName(supabase, nameMatch, candidate);
            return { companyId: nameMatch.id, created: false, matchType: "name", nameUpgraded };
          }
        } else {
          steps.push({ step: "name", matched: false, detail: `"${candidateNormalized}" not found` });
        }
      } else {
        steps.push({ step: "name", matched: false, detail: "no user companies to compare" });
      }
    } else {
      steps.push({ step: "name", matched: false, detail: "normalized name too short" });
    }
  } else {
    steps.push({ step: "name", matched: false, detail: "no candidate name or placeholder" });
  }

  // ── Step 6: Create new company ──
  const bestName = resolveCompanyName({
    hubspotName: candidate.name,
    harvestName: candidate.harvest_client_name,
    freshdeskName: candidate.freshdesk_company_name,
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
      harvest_client_id: candidate.harvest_client_id || null,
      freshdesk_company_id: candidate.freshdesk_company_id || null,
      harvest_client_name: candidate.harvest_client_name || null,
      freshdesk_company_name: candidate.freshdesk_company_name || null,
      status: candidate.status || "prospect",
      last_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create company "${bestName}": ${JSON.stringify(error)}`);
  }

  steps.push({ step: "created", matched: false });
  logResolution(candidate.name, steps);

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
