/**
 * Cached TanStack Query hooks for commonly accessed data.
 * All follow the same pattern: fetch once, serve from memory for 5 min,
 * revalidate in background after stale, cache lives for 30 min.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withQueryTimeout } from '@/lib/queryTimeout';

// ─── Sites (HistoryPage) ─────────────────────────────────────────────────────

async function fetchSessions() {
  const { data, error } = await withQueryTimeout(
    supabase
      .from('crawl_sessions')
      .select('id, domain, base_url, status, created_at')
      .not('domain', 'like', '_\\_%')
      .order('created_at', { ascending: false }),
    12000,
    'Loading sites timed out',
  );
  if (error) throw error;
  const sessions = (data ?? []) as any[];

  // Domain counts
  const domainCounts = new Map<string, number>();
  sessions.forEach(s => domainCounts.set(s.domain, (domainCounts.get(s.domain) ?? 0) + 1));

  // Doc counts + group memberships (fire in parallel)
  const sessionIds = sessions.map(d => d.id);
  let docCounts = new Map<string, number>(sessions.map(s => [s.id, 0]));
  let sessionGroups = new Map<string, { id: string; name: string }[]>();

  if (sessionIds.length > 0) {
    const [docsRes, membersRes] = await Promise.all([
      withQueryTimeout(
        supabase.from('knowledge_documents').select('session_id').in('session_id', sessionIds),
        12000, 'Loading file counts timed out',
      ),
      supabase.from('site_group_members').select('session_id, group_id, site_groups(id, name)').in('session_id', sessionIds),
    ]);

    if (docsRes.data) {
      docCounts = new Map(sessions.map(s => [s.id, 0]));
      docsRes.data.forEach((d: any) => docCounts.set(d.session_id, (docCounts.get(d.session_id) ?? 0) + 1));
    }

    if (membersRes.data) {
      for (const m of membersRes.data as any[]) {
        const group = m.site_groups;
        if (!group) continue;
        const existing = sessionGroups.get(m.session_id) || [];
        existing.push({ id: group.id, name: group.name });
        sessionGroups.set(m.session_id, existing);
      }
    }
  }

  return { sessions, domainCounts, docCounts, sessionGroups };
}

export function useSessions() {
  const query = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
  });

  return {
    sessions: query.data?.sessions ?? [],
    domainCounts: query.data?.domainCounts ?? new Map<string, number>(),
    docCounts: query.data?.docCounts ?? new Map<string, number>(),
    sessionGroups: query.data?.sessionGroups ?? new Map<string, { id: string; name: string }[]>(),
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

// ─── Pipeline Deals (PipelinePage) ───────────────────────────────────────────

async function fetchPipelineDeals(pipelineId: string) {
  const { data, error } = await supabase.functions.invoke('hubspot-pipeline', {
    body: { action: 'deals', pipeline: pipelineId },
  });
  if (error) {
    // Extract readable error
    let msg = 'Failed to load deals';
    try {
      const body = typeof error === 'object' && (error as any)?.context?.body
        ? await new Response((error as any).context.body).text()
        : null;
      if (body) { const parsed = JSON.parse(body); msg = parsed.error || msg; }
    } catch {}
    if (msg.includes('429') || msg.includes('TOO_MANY')) msg = 'HubSpot rate limit reached. Try again in a few minutes.';
    else if (msg.includes('401') || msg.includes('UNAUTHORIZED')) msg = 'HubSpot access token expired. Contact admin to refresh.';
    else if (msg.includes('403')) msg = 'HubSpot permissions error. The API token may not have deal access.';
    throw new Error(msg);
  }
  return data;
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

async function fetchPipelineLeads() {
  const { data, error } = await supabase.functions.invoke('hubspot-pipeline', {
    body: { action: 'leads' },
  });
  if (error) {
    let msg = 'Failed to load leads';
    try {
      const body = typeof error === 'object' && (error as any)?.context?.body
        ? await new Response((error as any).context.body).text()
        : null;
      if (body) { const parsed = JSON.parse(body); msg = parsed.error || msg; }
    } catch {}
    if (msg.includes('429') || msg.includes('TOO_MANY')) msg = 'HubSpot rate limit reached. Try again in a few minutes.';
    throw new Error(msg);
  }
  return data;
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

async function fetchPipelineStats(pipelineId: string, ownerFilter?: string) {
  const body: any = { action: 'stats', pipeline: pipelineId };
  if (ownerFilter && ownerFilter !== 'all') body.ownerFilter = ownerFilter;
  const { data, error } = await supabase.functions.invoke('hubspot-pipeline', { body });
  if (error) throw error;
  return data as { winRate: number; avgCycle: number; wonRevenue: number; closedWonCount: number; closedTotalCount: number } | null;
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
