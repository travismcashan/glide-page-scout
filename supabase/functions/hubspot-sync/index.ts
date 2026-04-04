/**
 * HubSpot Artifact Sync v2
 * Pulls contacts, deals, and engagements for all companies with a hubspot_company_id.
 * Uses batch upserts for performance.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Batch Upsert Helper ──

async function batchUpsert(
  supabase: any,
  table: string,
  records: any[],
  conflictCol: string,
  batchSize = 50,
): Promise<number> {
  if (records.length === 0) return 0;
  let count = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictCol });

    if (error) {
      console.warn(`[batch-upsert] Batch failed on ${table}, falling back to individual upserts:`, error.message);
      for (const record of batch) {
        const { error: indivError } = await supabase
          .from(table)
          .upsert(record, { onConflict: conflictCol });
        if (indivError) {
          console.warn(`[batch-upsert] Individual upsert failed on ${table}:`, indivError.message);
        } else {
          count++;
        }
      }
    } else {
      count += batch.length;
    }
  }

  return count;
}

// ── HubSpot API helpers ──

async function hubspotGet(token: string, url: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get('Retry-After') || '2', 10);
    console.log(`[hubspot-sync] Rate limited, waiting ${retry}s...`);
    await new Promise(r => setTimeout(r, retry * 1000));
    return hubspotGet(token, url);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function hubspotPaginate(token: string, baseUrl: string, limit = 100, maxPages = 50): Promise<any[]> {
  const results: any[] = [];
  let after: string | undefined;
  let page = 0;

  while (page < maxPages) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}limit=${limit}${after ? `&after=${after}` : ''}`;
    const data = await hubspotGet(token, url);
    results.push(...(data.results || []));
    after = data.paging?.next?.after;
    if (!after) break;
    page++;
    if (page % 10 === 0) await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

// ── Sync Contacts ──

async function syncContacts(
  token: string,
  supabase: any,
  companyMap: Map<string, { id: string; user_id: string }>,
): Promise<number> {
  const props = 'firstname,lastname,email,phone,jobtitle,company,hs_lead_status,lifecyclestage,associatedcompanyid';
  const contacts = await hubspotPaginate(
    token,
    `https://api.hubapi.com/crm/v3/objects/contacts?properties=${props}&associations=companies`,
  );

  console.log(`[hubspot-sync] Fetched ${contacts.length} contacts`);
  const records: any[] = [];

  for (const c of contacts) {
    const p = c.properties || {};
    // Find associated company
    const assocCompanyIds = (c.associations?.companies?.results || []).map((a: any) => String(a.id));
    let companyEntry: { id: string; user_id: string } | null = null;

    for (const hsId of assocCompanyIds) {
      if (companyMap.has(hsId)) { companyEntry = companyMap.get(hsId)!; break; }
    }

    // Also try the associatedcompanyid property
    if (!companyEntry && p.associatedcompanyid && companyMap.has(p.associatedcompanyid)) {
      companyEntry = companyMap.get(p.associatedcompanyid)!;
    }

    if (!companyEntry) continue;

    records.push({
      user_id: companyEntry.user_id,
      company_id: companyEntry.id,
      hubspot_contact_id: c.id,
      first_name: p.firstname || null,
      last_name: p.lastname || null,
      email: p.email || null,
      phone: p.phone || null,
      title: p.jobtitle || null,
    });
  }

  return batchUpsert(supabase, 'contacts', records, 'hubspot_contact_id');
}

// ── Sync Deals ──

async function syncDeals(
  token: string,
  supabase: any,
  companyMap: Map<string, { id: string; user_id: string }>,
): Promise<number> {
  const props = 'dealname,amount,dealstage,pipeline,closedate,hs_deal_stage_probability,dealtype,description';
  const deals = await hubspotPaginate(
    token,
    `https://api.hubapi.com/crm/v3/objects/deals?properties=${props}&associations=companies`,
  );

  console.log(`[hubspot-sync] Fetched ${deals.length} deals`);

  // Fetch pipeline stages for status mapping
  let stageMap: Map<string, string> = new Map();
  try {
    const pipelines = await hubspotGet(token, 'https://api.hubapi.com/crm/v3/pipelines/deals');
    for (const pipeline of (pipelines.results || [])) {
      for (const stage of (pipeline.stages || [])) {
        const status = stage.metadata?.isClosed === 'true'
          ? (stage.metadata?.probability === '1.0' ? 'won' : 'lost')
          : 'open';
        stageMap.set(stage.id, status);
      }
    }
  } catch (e) {
    console.warn('[hubspot-sync] Could not fetch pipeline stages:', e);
  }

  const records: any[] = [];

  for (const d of deals) {
    const p = d.properties || {};
    const assocCompanyIds = (d.associations?.companies?.results || []).map((a: any) => String(a.id));
    let companyEntry: { id: string; user_id: string } | null = null;

    for (const hsId of assocCompanyIds) {
      if (companyMap.has(hsId)) { companyEntry = companyMap.get(hsId)!; break; }
    }

    if (!companyEntry) continue;

    records.push({
      user_id: companyEntry.user_id,
      company_id: companyEntry.id,
      hubspot_deal_id: d.id,
      name: p.dealname || 'Untitled Deal',
      amount: p.amount ? parseFloat(p.amount) : null,
      stage: p.dealstage || null,
      pipeline: p.pipeline || null,
      close_date: p.closedate || null,
      status: stageMap.get(p.dealstage || '') || 'open',
      properties: p,
    });
  }

  return batchUpsert(supabase, 'deals', records, 'hubspot_deal_id');
}

// ── Sync Engagements ──

async function syncEngagements(
  token: string,
  supabase: any,
  companyMap: Map<string, { id: string; user_id: string }>,
): Promise<number> {
  const types: { object: string; engType: string }[] = [
    { object: 'emails', engType: 'email' },
    { object: 'calls', engType: 'call' },
    { object: 'meetings', engType: 'meeting' },
    { object: 'notes', engType: 'note' },
    { object: 'tasks', engType: 'task' },
  ];

  const allRecords: any[] = [];

  for (const { object, engType } of types) {
    const props = object === 'emails'
      ? 'hs_email_subject,hs_email_text,hs_email_direction,hs_timestamp'
      : object === 'calls'
      ? 'hs_call_title,hs_call_body,hs_call_direction,hs_timestamp,hs_call_duration'
      : object === 'meetings'
      ? 'hs_meeting_title,hs_meeting_body,hs_timestamp,hs_meeting_start_time,hs_meeting_end_time'
      : object === 'notes'
      ? 'hs_note_body,hs_timestamp'
      : 'hs_task_subject,hs_task_body,hs_task_status,hs_timestamp';

    let items: any[] = [];
    try {
      items = await hubspotPaginate(
        token,
        `https://api.hubapi.com/crm/v3/objects/${object}?properties=${props}&associations=companies,contacts`,
      );
    } catch (e: any) {
      console.warn(`[hubspot-sync] Failed to fetch ${object}:`, e.message);
      continue;
    }

    console.log(`[hubspot-sync] Fetched ${items.length} ${object}`);

    for (const item of items) {
      const p = item.properties || {};
      const assocCompanyIds = (item.associations?.companies?.results || []).map((a: any) => String(a.id));
      let companyEntry: { id: string; user_id: string } | null = null;

      for (const hsId of assocCompanyIds) {
        if (companyMap.has(hsId)) { companyEntry = companyMap.get(hsId)!; break; }
      }

      if (!companyEntry) continue;

      // Extract subject and body based on type
      let subject: string | null = null;
      let bodyPreview: string | null = null;
      let direction: string | null = null;

      if (engType === 'email') {
        subject = p.hs_email_subject || null;
        bodyPreview = (p.hs_email_text || '').slice(0, 500) || null;
        direction = p.hs_email_direction === 'INCOMING_EMAIL' ? 'inbound' : 'outbound';
      } else if (engType === 'call') {
        subject = p.hs_call_title || null;
        bodyPreview = (p.hs_call_body || '').slice(0, 500) || null;
        direction = p.hs_call_direction === 'INBOUND' ? 'inbound' : 'outbound';
      } else if (engType === 'meeting') {
        subject = p.hs_meeting_title || null;
        bodyPreview = (p.hs_meeting_body || '').slice(0, 500) || null;
      } else if (engType === 'note') {
        bodyPreview = (p.hs_note_body || '').replace(/<[^>]+>/g, '').slice(0, 500) || null;
        subject = bodyPreview ? bodyPreview.slice(0, 80) : null;
      } else if (engType === 'task') {
        subject = p.hs_task_subject || null;
        bodyPreview = (p.hs_task_body || '').slice(0, 500) || null;
      }

      const occurredAt = p.hs_timestamp ? new Date(parseInt(p.hs_timestamp)).toISOString() : null;

      allRecords.push({
        user_id: companyEntry.user_id,
        company_id: companyEntry.id,
        hubspot_engagement_id: item.id,
        engagement_type: engType,
        subject,
        body_preview: bodyPreview,
        direction,
        occurred_at: occurredAt,
        metadata: p,
      });
    }
  }

  return batchUpsert(supabase, 'engagements', allRecords, 'hubspot_engagement_id');
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, artifacts } = await req.json();
    // artifacts: optional filter e.g. ['contacts', 'deals', 'engagements']

    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    if (!hubspotToken) throw new Error('HUBSPOT_ACCESS_TOKEN not set');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!userId) throw new Error('userId required');

    // Build company map: hubspot_company_id → { id, user_id }
    const companyMap = new Map<string, { id: string; user_id: string }>();
    const PAGE_SIZE = 1000;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: batch } = await supabase
        .from('companies')
        .select('id, user_id, hubspot_company_id')
        .not('hubspot_company_id', 'is', null)
        .eq('user_id', userId)
        .range(offset, offset + PAGE_SIZE - 1);
      if (!batch || batch.length === 0) break;
      for (const c of batch) {
        companyMap.set(c.hubspot_company_id, { id: c.id, user_id: c.user_id });
      }
      if (batch.length < PAGE_SIZE) break;
    }

    console.log(`[hubspot-sync] Found ${companyMap.size} companies with HubSpot IDs`);

    const af = artifacts as string[] | undefined;
    const syncAll = !af || af.length === 0;

    const results: any = {};

    if (syncAll || af?.includes('contacts')) {
      console.log('[hubspot-sync] Syncing contacts...');
      results.contacts = await syncContacts(hubspotToken, supabase, companyMap);
      console.log(`[hubspot-sync] Contacts: ${results.contacts} upserted`);
    }

    if (syncAll || af?.includes('deals')) {
      console.log('[hubspot-sync] Syncing deals...');
      results.deals = await syncDeals(hubspotToken, supabase, companyMap);
      console.log(`[hubspot-sync] Deals: ${results.deals} upserted`);
    }

    if (syncAll || af?.includes('engagements')) {
      console.log('[hubspot-sync] Syncing engagements...');
      results.engagements = await syncEngagements(hubspotToken, supabase, companyMap);
      console.log(`[hubspot-sync] Engagements: ${results.engagements} upserted`);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[hubspot-sync] Error:', error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
