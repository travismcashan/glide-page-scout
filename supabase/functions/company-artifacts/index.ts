/**
 * Company Artifacts — On-demand fetching from external APIs
 * Fetches tickets, deals, engagements, projects, time_entries, invoices
 * for a specific company without storing in the database.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type ArtifactType = 'tickets' | 'deals' | 'engagements' | 'invoices' | 'projects' | 'time_entries';

const VALID_ARTIFACTS: ArtifactType[] = ['tickets', 'deals', 'engagements', 'invoices', 'projects', 'time_entries'];

// ── HubSpot helpers ──────────────────────────────────────────────────────

async function hubspotFetch(path: string, token: string, method = 'GET', body?: any) {
  const opts: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.hubapi.com${path}`, opts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HubSpot API error [${res.status}]: ${errText.substring(0, 500)}`);
  }
  return res.json();
}

async function fetchDeals(hubspotCompanyId: string, token: string) {
  // Get deal associations for this company
  const assocRes = await hubspotFetch(
    `/crm/v4/objects/companies/${hubspotCompanyId}/associations/deals`,
    token,
  );
  const dealIds = (assocRes.results || []).map((r: any) => r.toObjectId);
  if (dealIds.length === 0) return [];

  // Batch-read deal details
  const batchRes = await hubspotFetch('/crm/v3/objects/deals/batch/read', token, 'POST', {
    inputs: dealIds.map((id: string) => ({ id })),
    properties: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'hs_deal_stage_probability', 'createdate', 'hs_lastmodifieddate'],
  });

  return (batchRes.results || []).map((d: any) => {
    const stage = d.properties.dealstage || '';
    // Derive status from stage name for UI compatibility
    const status = stage.includes('closedwon') ? 'won'
      : stage.includes('closedlost') ? 'lost'
      : 'open';
    return {
      id: d.id,
      name: d.properties.dealname || 'Untitled Deal',
      amount: d.properties.amount ? parseFloat(d.properties.amount) : null,
      stage,
      pipeline: d.properties.pipeline || null,
      close_date: d.properties.closedate || null,
      status,
      probability: d.properties.hs_deal_stage_probability || null,
      created_at: d.properties.createdate || null,
      updated_at: d.properties.hs_lastmodifieddate || null,
    };
  });
}

async function fetchEngagements(hubspotCompanyId: string, token: string) {
  const engagementTypes = ['emails', 'calls', 'meetings', 'notes', 'tasks'];
  const all: any[] = [];

  for (const type of engagementTypes) {
    try {
      const assocRes = await hubspotFetch(
        `/crm/v4/objects/companies/${hubspotCompanyId}/associations/${type}`,
        token,
      );
      const objectIds = (assocRes.results || []).map((r: any) => r.toObjectId);
      if (objectIds.length === 0) continue;

      // Batch read (max 100 per request)
      const batches = [];
      for (let i = 0; i < objectIds.length; i += 100) {
        batches.push(objectIds.slice(i, i + 100));
      }

      const propertyMap: Record<string, string[]> = {
        emails: ['hs_email_subject', 'hs_email_direction', 'hs_email_text', 'hs_timestamp'],
        calls: ['hs_call_title', 'hs_call_direction', 'hs_call_body', 'hs_timestamp', 'hs_call_duration'],
        meetings: ['hs_meeting_title', 'hs_meeting_body', 'hs_timestamp', 'hs_meeting_start_time', 'hs_meeting_end_time'],
        notes: ['hs_note_body', 'hs_timestamp'],
        tasks: ['hs_task_subject', 'hs_task_body', 'hs_task_status', 'hs_timestamp'],
      };

      for (const batch of batches) {
        const batchRes = await hubspotFetch(`/crm/v3/objects/${type}/batch/read`, token, 'POST', {
          inputs: batch.map((id: string) => ({ id })),
          properties: propertyMap[type] || ['hs_timestamp'],
        });

        for (const obj of (batchRes.results || [])) {
          const p = obj.properties;
          const engType = type.replace(/s$/, ''); // emails -> email
          all.push({
            id: obj.id,
            engagement_type: engType,
            subject: p.hs_email_subject || p.hs_call_title || p.hs_meeting_title || p.hs_task_subject || null,
            body_preview: (p.hs_email_text || p.hs_call_body || p.hs_meeting_body || p.hs_note_body || p.hs_task_body || '').substring(0, 500) || null,
            direction: p.hs_email_direction || p.hs_call_direction || null,
            occurred_at: p.hs_timestamp || null,
            status: p.hs_task_status || null,
            duration: p.hs_call_duration || null,
          });
        }
      }
    } catch (err) {
      console.warn(`[company-artifacts] Failed to fetch ${type} engagements:`, err);
    }
  }

  // Sort by occurred_at descending
  all.sort((a, b) => {
    const dateA = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
    const dateB = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
    return dateB - dateA;
  });

  return all;
}

// ── Harvest helpers ──────────────────────────────────────────────────────

function getHarvestHeaders() {
  const accessToken = Deno.env.get('HARVEST_ACCESS_TOKEN');
  const accountId = Deno.env.get('HARVEST_ACCOUNT_ID');
  if (!accessToken || !accountId) return null;
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Harvest-Account-Id': accountId,
    'Content-Type': 'application/json',
    'User-Agent': 'Ascend (support@glidecreative.com)',
  };
}

async function harvestFetchAllPages(url: string, headers: Record<string, string>, collectionKey: string, maxPages = 20): Promise<any[]> {
  const all: any[] = [];
  let nextPage: string | null = url;
  let page = 0;

  while (nextPage && page < maxPages) {
    const res = await fetch(nextPage, { headers });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Harvest API error [${res.status}]: ${err.substring(0, 300)}`);
    }
    const data = await res.json();
    const items = data[collectionKey] || [];
    all.push(...items);

    // Harvest pagination uses links.next
    nextPage = data.links?.next || null;
    page++;
  }

  return all;
}

async function fetchProjects(harvestClientId: string, headers: Record<string, string>) {
  const projects = await harvestFetchAllPages(
    `https://api.harvestapp.com/v2/projects?client_id=${harvestClientId}&per_page=100`,
    headers,
    'projects',
  );

  return projects.map((p: any) => ({
    id: p.id,
    name: p.name,
    code: p.code || null,
    is_active: p.is_active,
    is_billable: p.is_billable,
    budget: p.budget,
    budget_by: p.budget_by,
    hourly_rate: p.hourly_rate,
    fee: p.fee,
    starts_on: p.starts_on,
    ends_on: p.ends_on,
    notes: p.notes || null,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
}

async function fetchTimeEntries(harvestClientId: string, headers: Record<string, string>) {
  // Fetch last 2 years of time entries
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const fromDate = twoYearsAgo.toISOString().split('T')[0];

  const entries = await harvestFetchAllPages(
    `https://api.harvestapp.com/v2/time_entries?client_id=${harvestClientId}&from=${fromDate}&per_page=100`,
    headers,
    'time_entries',
    30, // up to 3000 entries
  );

  return entries.map((t: any) => ({
    id: t.id,
    spent_date: t.spent_date,
    hours: t.hours,
    billable: t.billable,
    notes: t.notes || null,
    project_name: t.project?.name || null,
    project_id: t.project?.id || null,
    task_name: t.task?.name || null,
    harvest_user_name: t.user?.name || null,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));
}

async function fetchInvoices(harvestClientId: string, headers: Record<string, string>) {
  const invoices = await harvestFetchAllPages(
    `https://api.harvestapp.com/v2/invoices?client_id=${harvestClientId}&per_page=100`,
    headers,
    'invoices',
  );

  return invoices.map((inv: any) => ({
    id: inv.id,
    number: inv.number,
    amount: inv.amount,
    due_amount: inv.due_amount,
    state: inv.state,
    subject: inv.subject || null,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    paid_date: inv.paid_date,
    notes: inv.notes || null,
    period_start: inv.period_start,
    period_end: inv.period_end,
    created_at: inv.created_at,
    updated_at: inv.updated_at,
  }));
}

// ── Freshdesk helpers ────────────────────────────────────────────────────

function getFreshdeskConfig() {
  const apiKey = Deno.env.get('FRESHDESK_API_KEY');
  const domain = Deno.env.get('FRESHDESK_DOMAIN');
  if (!apiKey || !domain) return null;
  return {
    baseUrl: domain.includes('.') ? `https://${domain}/api/v2` : `https://${domain}.freshdesk.com/api/v2`,
    headers: {
      'Authorization': `Basic ${btoa(apiKey + ':X')}`,
      'Content-Type': 'application/json',
    },
  };
}

async function freshdeskFetchWithRetry(url: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
    console.log(`[company-artifacts] Freshdesk rate limited, waiting ${retryAfter}s...`);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return freshdeskFetchWithRetry(url, headers);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Freshdesk API error [${res.status}]: ${errText.substring(0, 300)}`);
  }
  return res.json();
}

async function fetchTickets(freshdeskCompanyId: string, config: { baseUrl: string; headers: Record<string, string> }) {
  const statusLabels: Record<number, string> = { 2: 'Open', 3: 'Pending', 4: 'Resolved', 5: 'Closed' };
  const priorityLabels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Urgent' };
  const sourceLabels: Record<number, string> = { 1: 'Email', 2: 'Portal', 3: 'Phone', 7: 'Chat', 9: 'Feedback Widget', 10: 'Outbound Email' };

  // Use direct ticket list with company_id filter (search API no longer supports company_id field)
  const allTickets: any[] = [];
  let page = 1;
  const maxPages = 20; // 100 per page × 20 pages = 2000 tickets max

  while (page <= maxPages) {
    const url = `${config.baseUrl}/tickets?company_id=${freshdeskCompanyId}&per_page=100&page=${page}&include=requester,stats`;
    const data = await freshdeskFetchWithRetry(url, config.headers);
    const results = Array.isArray(data) ? data : [];
    allTickets.push(...results);
    if (results.length < 100) break;
    page++;
  }

  return mapTickets(allTickets, statusLabels, priorityLabels, sourceLabels);
}

function mapTickets(
  tickets: any[],
  statusLabels: Record<number, string>,
  priorityLabels: Record<number, string>,
  sourceLabels: Record<number, string>,
) {
  return (tickets || []).map((t: any) => ({
    id: t.id,
    subject: t.subject || null,
    status: t.status,
    status_label: statusLabels[t.status] || `Status ${t.status}`,
    priority: t.priority,
    priority_label: priorityLabels[t.priority] || null,
    source_label: sourceLabels[t.source] || null,
    ticket_type: t.type || null,
    requester_name: t.requester?.name || null,
    requester_email: t.requester?.email || null,
    description_text: t.description_text?.substring(0, 500) || null,
    created_date: t.created_at,
    updated_date: t.updated_at,
    resolved_at: t.stats?.resolved_at || null,
    closed_at: t.stats?.closed_at || null,
    first_responded_at: t.stats?.first_responded_at || null,
    tags: t.tags || [],
  }));
}

// ── Main handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, artifact } = await req.json();

    if (!companyId || !artifact) {
      return new Response(JSON.stringify({ error: 'companyId and artifact are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!VALID_ARTIFACTS.includes(artifact)) {
      return new Response(JSON.stringify({ error: `Invalid artifact type. Must be one of: ${VALID_ARTIFACTS.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[company-artifacts] Fetching ${artifact} for company ${companyId}`);

    // Look up company's external IDs from Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, hubspot_company_id, harvest_client_id, freshdesk_company_id')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: 'Company not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data: any[] = [];

    // ── Freshdesk: tickets ─────────────────────────────────────────────
    if (artifact === 'tickets') {
      if (!company.freshdesk_company_id) {
        return new Response(JSON.stringify({ data: [], message: 'No Freshdesk company ID mapped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const config = getFreshdeskConfig();
      if (!config) {
        return new Response(JSON.stringify({ error: 'Freshdesk credentials not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      data = await fetchTickets(company.freshdesk_company_id, config);
    }

    // ── HubSpot: deals ─────────────────────────────────────────────────
    if (artifact === 'deals') {
      if (!company.hubspot_company_id) {
        return new Response(JSON.stringify({ data: [], message: 'No HubSpot company ID mapped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const token = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
      if (!token) {
        return new Response(JSON.stringify({ error: 'HubSpot credentials not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      data = await fetchDeals(company.hubspot_company_id, token);
    }

    // ── HubSpot: engagements ───────────────────────────────────────────
    if (artifact === 'engagements') {
      if (!company.hubspot_company_id) {
        return new Response(JSON.stringify({ data: [], message: 'No HubSpot company ID mapped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const token = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
      if (!token) {
        return new Response(JSON.stringify({ error: 'HubSpot credentials not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      data = await fetchEngagements(company.hubspot_company_id, token);
    }

    // ── Harvest: projects ──────────────────────────────────────────────
    if (artifact === 'projects') {
      if (!company.harvest_client_id) {
        return new Response(JSON.stringify({ data: [], message: 'No Harvest client ID mapped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const headers = getHarvestHeaders();
      if (!headers) {
        return new Response(JSON.stringify({ error: 'Harvest credentials not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      data = await fetchProjects(company.harvest_client_id, headers);
    }

    // ── Harvest: time_entries ──────────────────────────────────────────
    if (artifact === 'time_entries') {
      if (!company.harvest_client_id) {
        return new Response(JSON.stringify({ data: [], message: 'No Harvest client ID mapped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const headers = getHarvestHeaders();
      if (!headers) {
        return new Response(JSON.stringify({ error: 'Harvest credentials not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      data = await fetchTimeEntries(company.harvest_client_id, headers);
    }

    // ── Harvest: invoices ──────────────────────────────────────────────
    if (artifact === 'invoices') {
      if (!company.harvest_client_id) {
        return new Response(JSON.stringify({ data: [], message: 'No Harvest client ID mapped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const headers = getHarvestHeaders();
      if (!headers) {
        return new Response(JSON.stringify({ error: 'Harvest credentials not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      data = await fetchInvoices(company.harvest_client_id, headers);
    }

    console.log(`[company-artifacts] Returning ${data.length} ${artifact} for ${company.name}`);

    return new Response(JSON.stringify({ data, count: data.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[company-artifacts] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
