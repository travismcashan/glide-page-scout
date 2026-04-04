import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Globe, Clock, Trash2, Share2, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Loader2, Users } from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { supabase } from '@/integrations/supabase/client';
import { buildSitePath } from '@/lib/sessionSlug';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { withQueryTimeout } from '@/lib/queryTimeout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type CrawlSession = {
  id: string;
  domain: string;
  base_url: string;
  status: string;
  created_at: string;
};

type SortKey = 'domain' | 'date' | 'status';
type SortDir = 'asc' | 'desc';
type GroupBy = 'none' | 'domain' | 'status';

const TOTAL_INTEGRATIONS = 27;

function resolveStatus(session: CrawlSession, integrationCount?: number): string {
  if (integrationCount !== undefined && integrationCount >= TOTAL_INTEGRATIONS) {
    return 'completed';
  }
  if (session.status === 'analyzing' && Date.now() - new Date(session.created_at).getTime() > 10 * 60 * 1000) {
    return 'completed';
  }
  return session.status;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<CrawlSession[]>([]);
  const [multiDomains, setMultiDomains] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrawlSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [integrationCounts, setIntegrationCounts] = useState<Map<string, number>>(new Map());
  const [docCounts, setDocCounts] = useState<Map<string, number>>(new Map());
  const [sessionGroups, setSessionGroups] = useState<Map<string, { id: string; name: string }[]>>(new Map());

  // Bulk delete state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Search, sort, filter, group state
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await withQueryTimeout(
        supabase
          .from('crawl_sessions')
          .select('id, domain, base_url, status, created_at')
          .not('domain', 'like', '_\\_%')
          .order('created_at', { ascending: false }),
        12000,
        'Loading sites timed out'
      );

      if (error) {
        throw error;
      }

      const data_ = (data ?? []) as CrawlSession[];
      setSessions(data_);

      const domainCounts = new Map<string, number>();
      data_.forEach(s => {
        domainCounts.set(s.domain, (domainCounts.get(s.domain) ?? 0) + 1);
      });
      setMultiDomains(domainCounts);
      setIntegrationCounts(new Map());
      setDocCounts(new Map(data_.map((session) => [session.id, 0] as const)));
      setLoading(false);

      const sessionIds = data_.map(d => d.id);
      if (sessionIds.length > 0) {
        void (async () => {
          try {
            const { data: docs, error: docsError } = await withQueryTimeout(
              supabase
                .from('knowledge_documents')
                .select('session_id')
                .in('session_id', sessionIds),
              12000,
              'Loading file counts timed out'
            );

            if (docsError) {
              throw docsError;
            }

            const dCounts = new Map<string, number>(data_.map((session) => [session.id, 0] as const));
            (docs ?? []).forEach(d => dCounts.set(d.session_id, (dCounts.get(d.session_id) ?? 0) + 1));
            setDocCounts(dCounts);
          } catch (docsError) {
            console.error('Failed to load knowledge file counts:', docsError);
          }
        })();

        // Load group memberships
        void (async () => {
          try {
            const { data: members } = await supabase
              .from('site_group_members')
              .select('session_id, group_id, site_groups(id, name)')
              .in('session_id', sessionIds);
            if (members) {
              const groupMap = new Map<string, { id: string; name: string }[]>();
              for (const m of members as any[]) {
                const group = m.site_groups;
                if (!group) continue;
                const existing = groupMap.get(m.session_id) || [];
                existing.push({ id: group.id, name: group.name });
                groupMap.set(m.session_id, existing);
              }
              setSessionGroups(groupMap);
            }
          } catch { /* optional */ }
        })();

        void (async () => {
          try {
            const { data: counts, error: countError } = await withQueryTimeout(
              (supabase.rpc as any)('count_integrations', { session_ids: sessionIds }),
              12000,
              'Loading integration counts timed out'
            );

            if (countError) {
              throw countError;
            }

            const intCounts = new Map<string, number>();
            ((counts ?? []) as unknown as Array<{ session_id: string; integration_count: number }>).forEach(r => {
              intCounts.set(r.session_id, r.integration_count);
            });
            setIntegrationCounts(intCounts);
          } catch (err) {
            console.error('Integration count RPC failed:', err);
          }
        })();
      }
    } catch (error) {
      console.error('Failed to load crawl history:', error);
      setError('Failed to load crawl history. Please refresh and try again.');
      setSessions([]);
      setIntegrationCounts(new Map());
      setDocCounts(new Map());
      setMultiDomains(new Map());
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Unique statuses for filter
  const statuses = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => set.add(resolveStatus(s, integrationCounts.get(s.id))));
    return Array.from(set).sort();
  }, [sessions, integrationCounts]);

  // Filtered + sorted sessions
  const processedSessions = useMemo(() => {
    let list = [...sessions];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.domain.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(s => resolveStatus(s, integrationCounts.get(s.id)) === statusFilter);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'domain': cmp = a.domain.localeCompare(b.domain); break;
        case 'date': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case 'status': cmp = resolveStatus(a, integrationCounts.get(a.id)).localeCompare(resolveStatus(b, integrationCounts.get(b.id))); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [sessions, search, statusFilter, sortKey, sortDir, integrationCounts, docCounts]);

  // Grouped sessions
  const groupedSessions = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = new Map<string, CrawlSession[]>();
    for (const s of processedSessions) {
      const key = groupBy === 'domain' ? s.domain : resolveStatus(s, integrationCounts.get(s.id));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return groups;
  }, [processedSessions, groupBy]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const sid = deleteTarget.id;

    const deletes = await Promise.all([
      supabase.from('crawl_pages').delete().eq('session_id', sid),
      supabase.from('crawl_screenshots').delete().eq('session_id', sid),
      supabase.from('knowledge_chunks').delete().eq('session_id', sid),
      supabase.from('knowledge_documents').delete().eq('session_id', sid),
      supabase.from('knowledge_messages').delete().eq('session_id', sid),
      supabase.from('knowledge_favorites').delete().eq('session_id', sid),
      supabase.from('chat_threads').delete().eq('session_id', sid),
    ]);

    const childError = deletes.find(r => r.error);
    if (childError?.error) {
      console.error('Failed to delete related data:', childError.error);
      toast.error('Failed to delete crawl. Please try again.');
      setDeleting(false);
      setDeleteTarget(null);
      return;
    }

    const { error: sessionError } = await supabase.from('crawl_sessions').delete().eq('id', sid);
    if (sessionError) {
      console.error('Failed to delete session:', sessionError);
      toast.error('Failed to delete crawl session.');
    } else {
      setSessions(prev => {
        const next = prev.filter(s => s.id !== sid);
        const domainCounts = new Map<string, number>();
        next.forEach(s => domainCounts.set(s.domain, (domainCounts.get(s.domain) ?? 0) + 1));
        setMultiDomains(domainCounts);
        return next;
      });
      toast.success(`Deleted crawl for ${deleteTarget.domain}`);
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    for (const id of bulkSelected) {
      try {
        await supabase.from('crawl_pages').delete().eq('session_id', id);
        await supabase.from('crawl_screenshots').delete().eq('session_id', id);
        await supabase.from('integration_runs').delete().eq('session_id', id);
        await supabase.from('knowledge_documents').delete().eq('session_id', id);
        await supabase.from('site_group_members').delete().eq('session_id', id);
        await supabase.from('crawl_sessions').delete().eq('id', id);
      } catch (e) { console.error('Failed to delete session:', id, e); }
    }
    toast.success(`Deleted ${bulkSelected.size} site${bulkSelected.size !== 1 ? 's' : ''}`);
    setBulkSelected(new Set());
    setBulkMode(false);
    setBulkDeleteOpen(false);
    setBulkDeleting(false);
    fetchSessions();
  };

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (bulkSelected.size === processedSessions.length) setBulkSelected(new Set());
    else setBulkSelected(new Set(processedSessions.map(s => s.id)));
  };

  const renderRow = (session: CrawlSession) => (
    <TableRow
      key={session.id}
      className={`cursor-pointer hover:bg-muted/50 transition-colors${bulkMode && bulkSelected.has(session.id) ? ' bg-primary/5' : ''}`}
      onClick={() => {
        if (bulkMode) {
          toggleBulkSelect(session.id);
        } else {
          navigate(buildSitePath(session.domain, session.created_at, (multiDomains.get(session.domain) ?? 0) > 1));
        }
      }}
    >
      {bulkMode && (
        <TableCell className="w-10 pl-4">
          <Checkbox
            checked={bulkSelected.has(session.id)}
            onCheckedChange={() => toggleBulkSelect(session.id)}
            onClick={e => e.stopPropagation()}
          />
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-medium">{session.domain.replace(/^www\./, '')}</span>
        </div>
      </TableCell>
      <TableCell>
        {sessionGroups.get(session.id)?.map(g => (
          <Badge
            key={g.id}
            variant="outline"
            className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-muted/50"
            onClick={(e) => { e.stopPropagation(); navigate(`/lists/${g.id}`); }}
          >
            {g.name}
          </Badge>
        ))}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
          <Clock className="h-3 w-3" />
          {format(new Date(session.created_at), 'MMM d, yyyy h:mm a')}
        </div>
      </TableCell>
      <TableCell className="text-center">
        {resolveStatus(session, integrationCounts.get(session.id)) === 'completed' ? (
          <Badge variant="default">completed</Badge>
        ) : (
          <Badge variant="secondary">{integrationCounts.get(session.id) ? Math.round((integrationCounts.get(session.id)! / TOTAL_INTEGRATIONS) * 100) : 0}%</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        {!bulkMode && (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const path = buildSitePath(session.domain, session.created_at, (multiDomains.get(session.domain) ?? 0) > 1);
                const url = `${window.location.origin}${path}?view=shared`;
                navigator.clipboard.writeText(url);
                toast.success('View-only link copied to clipboard');
              }}
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
              title="Copy share link"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(session);
              }}
              className="p-1.5 rounded-md text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete crawl"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <div>
      <main className="px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Sites</h1>
          <p className="text-sm text-muted-foreground mt-1">Previously analyzed websites and crawl history.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 animate-in fade-in duration-300">
            <BrandLoader size={96} />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <Globe className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <Globe className="h-12 w-12 mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground">No crawls yet. Start by entering a URL!</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search domains…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={groupBy} onValueChange={(v) => { setGroupBy(v as GroupBy); setCollapsedGroups(new Set()); }}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="No grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  <SelectItem value="domain">Group by domain</SelectItem>
                  <SelectItem value="status">Group by status</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-xs text-muted-foreground ml-auto">
                {processedSessions.length} of {sessions.length} sites
              </span>

              {bulkMode ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={bulkSelected.size === 0}
                    onClick={() => setBulkDeleteOpen(true)}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete ({bulkSelected.size})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setBulkMode(false); setBulkSelected(new Set()); }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkMode(true)}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Bulk Delete
                </Button>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {bulkMode && (
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={processedSessions.length > 0 && bulkSelected.size === processedSessions.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                    )}
                    <TableHead className="w-[40%]">
                      <button onClick={() => toggleSort('domain')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Domain <SortIcon col="domain" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">Group</span>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Date <SortIcon col="date" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Status <SortIcon col="status" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedSessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={bulkMode ? 7 : 6} className="text-center py-8 text-muted-foreground">
                        No sites match your search or filter.
                      </TableCell>
                    </TableRow>
                  )}

                  {groupedSessions ? (
                    Array.from(groupedSessions.entries()).map(([groupKey, items]) => (
                      <>
                        <TableRow key={`group-${groupKey}`} className="bg-muted/30 hover:bg-muted/40">
                          <TableCell colSpan={bulkMode ? 7 : 6} className="py-1.5">
                            <button
                              onClick={() => toggleGroup(groupKey)}
                              className="flex items-center gap-2 text-xs font-semibold text-foreground w-full"
                            >
                              {collapsedGroups.has(groupKey)
                                ? <ChevronRight className="h-3.5 w-3.5" />
                                : <ChevronDown className="h-3.5 w-3.5" />
                              }
                              {groupKey}
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{items.length}</Badge>
                            </button>
                          </TableCell>
                        </TableRow>
                        {!collapsedGroups.has(groupKey) && items.map(renderRow)}
                      </>
                    ))
                  ) : (
                    processedSessions.map(renderRow)
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete crawl?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the crawl for <strong>{deleteTarget?.domain}</strong> and all associated data (pages, screenshots, chat history, knowledge documents). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => !open && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {bulkSelected.size} site{bulkSelected.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected sites and all associated data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ScrollArea className="max-h-[200px] my-2">
            <div className="space-y-1 text-xs text-muted-foreground px-1">
              {sessions.filter(s => bulkSelected.has(s.id)).map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <Globe className="h-3 w-3 shrink-0" />
                  {s.domain}
                </div>
              ))}
            </div>
          </ScrollArea>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {bulkDeleting ? 'Deleting…' : `Delete ${bulkSelected.size} Site${bulkSelected.size !== 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
