/**
 * Global Sync Engine
 * Connects Harvest, Asana, HubSpot, and Freshdesk streams into Agency Brain.
 * Cross-references all four sources to build a unified client list.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Normalization Utilities ──

function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.toLowerCase().trim();
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  if (!d || !d.includes('.')) return null;
  return d;
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.]\\s*(inc|llc|ltd|corp|co|company|corporation|group|enterprises|lp|llp|pllc|pc)\b\.?/gi, '')
    .replace(/\s+(inc|llc|ltd|corp|co|company|corporation|group|enterprises|lp|llp|pllc|pc)\s*$/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDomainFromText(text: string): string | null {
  // Match URLs or domain-like patterns
  const urlMatch = text.match(/https?:\/\/([^\s\/]+)/i);
  if (urlMatch) return normalizeDomain(urlMatch[1]);
  const domainMatch = text.match(/\b([a-z0-9][a-z0-9-]*\.[a-z]{2,})\b/i);
  if (domainMatch) return normalizeDomain(domainMatch[1]);
  return null;
}

// ── Harvest API ──

type HarvestClient = { id: number; name: string; isActive: boolean; hasActiveProject: boolean };

async function fetchHarvestData(token: string, accountId: string): Promise<HarvestClient[]> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Harvest-Account-Id': accountId,
    'Content-Type': 'application/json',
  };

  // Fetch clients
  const clientMap = new Map<number, HarvestClient>();
  let page = 1;
  while (page <= 10) {
    const res = await fetch(`https://api.harvestapp.com/v2/clients?is_active=true&per_page=100&page=${page}`, { headers });
    if (!res.ok) { console.error('[global-sync] Harvest clients error:', res.status); break; }
    const data = await res.json();
    for (const c of (data.clients || [])) {
      clientMap.set(c.id, { id: c.id, name: c.name, isActive: c.is_active, hasActiveProject: false });
    }
    if (!data.next_page) break;
    page++;
  }

  // Fetch active projects to mark which clients have active work
  page = 1;
  while (page <= 10) {
    const res = await fetch(`https://api.harvestapp.com/v2/projects?is_active=true&per_page=100&page=${page}`, { headers });
    if (!res.ok) break;
    const data = await res.json();
    for (const p of (data.projects || [])) {
      const clientId = p.client?.id;
      if (clientId && clientMap.has(clientId)) {
        clientMap.get(clientId)!.hasActiveProject = true;
      }
    }
    if (!data.next_page) break;
    page++;
  }

  console.log(`[global-sync] Harvest: ${clientMap.size} clients fetched`);
  return Array.from(clientMap.values());
}

// ── Asana API ──

type AsanaProject = { gid: string; name: string; domain: string | null; clientName: string | null };

async function fetchAsanaData(token: string): Promise<AsanaProject[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const projects: AsanaProject[] = [];

  // Step 1: Fetch all workspaces
  console.log('[global-sync] Asana: fetching workspaces...');
  const wsRes = await fetch('https://app.asana.com/api/1.0/workspaces', { headers });
  if (!wsRes.ok) {
    console.error('[global-sync] Asana workspaces error:', wsRes.status, await wsRes.text());
    return [];
  }
  const wsData = await wsRes.json();
  const workspaces = wsData.data || [];
  console.log(`[global-sync] Asana: found ${workspaces.length} workspaces`);

  // Step 2: Fetch projects for each workspace
  for (const ws of workspaces) {
    console.log(`[global-sync] Asana: fetching projects for workspace "${ws.name}" (${ws.gid})...`);
    let url: string | null = `https://app.asana.com/api/1.0/projects?workspace=${ws.gid}&opt_fields=name,notes,custom_fields.name,custom_fields.display_value&limit=100`;

    while (url) {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[global-sync] Asana projects error for workspace ${ws.gid}:`, res.status, errText);
        break;
      }
      const data = await res.json();

      for (const p of (data.data || [])) {
        // Try to extract domain from custom fields
        let domain: string | null = null;
        for (const cf of (p.custom_fields || [])) {
          const fieldName = (cf.name || '').toLowerCase();
          if (['url', 'domain', 'website', 'client url', 'client domain', 'site'].includes(fieldName)) {
            domain = normalizeDomain(cf.display_value) || extractDomainFromText(cf.display_value || '');
            if (domain) break;
          }
        }

        // Try notes for domain
        if (!domain && p.notes) {
          domain = extractDomainFromText(p.notes);
        }

        // Parse client name from project name ("ClientName - Project Description" or "ClientName: ...")
        let clientName: string | null = null;
        const separators = [' - ', ' — ', ' – ', ': ', ' | '];
        for (const sep of separators) {
          if (p.name.includes(sep)) {
            clientName = p.name.split(sep)[0].trim();
            break;
          }
        }

        // If project name looks like a domain, use it
        if (!domain && p.name) {
          const possibleDomain = extractDomainFromText(p.name);
          if (possibleDomain) domain = possibleDomain;
        }

        projects.push({ gid: p.gid, name: p.name, domain, clientName: clientName || p.name });
      }

      url = data.next_page?.uri || null;
    }
  }

  console.log(`[global-sync] Asana: ${projects.length} total projects fetched across ${workspaces.length} workspaces`);
  return projects;
}

// ── HubSpot API ──

type HubSpotCompany = {
  id: string; name: string; domain: string | null;
  industry: string | null; employees: string | null; revenue: string | null;
  location: string | null; website: string | null;
};

async function fetchHubSpotData(token: string): Promise<HubSpotCompany[]> {
  const companies: HubSpotCompany[] = [];
  let after: string | undefined;
  let page = 0;

  while (page < 20) {
    const body: any = {
      properties: ['name', 'domain', 'industry', 'numberofemployees', 'annualrevenue', 'city', 'state', 'country', 'website'],
      limit: 100,
    };
    if (after) body.after = after;

    const res = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) { console.error('[global-sync] HubSpot error:', res.status); break; }
    const data = await res.json();

    for (const c of (data.results || [])) {
      const p = c.properties || {};
      const location = [p.city, p.state, p.country].filter(Boolean).join(', ') || null;
      companies.push({
        id: c.id,
        name: p.name || '',
        domain: normalizeDomain(p.domain),
        industry: p.industry || null,
        employees: p.numberofemployees || null,
        revenue: p.annualrevenue || null,
        location,
        website: p.website || null,
      });
    }

    after = data.paging?.next?.after;
    if (!after) break;
    page++;
  }

  console.log(`[global-sync] HubSpot: ${companies.length} companies fetched`);
  return companies;
}

// ── Freshdesk API ──

type FreshdeskCompany = { id: number; name: string; domain: string | null; domains: string[] };

async function fetchFreshdeskData(apiKey: string, domain: string): Promise<FreshdeskCompany[]> {
  const baseUrl = `https://${domain}.freshdesk.com/api/v2`;
  const headers = {
    'Authorization': `Basic ${btoa(apiKey + ':X')}`,
    'Content-Type': 'application/json',
  };

  const companies: FreshdeskCompany[] = [];
  let page = 1;
  while (page <= 300) {
    const res = await fetch(`${baseUrl}/companies?per_page=100&page=${page}`, { headers });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
      console.log(`[global-sync] Freshdesk rate limited, waiting ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }
    if (!res.ok) { console.error('[global-sync] Freshdesk companies error:', res.status); break; }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    for (const c of data) {
      companies.push({
        id: c.id,
        name: c.name || '',
        domain: normalizeDomain(c.domains?.[0]) || null,
        domains: (c.domains || []).map((d: string) => normalizeDomain(d)).filter(Boolean),
      });
    }
    if (data.length < 100) break;
    page++;
  }

  console.log(`[global-sync] Freshdesk: ${companies.length} companies fetched`);
  return companies;
}

// ── Cross-Reference Engine ──

type UnifiedClient = {
  name: string;
  domain: string | null;
  matchType: 'domain' | 'name' | 'new';
  existingId: string | null;
  harvest: HarvestClient | null;
  hubspot: HubSpotCompany | null;
  freshdesk: FreshdeskCompany | null;
  asanaGids: string[];
  hasActiveProject: boolean;
  action: 'create' | 'update' | 'skip';
};

function crossReference(
  harvestClients: HarvestClient[],
  asanaProjects: AsanaProject[],
  hubspotCompanies: HubSpotCompany[],
  freshdeskCompanies: FreshdeskCompany[],
  existingCompanies: any[]
): UnifiedClient[] {
  const unified = new Map<string, UnifiedClient>();

  // Build lookup maps for existing companies
  const existingByDomain = new Map<string, any>();
  const existingByName = new Map<string, any>();
  const existingByHarvestId = new Map<string, any>();
  const existingByHubspotId = new Map<string, any>();

  const existingByFreshdeskId = new Map<string, any>();

  for (const c of existingCompanies) {
    const d = normalizeDomain(c.domain);
    if (d) existingByDomain.set(d, c);
    existingByName.set(normalizeCompanyName(c.name), c);
    if (c.harvest_client_id) existingByHarvestId.set(c.harvest_client_id, c);
    if (c.hubspot_company_id) existingByHubspotId.set(c.hubspot_company_id, c);
    if (c.freshdesk_company_id) existingByFreshdeskId.set(c.freshdesk_company_id, c);
  }

  // Helper to find or create a unified entry
  function getOrCreate(key: string, name: string, domain: string | null, matchType: 'domain' | 'name' | 'new', existing: any | null): UnifiedClient {
    if (!unified.has(key)) {
      unified.set(key, {
        name,
        domain,
        matchType,
        existingId: existing?.id || null,
        harvest: null,
        hubspot: null,
        freshdesk: null,
        asanaGids: [],
        hasActiveProject: false,
        action: existing ? 'update' : 'create',
      });
    }
    return unified.get(key)!;
  }

  // Pass 1: HubSpot companies (they have the best domain data)
  for (const hs of hubspotCompanies) {
    if (!hs.name) continue;
    const domain = hs.domain;
    let existing = domain ? existingByDomain.get(domain) : null;
    if (!existing) existing = existingByHubspotId.get(hs.id);
    if (!existing) existing = existingByName.get(normalizeCompanyName(hs.name));

    const key = domain || `name:${normalizeCompanyName(hs.name)}`;
    const entry = getOrCreate(key, hs.name, domain, domain ? 'domain' : 'name', existing);
    entry.hubspot = hs;
    if (domain && !entry.domain) entry.domain = domain;
  }

  // Pass 2: Harvest clients
  for (const hc of harvestClients) {
    // Check if already matched by existing company
    let existing = existingByHarvestId.get(String(hc.id));
    let matchKey: string | null = null;

    // Try domain extraction from name
    const possibleDomain = extractDomainFromText(hc.name);
    if (possibleDomain && unified.has(possibleDomain)) {
      matchKey = possibleDomain;
    } else if (possibleDomain && existingByDomain.has(possibleDomain)) {
      existing = existingByDomain.get(possibleDomain);
      matchKey = possibleDomain;
    }

    // Try name match
    if (!matchKey) {
      const normName = normalizeCompanyName(hc.name);
      for (const [key, entry] of unified) {
        if (normalizeCompanyName(entry.name) === normName) {
          matchKey = key;
          break;
        }
      }
      if (!matchKey && existingByName.has(normName)) {
        existing = existingByName.get(normName);
      }
    }

    if (!matchKey) matchKey = `harvest:${hc.id}`;

    const entry = getOrCreate(
      matchKey,
      hc.name,
      possibleDomain || null,
      possibleDomain ? 'domain' : (matchKey.startsWith('harvest:') ? 'new' : 'name'),
      existing
    );
    entry.harvest = hc;
    entry.hasActiveProject = entry.hasActiveProject || hc.hasActiveProject;
  }

  // Pass 3: Asana projects
  for (const ap of asanaProjects) {
    let matched = false;

    // Try domain match
    if (ap.domain) {
      for (const [key, entry] of unified) {
        if (entry.domain === ap.domain) {
          entry.asanaGids.push(ap.gid);
          matched = true;
          break;
        }
      }
    }

    // Try client name match
    if (!matched && ap.clientName) {
      const normName = normalizeCompanyName(ap.clientName);
      for (const [key, entry] of unified) {
        if (normalizeCompanyName(entry.name) === normName) {
          entry.asanaGids.push(ap.gid);
          matched = true;
          break;
        }
      }
    }

    // Unmatched Asana projects don't create companies (too many false positives from internal projects)
  }

  // Pass 4: Freshdesk companies
  for (const fd of freshdeskCompanies) {
    if (!fd.name) continue;

    let existing = existingByFreshdeskId.get(String(fd.id));
    let matchKey: string | null = null;

    // Try domain match (Freshdesk can have multiple domains)
    for (const d of fd.domains) {
      if (d && unified.has(d)) { matchKey = d; break; }
      if (d && existingByDomain.has(d)) { existing = existingByDomain.get(d); matchKey = d; break; }
    }

    // Try name match
    if (!matchKey) {
      const normName = normalizeCompanyName(fd.name);
      for (const [key, entry] of unified) {
        if (normalizeCompanyName(entry.name) === normName) {
          matchKey = key;
          break;
        }
      }
      if (!matchKey && existingByName.has(normName)) {
        existing = existingByName.get(normName);
      }
    }

    if (!matchKey) matchKey = `freshdesk:${fd.id}`;

    const entry = getOrCreate(
      matchKey,
      fd.name,
      fd.domain,
      fd.domain ? 'domain' : (matchKey.startsWith('freshdesk:') ? 'new' : 'name'),
      existing
    );
    entry.freshdesk = fd;
  }

  return Array.from(unified.values());
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action = 'preview', userId } = await req.json();

    const harvestToken = Deno.env.get('HARVEST_ACCESS_TOKEN');
    const harvestAccountId = Deno.env.get('HARVEST_ACCOUNT_ID');
    const asanaToken = Deno.env.get('ASANA_ACCESS_TOKEN');
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    const freshdeskApiKey = Deno.env.get('FRESHDESK_API_KEY');
    const freshdeskDomain = Deno.env.get('FRESHDESK_DOMAIN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch from all sources in parallel
    console.log('[global-sync] Starting parallel fetch from all streams...');
    const [harvestClients, asanaProjects, hubspotCompanies, freshdeskCompanies] = await Promise.all([
      (harvestToken && harvestAccountId) ? fetchHarvestData(harvestToken, harvestAccountId) : Promise.resolve([]),
      asanaToken ? fetchAsanaData(asanaToken) : Promise.resolve([]),
      hubspotToken ? fetchHubSpotData(hubspotToken) : Promise.resolve([]),
      (freshdeskApiKey && freshdeskDomain) ? fetchFreshdeskData(freshdeskApiKey, freshdeskDomain) : Promise.resolve([]),
    ]);

    // Fetch existing companies
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('id, name, domain, hubspot_company_id, harvest_client_id, harvest_client_name, asana_project_gids, freshdesk_company_id, freshdesk_company_name, status');

    console.log(`[global-sync] Existing companies: ${(existingCompanies || []).length}`);

    // Cross-reference
    const unified = crossReference(
      harvestClients,
      asanaProjects,
      hubspotCompanies,
      freshdeskCompanies,
      existingCompanies || []
    );

    console.log(`[global-sync] Unified clients: ${unified.length} (${unified.filter(u => u.action === 'create').length} new, ${unified.filter(u => u.action === 'update').length} update)`);

    // Build summary
    const summary = {
      sources: {
        harvest: harvestClients.length,
        asana: asanaProjects.length,
        hubspot: hubspotCompanies.length,
        freshdesk: freshdeskCompanies.length,
        existing: (existingCompanies || []).length,
      },
      matched: { domain: 0, name: 0 },
      created: 0,
      updated: 0,
      skipped: 0,
      details: [] as any[],
    };

    if (action === 'sync' && userId) {
      // Upsert to companies table
      for (const client of unified) {
        const sourceList: string[] = [];
        if (client.harvest) sourceList.push('Harvest');
        if (client.hubspot) sourceList.push('HubSpot');
        if (client.freshdesk) sourceList.push('Freshdesk');
        if (client.asanaGids.length > 0) sourceList.push('Asana');

        try {
          if (client.existingId) {
            // Update existing
            const updates: any = {
              last_synced_at: new Date().toISOString(),
            };
            if (client.harvest) {
              updates.harvest_client_id = String(client.harvest.id);
              updates.harvest_client_name = client.harvest.name;
            }
            if (client.hubspot) {
              updates.hubspot_company_id = client.hubspot.id;
              if (client.hubspot.industry) updates.industry = client.hubspot.industry;
              if (client.hubspot.employees) updates.employee_count = client.hubspot.employees;
              if (client.hubspot.revenue) updates.annual_revenue = client.hubspot.revenue;
              if (client.hubspot.location) updates.location = client.hubspot.location;
              if (client.hubspot.domain) updates.domain = client.hubspot.domain;
              if (client.hubspot.website) updates.website_url = client.hubspot.website;
            }
            if (client.freshdesk) {
              updates.freshdesk_company_id = String(client.freshdesk.id);
              updates.freshdesk_company_name = client.freshdesk.name;
            }
            if (client.asanaGids.length > 0) {
              updates.asana_project_gids = client.asanaGids;
            }
            // Upgrade prospect → active if they have active Harvest projects
            if (client.hasActiveProject) {
              updates.status = 'active';
            }

            await supabase.from('companies').update(updates).eq('id', client.existingId);
            summary.updated++;
            if (client.matchType === 'domain') summary.matched.domain++;
            else if (client.matchType === 'name') summary.matched.name++;
          } else {
            // Create new
            const newCompany: any = {
              user_id: userId,
              name: client.hubspot?.name || client.harvest?.name || client.name,
              domain: client.domain || client.hubspot?.domain || null,
              status: client.hasActiveProject ? 'active' : 'prospect',
              last_synced_at: new Date().toISOString(),
            };
            if (client.harvest) {
              newCompany.harvest_client_id = String(client.harvest.id);
              newCompany.harvest_client_name = client.harvest.name;
            }
            if (client.hubspot) {
              newCompany.hubspot_company_id = client.hubspot.id;
              newCompany.industry = client.hubspot.industry;
              newCompany.employee_count = client.hubspot.employees;
              newCompany.annual_revenue = client.hubspot.revenue;
              newCompany.location = client.hubspot.location;
              newCompany.website_url = client.hubspot.website;
            }
            if (client.freshdesk) {
              newCompany.freshdesk_company_id = String(client.freshdesk.id);
              newCompany.freshdesk_company_name = client.freshdesk.name;
            }
            if (client.asanaGids.length > 0) {
              newCompany.asana_project_gids = client.asanaGids;
            }

            await supabase.from('companies').insert(newCompany);
            summary.created++;
          }

          summary.details.push({
            name: client.name,
            domain: client.domain,
            matchType: client.matchType,
            sources: sourceList,
            action: client.existingId ? 'updated' : 'created',
            hasActiveProject: client.hasActiveProject,
          });
        } catch (err: any) {
          console.error(`[global-sync] Error processing ${client.name}:`, err.message);
          summary.skipped++;
        }
      }
    } else {
      // Preview mode — just build details
      for (const client of unified) {
        const sourceList: string[] = [];
        if (client.harvest) sourceList.push('Harvest');
        if (client.hubspot) sourceList.push('HubSpot');
        if (client.freshdesk) sourceList.push('Freshdesk');
        if (client.asanaGids.length > 0) sourceList.push('Asana');

        if (client.existingId) {
          summary.updated++;
          if (client.matchType === 'domain') summary.matched.domain++;
          else if (client.matchType === 'name') summary.matched.name++;
        } else {
          summary.created++;
        }

        summary.details.push({
          name: client.name,
          domain: client.domain,
          matchType: client.matchType,
          sources: sourceList,
          action: client.existingId ? 'would_update' : 'would_create',
          hasActiveProject: client.hasActiveProject,
        });
      }
    }

    console.log(`[global-sync] Complete: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped`);

    return new Response(JSON.stringify({
      success: true,
      action,
      summary,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[global-sync] Error:', error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
