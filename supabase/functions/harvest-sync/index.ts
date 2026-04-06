/**
 * Harvest Artifact Sync v2
 * Pulls projects, time entries, invoices, and payments for all companies with a harvest_client_id.
 * Uses batch upserts for performance.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncRun, completeSyncRun, failSyncRun } from "../_shared/sync-logger.ts";

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

// ── Harvest API helpers ──

async function harvestGet(headers: Record<string, string>, url: string): Promise<any> {
  const res = await fetch(url, { headers });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get('Retry-After') || '3', 10);
    console.log(`[harvest-sync] Rate limited, waiting ${retry}s...`);
    await new Promise(r => setTimeout(r, retry * 1000));
    return harvestGet(headers, url);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Harvest ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function harvestPaginate(headers: Record<string, string>, baseUrl: string, dataKey: string, maxPages = 50): Promise<any[]> {
  const results: any[] = [];
  let page = 1;

  while (page <= maxPages) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}per_page=100&page=${page}`;
    const data = await harvestGet(headers, url);
    const items = data[dataKey] || [];
    results.push(...items);
    if (!data.next_page) break;
    page++;
  }

  return results;
}

// ── Sync Projects ──

async function syncProjects(
  headers: Record<string, string>,
  supabase: any,
  clientMap: Map<string, { id: string; user_id: string }>,
): Promise<number> {
  const projects = await harvestPaginate(headers, 'https://api.harvestapp.com/v2/projects', 'projects');
  console.log(`[harvest-sync] Fetched ${projects.length} projects`);

  const records: any[] = [];

  for (const p of projects) {
    const clientId = p.client?.id ? String(p.client.id) : null;
    if (!clientId || !clientMap.has(clientId)) continue;
    const company = clientMap.get(clientId)!;

    records.push({
      company_id: company.id,
      user_id: company.user_id,
      harvest_project_id: String(p.id),
      harvest_client_id: clientId,
      name: p.name || '',
      code: p.code || null,
      is_active: p.is_active ?? true,
      is_billable: p.is_billable ?? true,
      bill_by: p.bill_by || null,
      budget: p.budget || null,
      budget_by: p.budget_by || null,
      budget_is_monthly: p.budget_is_monthly ?? false,
      notify_when_over_budget: p.notify_when_over_budget ?? false,
      over_budget_notification_percentage: p.over_budget_notification_percentage || null,
      starts_on: p.starts_on || null,
      ends_on: p.ends_on || null,
      notes: p.notes || null,
      cost_budget: p.cost_budget || null,
      cost_budget_include_expenses: p.cost_budget_include_expenses ?? false,
      fee: p.fee || null,
      hourly_rate: p.hourly_rate || null,
      raw_data: p,
      updated_at: new Date().toISOString(),
    });
  }

  return batchUpsert(supabase, 'harvest_projects', records, 'harvest_project_id');
}

// ── Sync Time Entries ──

async function syncTimeEntries(
  headers: Record<string, string>,
  supabase: any,
  clientMap: Map<string, { id: string; user_id: string }>,
): Promise<number> {
  // Fetch time entries from last 2 years by default
  const from = new Date();
  from.setFullYear(from.getFullYear() - 2);
  const fromStr = from.toISOString().slice(0, 10);

  const entries = await harvestPaginate(
    headers,
    `https://api.harvestapp.com/v2/time_entries?from=${fromStr}`,
    'time_entries',
    100, // more pages since there can be many entries
  );
  console.log(`[harvest-sync] Fetched ${entries.length} time entries (since ${fromStr})`);

  const records: any[] = [];

  for (const t of entries) {
    const clientId = t.client?.id ? String(t.client.id) : null;
    if (!clientId || !clientMap.has(clientId)) continue;
    const company = clientMap.get(clientId)!;

    records.push({
      company_id: company.id,
      user_id: company.user_id,
      harvest_time_entry_id: String(t.id),
      harvest_project_id: t.project?.id ? String(t.project.id) : null,
      harvest_task_id: t.task?.id ? String(t.task.id) : null,
      harvest_user_id: t.user?.id ? String(t.user.id) : null,
      harvest_user_name: t.user?.name || null,
      task_name: t.task?.name || null,
      project_name: t.project?.name || null,
      spent_date: t.spent_date || null,
      hours: t.hours || 0,
      rounded_hours: t.rounded_hours || null,
      is_locked: t.is_locked ?? false,
      is_closed: t.is_closed ?? false,
      is_billed: t.is_billed ?? false,
      is_running: t.is_running ?? false,
      billable: t.billable ?? true,
      budgeted: t.budgeted ?? false,
      billable_rate: t.billable_rate || null,
      cost_rate: t.cost_rate || null,
      notes: t.notes || null,
      raw_data: t,
    });
  }

  return batchUpsert(supabase, 'harvest_time_entries', records, 'harvest_time_entry_id');
}

// ── Sync Invoices + Payments ──

async function syncInvoices(
  headers: Record<string, string>,
  supabase: any,
  clientMap: Map<string, { id: string; user_id: string }>,
): Promise<{ invoices: number; payments: number }> {
  const invoices = await harvestPaginate(headers, 'https://api.harvestapp.com/v2/invoices', 'invoices');
  console.log(`[harvest-sync] Fetched ${invoices.length} invoices`);

  const invoiceRecords: any[] = [];
  const paidInvoices: any[] = [];

  for (const inv of invoices) {
    const clientId = inv.client?.id ? String(inv.client.id) : null;
    if (!clientId || !clientMap.has(clientId)) continue;
    const company = clientMap.get(clientId)!;

    invoiceRecords.push({
      company_id: company.id,
      user_id: company.user_id,
      harvest_invoice_id: String(inv.id),
      harvest_client_id: clientId,
      number: inv.number || null,
      amount: inv.amount || null,
      due_amount: inv.due_amount || null,
      tax: inv.tax || null,
      tax_amount: inv.tax_amount || null,
      tax2: inv.tax2 || null,
      tax2_amount: inv.tax2_amount || null,
      discount: inv.discount || null,
      discount_amount: inv.discount_amount || null,
      subject: inv.subject || null,
      notes: inv.notes || null,
      state: inv.state || null,
      issue_date: inv.issue_date || null,
      due_date: inv.due_date || null,
      sent_at: inv.sent_at || null,
      paid_at: inv.paid_at || null,
      paid_date: inv.paid_date || null,
      period_start: inv.period_start || null,
      period_end: inv.period_end || null,
      currency: inv.currency || null,
      purchase_order: inv.purchase_order || null,
      payment_term: inv.payment_term || null,
      raw_data: inv,
    });

    // Only fetch payments for paid invoices
    if (inv.state === 'paid' && inv.id) {
      paidInvoices.push(inv);
    }
  }

  const invoiceCount = await batchUpsert(supabase, 'harvest_invoices', invoiceRecords, 'harvest_invoice_id');

  // Fetch and batch upsert payments for paid invoices
  const paymentRecords: any[] = [];
  for (const inv of paidInvoices) {
    try {
      const paymentsData = await harvestGet(headers, `https://api.harvestapp.com/v2/invoices/${inv.id}/payments`);
      for (const pay of (paymentsData.invoice_payments || [])) {
        paymentRecords.push({
          harvest_payment_id: String(pay.id),
          harvest_invoice_id: String(inv.id),
          amount: pay.amount || null,
          paid_at: pay.paid_at || null,
          paid_date: pay.paid_date || null,
          recorded_by: pay.recorded_by || null,
          recorded_by_email: pay.recorded_by_email || null,
          notes: pay.notes || null,
          transaction_id: pay.transaction_id || null,
          payment_gateway_id: pay.payment_gateway?.id ? String(pay.payment_gateway.id) : null,
          raw_data: pay,
        });
      }
    } catch (e: any) {
      console.warn(`[harvest-sync] Failed to fetch payments for invoice ${inv.id}:`, e.message);
    }
  }

  const paymentCount = await batchUpsert(supabase, 'harvest_invoice_payments', paymentRecords, 'harvest_payment_id');

  return { invoices: invoiceCount, payments: paymentCount };
}

// ── Sync Client Contacts ──

async function syncClientContacts(
  headers: Record<string, string>,
  supabase: any,
  clientMap: Map<string, { id: string; user_id: string }>,
): Promise<{ created: number; updated: number }> {
  const contacts = await harvestPaginate(headers, 'https://api.harvestapp.com/v2/contacts', 'contacts');
  console.log(`[harvest-sync] Fetched ${contacts.length} client contacts`);

  let created = 0, updated = 0;

  for (const c of contacts) {
    const clientId = c.client?.id ? String(c.client.id) : null;
    if (!clientId || !clientMap.has(clientId)) continue;
    const company = clientMap.get(clientId)!;

    const record = {
      user_id: company.user_id,
      company_id: company.id,
      first_name: c.first_name || null,
      last_name: c.last_name || null,
      email: c.email || null,
      phone: c.phone_office || c.phone_mobile || null,
      title: c.title || null,
    };

    // Check if contact already exists by email + company
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

  let supabase: any = null;
  let syncRunId = '';
  let syncRunStartedAt = 0;

  try {
    const { userId, artifacts } = await req.json();

    const harvestToken = Deno.env.get('HARVEST_ACCESS_TOKEN');
    const harvestAccountId = Deno.env.get('HARVEST_ACCOUNT_ID');
    if (!harvestToken || !harvestAccountId) throw new Error('Harvest credentials not set');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!userId) throw new Error('userId required');

    const syncRun = await startSyncRun(supabase, 'harvest-sync');
    syncRunId = syncRun.id;
    syncRunStartedAt = syncRun.startedAt;

    const headers = {
      Authorization: `Bearer ${harvestToken}`,
      'Harvest-Account-Id': harvestAccountId,
      'Content-Type': 'application/json',
    };

    // Build client map: harvest_client_id → { id, user_id }
    const clientMap = new Map<string, { id: string; user_id: string }>();
    const PAGE_SIZE = 1000;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: batch } = await supabase
        .from('companies')
        .select('id, user_id, harvest_client_id')
        .not('harvest_client_id', 'is', null)
        .eq('user_id', userId)
        .range(offset, offset + PAGE_SIZE - 1);
      if (!batch || batch.length === 0) break;
      for (const c of batch) {
        clientMap.set(c.harvest_client_id, { id: c.id, user_id: c.user_id });
      }
      if (batch.length < PAGE_SIZE) break;
    }

    console.log(`[harvest-sync] Found ${clientMap.size} companies with Harvest client IDs`);

    const af = artifacts as string[] | undefined;
    const syncAll = !af || af.length === 0;
    const results: any = {};

    if (syncAll || af?.includes('projects')) {
      console.log('[harvest-sync] Syncing projects...');
      results.projects = await syncProjects(headers, supabase, clientMap);
      console.log(`[harvest-sync] Projects: ${results.projects} upserted`);
    }

    if (syncAll || af?.includes('time_entries')) {
      console.log('[harvest-sync] Syncing time entries...');
      results.time_entries = await syncTimeEntries(headers, supabase, clientMap);
      console.log(`[harvest-sync] Time entries: ${results.time_entries} upserted`);
    }

    if (syncAll || af?.includes('invoices')) {
      console.log('[harvest-sync] Syncing invoices...');
      const inv = await syncInvoices(headers, supabase, clientMap);
      results.invoices = inv.invoices;
      results.payments = inv.payments;
      console.log(`[harvest-sync] Invoices: ${inv.invoices} upserted, payments: ${inv.payments} upserted`);
    }

    if (syncAll || af?.includes('contacts')) {
      console.log('[harvest-sync] Syncing client contacts...');
      results.contacts = await syncClientContacts(headers, supabase, clientMap);
      console.log(`[harvest-sync] Client contacts: ${results.contacts.created} created, ${results.contacts.updated} updated`);
    }

    const totalUpserted = (results.projects || 0) + (results.time_entries || 0) +
      (results.invoices || 0) + (results.payments || 0) +
      ((results.contacts?.created || 0) + (results.contacts?.updated || 0));

    await completeSyncRun(supabase, syncRunId, {
      recordsUpserted: totalUpserted,
      metadata: results,
    }, syncRunStartedAt);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[harvest-sync] Error:', error);
    if (syncRunId && supabase) {
      try { await failSyncRun(supabase, syncRunId, error); } catch {}
    }
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
