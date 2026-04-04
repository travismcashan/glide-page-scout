/**
 * Freshdesk Artifact Sync v2
 * Pulls tickets, conversations, and contacts for all companies with a freshdesk_company_id.
 * Uses batch upserts for performance.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATUS_LABELS: Record<number, string> = { 2: 'Open', 3: 'Pending', 4: 'Resolved', 5: 'Closed' };
const PRIORITY_LABELS: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Urgent' };
const SOURCE_LABELS: Record<number, string> = { 1: 'Email', 2: 'Portal', 3: 'Phone', 7: 'Chat', 9: 'Feedback Widget', 10: 'Outbound Email' };

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

// ── Freshdesk API helpers ──

async function fdGet(baseUrl: string, headers: Record<string, string>, path: string): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, { headers });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get('Retry-After') || '5', 10);
    console.log(`[freshdesk-sync] Rate limited, waiting ${retry}s...`);
    await new Promise(r => setTimeout(r, retry * 1000));
    return fdGet(baseUrl, headers, path);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Freshdesk ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fdPaginate(baseUrl: string, headers: Record<string, string>, path: string, maxPages = 100): Promise<any[]> {
  const results: any[] = [];
  let page = 1;

  while (page <= maxPages) {
    const sep = path.includes('?') ? '&' : '?';
    const data = await fdGet(baseUrl, headers, `${path}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return results;
}

// ── Sync Tickets ──

async function syncTickets(
  baseUrl: string,
  headers: Record<string, string>,
  supabase: any,
  companyMap: Map<string, { id: string; user_id: string }>,
  syncConversations: boolean,
): Promise<{ tickets: number; conversations: number }> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 2);
  const sinceStr = since.toISOString();

  const tickets = await fdPaginate(
    baseUrl,
    headers,
    `/tickets?include=requester,stats,description&updated_since=${sinceStr}&order_by=updated_at&order_type=desc`,
  );
  console.log(`[freshdesk-sync] Fetched ${tickets.length} tickets`);

  const ticketRecords: any[] = [];
  const matchedTickets: any[] = [];

  for (const t of tickets) {
    const fdCompanyId = t.company_id ? String(t.company_id) : null;
    if (!fdCompanyId || !companyMap.has(fdCompanyId)) continue;
    const company = companyMap.get(fdCompanyId)!;

    ticketRecords.push({
      company_id: company.id,
      user_id: company.user_id,
      freshdesk_ticket_id: String(t.id),
      freshdesk_company_id: fdCompanyId,
      requester_name: t.requester?.name || null,
      requester_email: t.requester?.email || null,
      subject: t.subject || null,
      description_text: t.description_text || (t.description || '').replace(/<[^>]+>/g, '').slice(0, 2000) || null,
      status: t.status || null,
      status_label: STATUS_LABELS[t.status] || null,
      priority: t.priority || null,
      priority_label: PRIORITY_LABELS[t.priority] || null,
      ticket_type: t.type || null,
      source: t.source || null,
      source_label: SOURCE_LABELS[t.source] || null,
      tags: t.tags || [],
      group_name: t.group_id ? `group-${t.group_id}` : null,
      agent_name: t.responder_id ? `agent-${t.responder_id}` : null,
      created_date: t.created_at || null,
      updated_date: t.updated_at || null,
      due_by: t.due_by || null,
      resolved_at: t.stats?.resolved_at || null,
      closed_at: t.stats?.closed_at || null,
      first_responded_at: t.stats?.first_responded_at || null,
      satisfaction_rating: t.satisfaction_rating || null,
      raw_data: t,
    });

    matchedTickets.push(t);
  }

  const ticketCount = await batchUpsert(supabase, 'freshdesk_tickets', ticketRecords, 'freshdesk_ticket_id');

  // Sync conversations for all matched tickets
  let convoCount = 0;
  if (syncConversations) {
    const convoRecords: any[] = [];

    for (const t of matchedTickets) {
      try {
        const convos = await fdGet(baseUrl, headers, `/tickets/${t.id}/conversations`);
        if (Array.isArray(convos)) {
          for (const c of convos) {
            convoRecords.push({
              freshdesk_ticket_id: String(t.id),
              freshdesk_conversation_id: String(c.id),
              body_text: (c.body_text || (c.body || '').replace(/<[^>]+>/g, '')).slice(0, 5000) || null,
              incoming: c.incoming ?? false,
              private_note: c.private ?? false,
              from_email: c.from_email || null,
              to_emails: c.to_emails || [],
              support_email: c.support_email || null,
              source: c.source || null,
              created_date: c.created_at || null,
              raw_data: c,
            });
          }
        }
      } catch (e: any) {
        console.warn(`[freshdesk-sync] Failed to fetch conversations for ticket ${t.id}:`, e.message);
      }
    }

    convoCount = await batchUpsert(supabase, 'freshdesk_ticket_conversations', convoRecords, 'freshdesk_conversation_id');
  }

  return { tickets: ticketCount, conversations: convoCount };
}

// ── Sync Freshdesk Contacts ──

async function syncContacts(
  baseUrl: string,
  headers: Record<string, string>,
  supabase: any,
  companyMap: Map<string, { id: string; user_id: string }>,
): Promise<{ created: number; updated: number }> {
  const contacts = await fdPaginate(baseUrl, headers, '/contacts');
  console.log(`[freshdesk-sync] Fetched ${contacts.length} contacts`);

  let created = 0, updated = 0;

  for (const c of contacts) {
    const fdCompanyId = c.company_id ? String(c.company_id) : null;
    if (!fdCompanyId || !companyMap.has(fdCompanyId)) continue;
    const company = companyMap.get(fdCompanyId)!;

    const record = {
      user_id: company.user_id,
      company_id: company.id,
      first_name: c.name?.split(' ')[0] || null,
      last_name: c.name?.split(' ').slice(1).join(' ') || null,
      email: c.email || null,
      phone: c.phone || c.mobile || null,
      title: c.job_title || null,
    };

    // Dedup by email + company
    if (record.email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', company.id)
        .eq('email', record.email)
        .maybeSingle();

      if (existing) {
        await supabase.from('contacts').update(record).eq('id', existing.id);
        updated++;
        continue;
      }
    }

    await supabase.from('contacts').insert(record);
    created++;
  }

  return { created, updated };
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, artifacts } = await req.json();

    const apiKey = Deno.env.get('FRESHDESK_API_KEY');
    const domain = Deno.env.get('FRESHDESK_DOMAIN');
    if (!apiKey || !domain) throw new Error('Freshdesk credentials not set');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!userId) throw new Error('userId required');

    const baseUrl = domain.includes('.') ? `https://${domain}/api/v2` : `https://${domain}.freshdesk.com/api/v2`;
    const headers = {
      Authorization: `Basic ${btoa(apiKey + ':X')}`,
      'Content-Type': 'application/json',
    };

    // Build company map: freshdesk_company_id → { id, user_id }
    const companyMap = new Map<string, { id: string; user_id: string }>();
    const PAGE_SIZE = 1000;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: batch } = await supabase
        .from('companies')
        .select('id, user_id, freshdesk_company_id')
        .not('freshdesk_company_id', 'is', null)
        .eq('user_id', userId)
        .range(offset, offset + PAGE_SIZE - 1);
      if (!batch || batch.length === 0) break;
      for (const c of batch) {
        companyMap.set(c.freshdesk_company_id, { id: c.id, user_id: c.user_id });
      }
      if (batch.length < PAGE_SIZE) break;
    }

    console.log(`[freshdesk-sync] Found ${companyMap.size} companies with Freshdesk IDs`);

    const af = artifacts as string[] | undefined;
    const syncAll = !af || af.length === 0;
    const results: any = {};

    if (syncAll || af?.includes('tickets')) {
      const includeConvos = syncAll || af?.includes('conversations');
      console.log(`[freshdesk-sync] Syncing tickets${includeConvos ? ' + conversations' : ''}...`);
      const ticketResult = await syncTickets(baseUrl, headers, supabase, companyMap, !!includeConvos);
      results.tickets = ticketResult.tickets;
      results.conversations = ticketResult.conversations;
      console.log(`[freshdesk-sync] Tickets: ${ticketResult.tickets} upserted, conversations: ${ticketResult.conversations} upserted`);
    }

    if (syncAll || af?.includes('contacts')) {
      console.log('[freshdesk-sync] Syncing contacts...');
      results.contacts = await syncContacts(baseUrl, headers, supabase, companyMap);
      console.log(`[freshdesk-sync] Contacts: ${results.contacts.created} created, ${results.contacts.updated} updated`);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[freshdesk-sync] Error:', error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
