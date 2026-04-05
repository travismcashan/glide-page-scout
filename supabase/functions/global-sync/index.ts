/**
 * Global Sync Engine
 * Connects Harvest, Asana, HubSpot, and Freshdesk streams into Agency Brain.
 * Cross-references all four sources to build a unified client list.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeDomain, normalizeCompanyName, extractDomainFromText } from "../_shared/company-resolution.ts";
import { resolveUserId } from "../_shared/resolve-user.ts";
import { startSyncRun, completeSyncRun, failSyncRun } from "../_shared/sync-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Harvest API ──

type HarvestClient = { id: number; name: string; isActive: boolean; hasActiveProject: boolean };
type FetchResult<T> = { items: T[]; rawById: Map<string, any> };

async function fetchHarvestData(token: string, accountId: string): Promise<FetchResult<HarvestClient>> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Harvest-Account-Id': accountId,
    'Content-Type': 'application/json',
  };

  // Fetch ALL clients (active + archived)
  const clientMap = new Map<number, HarvestClient>();
  const rawById = new Map<string, any>();
  let page = 1;
  while (page <= 30) {
    const res = await fetch(`https://api.harvestapp.com/v2/clients?per_page=100&page=${page}`, { headers });
    if (!res.ok) { console.error('[global-sync] Harvest clients error:', res.status); break; }
    const data = await res.json();
    for (const c of (data.clients || [])) {
      clientMap.set(c.id, { id: c.id, name: c.name, isActive: c.is_active, hasActiveProject: false });
      rawById.set(String(c.id), c);
    }
    if (!data.next_page) break;
    page++;
  }

  // Fetch ALL projects (active + archived) to mark which clients have active work
  page = 1;
  while (page <= 30) {
    const res = await fetch(`https://api.harvestapp.com/v2/projects?per_page=100&page=${page}`, { headers });
    if (!res.ok) break;
    const data = await res.json();
    for (const p of (data.projects || [])) {
      const clientId = p.client?.id;
      if (clientId) {
        // Add client if we somehow missed it (e.g., project exists for an unlisted client)
        if (!clientMap.has(clientId) && p.client?.name) {
          clientMap.set(clientId, { id: clientId, name: p.client.name, isActive: false, hasActiveProject: false });
        }
        // Mark hasActiveProject only if the project itself is active
        if (clientMap.has(clientId) && p.is_active) {
          clientMap.get(clientId)!.hasActiveProject = true;
        }
      }
    }
    if (!data.next_page) break;
    page++;
  }

  const activeCount = Array.from(clientMap.values()).filter(c => c.isActive).length;
  console.log(`[global-sync] Harvest: ${clientMap.size} clients fetched (${activeCount} active, ${clientMap.size - activeCount} archived)`);
  return { items: Array.from(clientMap.values()), rawById };
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

  // Step 2: Fetch projects for each workspace (active + archived)
  for (const ws of workspaces) {
    console.log(`[global-sync] Asana: fetching projects for workspace "${ws.name}" (${ws.gid})...`);

    // Asana API returns only active projects by default.
    // Archived projects require a separate call with archived=true.
    const passes = [
      { label: 'active', archived: false },
      { label: 'archived', archived: true },
    ];

    for (const pass of passes) {
      const archivedParam = pass.archived ? '&archived=true' : '';
      let url: string | null = `https://app.asana.com/api/1.0/projects?workspace=${ws.gid}&opt_fields=name,notes,archived,custom_fields.name,custom_fields.display_value&limit=100${archivedParam}`;

      while (url) {
        const res = await fetch(url, { headers });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[global-sync] Asana ${pass.label} projects error for workspace ${ws.gid}:`, res.status, errText);
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
  }

  const uniqueGids = new Set(projects.map(p => p.gid));
  console.log(`[global-sync] Asana: ${projects.length} total projects (${uniqueGids.size} unique) fetched across ${workspaces.length} workspaces`);
  return projects;
}

// ── HubSpot API ──

type HubSpotCompany = {
  id: string; name: string; domain: string | null;
  industry: string | null; employees: string | null; revenue: string | null;
  location: string | null; website: string | null;
  lifecycleStage: string | null;
};

async function fetchHubSpotData(token: string): Promise<FetchResult<HubSpotCompany>> {
  const companies: HubSpotCompany[] = [];
  const rawById = new Map<string, any>();
  let after: string | undefined;
  let page = 0;
  const props = 'name,domain,industry,numberofemployees,annualrevenue,city,state,country,website,lifecyclestage';

  // Use list API (not search) to avoid the search endpoint's ~1000 result cap
  while (page < 50) {
    const url = `https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=${props}${after ? `&after=${after}` : ''}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
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
        lifecycleStage: p.lifecyclestage || null,
      });
      rawById.set(c.id, c);
    }

    after = data.paging?.next?.after;
    if (!after) break;
    page++;
    // Rate limit safety: pause 1s every 10 pages (HubSpot allows 100 req/10s)
    if (page % 10 === 0) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[global-sync] HubSpot: ${companies.length} companies fetched (${page + 1} pages)`);
  return { items: companies, rawById };
}

// ── Freshdesk API ──

type FreshdeskCompany = { id: number; name: string; domain: string | null; domains: string[] };

async function fetchFreshdeskData(apiKey: string, domain: string): Promise<FetchResult<FreshdeskCompany>> {
  // Support both custom domains (e.g., support.glidedesign.com) and Freshdesk subdomains (e.g., glide)
  const baseUrl = domain.includes('.') ? `https://${domain}/api/v2` : `https://${domain}.freshdesk.com/api/v2`;
  const headers = {
    'Authorization': `Basic ${btoa(apiKey + ':X')}`,
    'Content-Type': 'application/json',
  };

  const companies: FreshdeskCompany[] = [];
  const rawById = new Map<string, any>();
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
      rawById.set(String(c.id), c);
    }
    if (data.length < 100) break;
    page++;
  }

  console.log(`[global-sync] Freshdesk: ${companies.length} companies fetched`);
  return { items: companies, rawById };
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

// ── Raw Source Data Storage ──

async function storeRawSourceData(
  supabase: any,
  companyId: string,
  userId: string,
  client: UnifiedClient,
  rawMaps: { harvest: Map<string, any>; hubspot: Map<string, any>; freshdesk: Map<string, any> }
) {
  const now = new Date().toISOString();
  const upserts: any[] = [];

  if (client.hubspot) {
    const raw = rawMaps.hubspot.get(client.hubspot.id);
    if (raw) {
      upserts.push({
        user_id: userId,
        company_id: companyId,
        source: 'hubspot',
        source_id: client.hubspot.id,
        raw_data: raw,
        fetched_at: now,
      });
    }
  }
  if (client.harvest) {
    const raw = rawMaps.harvest.get(String(client.harvest.id));
    if (raw) {
      upserts.push({
        user_id: userId,
        company_id: companyId,
        source: 'harvest',
        source_id: String(client.harvest.id),
        raw_data: raw,
        fetched_at: now,
      });
    }
  }
  if (client.freshdesk) {
    const raw = rawMaps.freshdesk.get(String(client.freshdesk.id));
    if (raw) {
      upserts.push({
        user_id: userId,
        company_id: companyId,
        source: 'freshdesk',
        source_id: String(client.freshdesk.id),
        raw_data: raw,
        fetched_at: now,
      });
    }
  }

  for (const row of upserts) {
    const { error } = await supabase
      .from('company_source_data')
      .upsert(row, { onConflict: 'company_id,source' });
    if (error) {
      console.error(`[company_source_data] Failed to upsert ${row.source} for company ${row.company_id}:`, error.message);
    }
  }
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let syncRunId = "";
  let syncRunStartedAt = 0;
  let supabase: any;

  try {
    const { action = 'preview', userId: bodyUserId, sources: sourcesFilter } = await req.json();

    const harvestToken = Deno.env.get('HARVEST_ACCESS_TOKEN');
    const harvestAccountId = Deno.env.get('HARVEST_ACCOUNT_ID');
    const asanaToken = Deno.env.get('ASANA_ACCESS_TOKEN');
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    const freshdeskApiKey = Deno.env.get('FRESHDESK_API_KEY');
    const freshdeskDomain = Deno.env.get('FRESHDESK_DOMAIN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve user_id via shared priority chain (JWT > body > sync_config > fallback)
    const userId = await resolveUserId(supabase, req, bodyUserId);

    const syncRun = await startSyncRun(supabase, "global-sync");
    syncRunId = syncRun.id;
    syncRunStartedAt = syncRun.startedAt;

    // Fetch from sources — supports filtering to a single source via `sources` param
    const sf = sourcesFilter as string[] | undefined;
    const fetchHS = !sf || sf.includes('hubspot');
    const fetchHV = !sf || sf.includes('harvest');
    const fetchFD = !sf || sf.includes('freshdesk');
    const fetchAsana = (!sf || sf.includes('asana')) && action !== 'preview';

    console.log(`[global-sync] Fetching: HS=${fetchHS} HV=${fetchHV} FD=${fetchFD} Asana=${fetchAsana}`);
    const emptyResult = <T,>(): FetchResult<T> => ({ items: [], rawById: new Map() });
    const [harvestResult, asanaProjects, hubspotResult, freshdeskResult] = await Promise.all([
      (fetchHV && harvestToken && harvestAccountId) ? fetchHarvestData(harvestToken, harvestAccountId) : Promise.resolve(emptyResult<HarvestClient>()),
      (fetchAsana && asanaToken) ? fetchAsanaData(asanaToken) : Promise.resolve([]),
      (fetchHS && hubspotToken) ? fetchHubSpotData(hubspotToken) : Promise.resolve(emptyResult<HubSpotCompany>()),
      (fetchFD && freshdeskApiKey && freshdeskDomain) ? fetchFreshdeskData(freshdeskApiKey, freshdeskDomain) : Promise.resolve(emptyResult<FreshdeskCompany>()),
    ]);
    const harvestClients = harvestResult.items;
    const hubspotCompanies = hubspotResult.items;
    const freshdeskCompanies = freshdeskResult.items;
    const rawMaps = {
      harvest: harvestResult.rawById,
      hubspot: hubspotResult.rawById,
      freshdesk: freshdeskResult.rawById,
    };

    // Fetch existing companies (paginate to avoid Supabase 1000-row default limit)
    const allExisting: any[] = [];
    const PAGE_SIZE = 1000;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: batch } = await supabase
        .from('companies')
        .select('id, name, domain, hubspot_company_id, harvest_client_id, harvest_client_name, asana_project_gids, freshdesk_company_id, freshdesk_company_name, status')
        .range(offset, offset + PAGE_SIZE - 1);
      if (!batch || batch.length === 0) break;
      allExisting.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
    const existingCompanies = allExisting;

    console.log(`[global-sync] Existing companies: ${existingCompanies.length}`);

    // Cross-reference
    const unified = crossReference(
      harvestClients,
      asanaProjects,
      hubspotCompanies,
      freshdeskCompanies,
      existingCompanies
    );

    console.log(`[global-sync] Unified clients: ${unified.length} (${unified.filter(u => u.action === 'create').length} new, ${unified.filter(u => u.action === 'update').length} update)`);

    // Build summary
    const summary = {
      sources: {
        harvest: harvestClients.length,
        asana: asanaProjects.length,
        hubspot: hubspotCompanies.length,
        freshdesk: freshdeskCompanies.length,
        existing: (existingCompanies).length,
      },
      matched: { domain: 0, name: 0 },
      created: 0,
      updated: 0,
      skipped: 0,
      details: [] as any[],
    };

    if (action === 'sync') {
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

            // Store raw source data
            await storeRawSourceData(supabase, client.existingId, userId, client, rawMaps);

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

            const { data: inserted } = await supabase.from('companies').insert(newCompany).select('id').single();
            if (inserted) {
              await storeRawSourceData(supabase, inserted.id, userId, client, rawMaps);
            }
            summary.created++;
          }

          summary.details.push({
            name: client.name,
            domain: client.domain,
            matchType: client.matchType,
            sources: sourceList,
            action: client.existingId ? 'updated' : 'created',
            hasActiveProject: client.hasActiveProject,
            harvestIsActive: client.harvest?.isActive ?? null,
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
          harvestIsActive: client.harvest?.isActive ?? null,
          hubspotId: client.hubspot?.id || null,
          hubspotName: client.hubspot?.name || null,
          harvestId: client.harvest ? String(client.harvest.id) : null,
          harvestName: client.harvest?.name || null,
          freshdeskId: client.freshdesk ? String(client.freshdesk.id) : null,
          freshdeskName: client.freshdesk?.name || null,
        });
      }
    }

    console.log(`[global-sync] Complete: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped`);

    await completeSyncRun(supabase, syncRunId, {
      recordsUpserted: summary.created + summary.updated,
      recordsSkipped: summary.skipped,
      metadata: { action, sources: summary.sources },
    }, syncRunStartedAt);

    return new Response(JSON.stringify({
      success: true,
      action,
      summary,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[global-sync] Error:', error);
    if (syncRunId && supabase) {
      try { await failSyncRun(supabase, syncRunId, error); } catch {}
    }
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
