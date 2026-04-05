/**
 * Cached TanStack Query hooks for commonly accessed data.
 * All follow the same pattern: fetch once, serve from memory for 5 min,
 * revalidate in background after stale, cache lives for 30 min.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withQueryTimeout } from '@/lib/queryTimeout';
import { PIPELINES, DEFAULT_PIPELINE, LEAD_STATUSES } from '@/config/pipeline';

// ─── Sites (HistoryPage) ─────────────────────────────────────────────────────

async function fetchSessions() {
  const { data, error } = await supabase
    .from('crawl_sessions')
    .select('id, domain, base_url, status, created_at, company_id, psi_data, companies!company_id(id, name)')
    .not('domain', 'like', '_\\_%')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const sessions = (data ?? []).map((s: any) => ({
    ...s,
    company_name: s.companies?.name || null,
  })) as any[];

  // For sessions without company_id, try to match by domain
  const unmatched = sessions.filter(s => !s.company_name);
  if (unmatched.length > 0) {
    const domains = [...new Set(unmatched.map(s => s.domain))];
    const { data: companiesByDomain } = await supabase
      .from('companies')
      .select('name, domain')
      .in('domain', domains);
    if (companiesByDomain) {
      const domainMap = new Map(companiesByDomain.map((c: any) => [c.domain, c.name]));
      for (const s of sessions) {
        if (!s.company_name && domainMap.has(s.domain)) {
          s.company_name = domainMap.get(s.domain);
        }
      }
    }
  }

  const domainCounts = new Map<string, number>();
  sessions.forEach(s => domainCounts.set(s.domain, (domainCounts.get(s.domain) ?? 0) + 1));

  return { sessions, domainCounts };
}

export function useSessions() {
  const query = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
  });

  return {
    sessions: query.data?.sessions ?? [],
    domainCounts: query.data?.domainCounts ?? new Map<string, number>(),
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function useInvalidateSessions() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['sessions'] });
}

// ─── Site Groups (GroupsPage) ────────────────────────────────────────────────

async function fetchGroups() {
  const { data: groupRows } = await supabase
    .from('site_groups')
    .select('*')
    .order('created_at', { ascending: false });

  if (!groupRows) return [];

  const { data: members } = await supabase.from('site_group_members').select('group_id');
  const counts = new Map<string, number>();
  members?.forEach((m: any) => counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1));

  return groupRows.map((g: any) => ({ ...g, member_count: counts.get(g.id) ?? 0 }));
}

export function useSiteGroups() {
  const query = useQuery({
    queryKey: ['site-groups'],
    queryFn: fetchGroups,
  });

  return {
    groups: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useInvalidateSiteGroups() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['site-groups'] });
}

// ─── Wishlist (WishlistPage) ─────────────────────────────────────────────────

async function fetchWishlistItems() {
  const { data, error } = await withQueryTimeout(
    supabase.from('wishlist_items').select('*').order('created_at', { ascending: false }),
    12000, 'Loading wishlist timed out',
  );
  if (error) throw error;

  const items = (data as any[]) || [];
  const itemIds = items.map(i => i.id);

  // Enrich with profile data
  const userIds = [...new Set(items.map(i => i.submitted_by).filter(Boolean))];
  if (userIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
    if (profiles?.length) {
      const profileMap = new Map(profiles.map(p => [p.id, p]));
      for (const item of items) {
        if (item.submitted_by) item.profiles = profileMap.get(item.submitted_by) || null;
      }
    }
  }

  // Enrich with attachment + comment counts
  if (itemIds.length) {
    const [{ data: attCounts }, { data: cmtCounts }] = await Promise.all([
      supabase.from('wishlist_attachments').select('wishlist_item_id').in('wishlist_item_id', itemIds),
      supabase.from('wishlist_comments').select('wishlist_item_id').in('wishlist_item_id', itemIds),
    ]);
    const attMap = new Map<string, number>();
    const cmtMap = new Map<string, number>();
    for (const a of attCounts || []) attMap.set(a.wishlist_item_id, (attMap.get(a.wishlist_item_id) || 0) + 1);
    for (const c of cmtCounts || []) cmtMap.set(c.wishlist_item_id, (cmtMap.get(c.wishlist_item_id) || 0) + 1);
    for (const item of items) {
      item.attachment_count = attMap.get(item.id) || 0;
      item.comment_count = cmtMap.get(item.id) || 0;
    }
  }

  return items;
}

export function useWishlistItems() {
  const query = useQuery({
    queryKey: ['wishlist-items'],
    queryFn: fetchWishlistItems,
  });

  return {
    items: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useInvalidateWishlist() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['wishlist-items'] });
}

// ─── Model Pricing (UsagePage) ───────────────────────────────────────────────

async function fetchModelPricing() {
  const { data: rows } = await supabase.from('model_pricing').select('model, input_per_1m, output_per_1m');
  const map: Record<string, [number, number]> = {};
  if (rows) {
    for (const r of rows) map[r.model] = [Number(r.input_per_1m), Number(r.output_per_1m)];
  }
  return map;
}

export function useModelPricing() {
  const query = useQuery({
    queryKey: ['model-pricing'],
    queryFn: fetchModelPricing,
    staleTime: 60 * 60 * 1000, // pricing changes extremely rarely — 1 hr stale
  });

  return {
    pricing: query.data ?? {},
    loading: query.isLoading,
  };
}

// ─── Chat Threads (ChatThreadSidebar) ────────────────────────────────────────

async function fetchChatThreads(sessionId: string) {
  const { data } = await supabase
    .from('chat_threads')
    .select('*')
    .eq('session_id', sessionId)
    .order('updated_at', { ascending: false });
  return (data ?? []) as any[];
}

export function useChatThreads(sessionId: string, refreshKey?: number) {
  const query = useQuery({
    queryKey: ['chat-threads', sessionId, refreshKey],
    queryFn: () => fetchChatThreads(sessionId),
    enabled: !!sessionId,
  });

  return {
    threads: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useInvalidateChatThreads() {
  const qc = useQueryClient();
  return (sessionId: string) => qc.invalidateQueries({ queryKey: ['chat-threads', sessionId] });
}

// ─── Pipeline Definitions (local, matches HubSpot pipeline/stage IDs) ────────

// Pipeline definitions imported from @/config/pipeline

// ─── Pipeline Deals (reads from local deals table) ──────────────────────────

async function fetchPipelineDeals(pipelineId: string) {
  const { data: rows, error } = await supabase
    .from('deals')
    .select('*, contacts(id, first_name, last_name, email, photo_url, title), companies!company_id(id, name, domain)')
    .eq('pipeline', pipelineId)
    .order('close_date', { ascending: false });

  if (error) throw new Error(`Failed to load deals: ${error.message}`);

  // Reshape to match the PipelinePage's expected Deal type
  const deals = (rows || []).map((d: any) => {
    const contact = d.contacts;
    const company = d.companies;
    return {
      id: d.hubspot_deal_id || d.id,
      dealname: d.name,
      amount: d.amount != null ? String(d.amount) : null,
      dealstage: d.stage,
      pipeline: d.pipeline,
      closedate: d.close_date,
      createdate: d.properties?.createdate || d.created_at,
      hs_lastmodifieddate: d.properties?.hs_lastmodifieddate || d.updated_at,
      hubspot_owner_id: d.hubspot_owner_id,
      companyName: company?.name || '',
      companyDomain: company?.domain || null,
      companyId: company?.id || null,
      contactName: contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : null,
      contactTitle: contact?.title || null,
      contactPhotoUrl: contact?.photo_url || null,
      contactEmail: contact?.email || null,
      dealtype: d.deal_type,
      hs_priority: d.priority,
      deal_source_details: d.properties?.deal_source_details || null,
      hs_forecast_probability: d.properties?.hs_forecast_probability || null,
      notes_last_contacted: d.properties?.notes_last_contacted || null,
    };
  });

  // Build owner maps from deal properties
  const owners: Record<string, string> = {};
  const ownerTeams: Record<string, { name: string; team: string | null; active: boolean }> = {};
  for (const d of rows || []) {
    if (d.hubspot_owner_id && d.properties?.owner_name) {
      owners[d.hubspot_owner_id] = d.properties.owner_name;
      if (!ownerTeams[d.hubspot_owner_id]) {
        ownerTeams[d.hubspot_owner_id] = { name: d.properties.owner_name, team: null, active: true };
      }
    }
  }

  const pipelineDef = PIPELINES[pipelineId] || PIPELINES[DEFAULT_PIPELINE];

  return {
    deals,
    owners,
    ownerTeams,
    nextCursor: null,
    stagePaging: {},
    pipeline: { id: pipelineId, label: pipelineDef.label, stages: pipelineDef.stages },
    pipelines: Object.entries(PIPELINES).map(([id, p]) => ({ id, label: p.label })),
  };
}

export function usePipelineDeals(pipelineId: string) {
  const query = useQuery({
    queryKey: ['pipeline-deals', pipelineId],
    queryFn: () => fetchPipelineDeals(pipelineId),
    enabled: !!pipelineId,
  });
  return {
    deals: query.data?.deals ?? [],
    owners: query.data?.owners ?? {},
    ownerTeams: query.data?.ownerTeams ?? {},
    pipelineInfo: query.data?.pipeline ?? null,
    pipelineOptions: query.data?.pipelines ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

// ─── Pipeline Leads (reads from local contacts table) ───────────────────────

async function fetchPipelineLeads() {
  const { data: rows, error } = await supabase
    .from('contacts')
    .select('*, companies!company_id(id, name, domain)')
    .not('lead_status', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to load leads: ${error.message}`);

  // Reshape to match PipelinePage's expected Contact type
  const contacts = (rows || []).map((c: any) => ({
    id: c.hubspot_contact_id || c.id,
    firstname: c.first_name,
    lastname: c.last_name,
    email: c.email,
    company: c.companies?.name || c.enrichment_data?.company_name || null,
    companyDomain: c.companies?.domain || null,
    companyId: c.companies?.id || c.company_id || null,
    jobtitle: c.title,
    phone: c.phone,
    lifecyclestage: c.lifecycle_stage,
    hs_lead_status: c.lead_status,
    hubspot_owner_id: c.hubspot_owner_id,
    lastmodifieddate: c.updated_at,
    createdate: c.enrichment_data?.createdate || c.created_at,
    notes_last_updated: c.enrichment_data?.notes_last_updated || null,
    contactPhotoUrl: c.photo_url || null,
    contactTitle: c.title || null,
    hs_email_last_send_date: c.enrichment_data?.hs_email_last_send_date || null,
  }));

  // Build owner maps from contact data
  const owners: Record<string, string> = {};
  const ownerTeams: Record<string, { name: string; team: string | null; active: boolean }> = {};
  for (const c of rows || []) {
    if (c.hubspot_owner_id && c.enrichment_data?.owner_name) {
      owners[c.hubspot_owner_id] = c.enrichment_data.owner_name;
      if (!ownerTeams[c.hubspot_owner_id]) {
        ownerTeams[c.hubspot_owner_id] = { name: c.enrichment_data.owner_name, team: null, active: true };
      }
    }
  }

  return {
    contacts,
    owners,
    ownerTeams,
    statuses: LEAD_STATUSES,
  };
}

export function usePipelineLeads() {
  const query = useQuery({
    queryKey: ['pipeline-leads'],
    queryFn: fetchPipelineLeads,
  });
  return {
    contacts: query.data?.contacts ?? [],
    leadOwners: query.data?.owners ?? {},
    leadOwnerTeams: query.data?.ownerTeams ?? {},
    leadStatuses: query.data?.statuses ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

// ─── Pipeline Stats (computed from local deals table) ───────────────────────

async function fetchPipelineStats(pipelineId: string, ownerFilter?: string) {
  // Fetch closed deals for this pipeline to compute stats
  let query = supabase
    .from('deals')
    .select('amount, stage, close_date, created_at, hubspot_owner_id')
    .eq('pipeline', pipelineId)
    .in('status', ['won', 'lost', 'archived']);

  if (ownerFilter && ownerFilter !== 'all') {
    query = query.eq('hubspot_owner_id', ownerFilter);
  }

  const { data: closedDeals } = await query;

  if (!closedDeals || closedDeals.length === 0) {
    return { winRate: 0, avgCycle: 0, wonRevenue: 0, closedWonCount: 0, closedTotalCount: 0 };
  }

  const pipelineDef = PIPELINES[pipelineId];
  const wonStageIds = new Set(
    pipelineDef?.stages.filter(s => s.label.includes('Won')).map(s => s.id) || []
  );

  let wonRevenue = 0;
  let closedWonCount = 0;
  let totalCycleDays = 0;
  let cycleCount = 0;

  for (const d of closedDeals) {
    if (wonStageIds.has(d.stage)) {
      closedWonCount++;
      wonRevenue += parseFloat(d.amount) || 0;
      if (d.close_date && d.created_at) {
        const days = (new Date(d.close_date).getTime() - new Date(d.created_at).getTime()) / 86400000;
        if (days > 0) { totalCycleDays += days; cycleCount++; }
      }
    }
  }

  return {
    winRate: closedDeals.length > 0 ? Math.round((closedWonCount / closedDeals.length) * 100) : 0,
    avgCycle: cycleCount > 0 ? Math.round(totalCycleDays / cycleCount) : 0,
    wonRevenue,
    closedWonCount,
    closedTotalCount: closedDeals.length,
  };
}

export function usePipelineStats(pipelineId: string, ownerFilter: string) {
  const query = useQuery({
    queryKey: ['pipeline-stats', pipelineId, ownerFilter],
    queryFn: () => fetchPipelineStats(pipelineId, ownerFilter),
    enabled: !!pipelineId,
  });
  return {
    stats: query.data ?? null,
    loading: query.isLoading,
  };
}

export function useInvalidatePipeline() {
  const qc = useQueryClient();
  return {
    deals: (pipelineId?: string) => pipelineId
      ? qc.invalidateQueries({ queryKey: ['pipeline-deals', pipelineId] })
      : qc.invalidateQueries({ queryKey: ['pipeline-deals'] }),
    leads: () => qc.invalidateQueries({ queryKey: ['pipeline-leads'] }),
    stats: () => qc.invalidateQueries({ queryKey: ['pipeline-stats'] }),
    all: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-deals'] });
      qc.invalidateQueries({ queryKey: ['pipeline-leads'] });
      qc.invalidateQueries({ queryKey: ['pipeline-stats'] });
    },
  };
}
