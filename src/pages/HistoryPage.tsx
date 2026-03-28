import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Globe, Clock, Trash2, Share2, Database, FileText, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildSitePath } from '@/lib/sessionSlug';
import { format } from 'date-fns';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const INTEGRATION_KEYS = [
  'psi_data','wappalyzer_data','builtwith_data','carbon_data','crux_data',
  'wave_data','observatory_data','ocean_data','ssllabs_data','httpstatus_data',
  'linkcheck_data','w3c_data','schema_data','readable_data','yellowlab_data',
  'semrush_data','nav_structure','content_types_data','page_tags','sitemap_data',
  'forms_data','tech_analysis_data','deep_research_data','observations_data',
  'avoma_data','apollo_data','hubspot_data','gmail_data','apollo_team_data',
  'ga4_data','search_console_data','detectzestack_data',
] as const;

type SortKey = 'domain' | 'integrations' | 'files' | 'date' | 'status';
type SortDir = 'asc' | 'desc';
type GroupBy = 'none' | 'domain' | 'status';
const HISTORY_COUNT_BATCH_SIZE = 12;

function resolveStatus(session: CrawlSession): string {
  if (session.status === 'analyzing' && Date.now() - new Date(session.created_at).getTime() > 10 * 60 * 1000) {
    return 'completed';
  }
  return session.status;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function countLoadedIntegrations(session: Record<string, unknown>): number {
  let count = 0;

  for (const key of INTEGRATION_KEYS) {
    if (session[key] != null) count += 1;
  }

  return count;
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

  // Search, sort, filter, group state
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const fetchSessions = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('crawl_sessions')
        .select('id, domain, base_url, status, created_at')
        .neq('domain', '__global_chat__')
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error('Failed to load crawl history:', error);
        setError('Failed to load crawl history. Please refresh and try again.');
        setSessions([]);
        setIntegrationCounts(new Map());
        setDocCounts(new Map());
        setMultiDomains(new Map());
        setLoading(false);
      } else {
        const data_ = (data ?? []) as CrawlSession[];
        setSessions(data_);

        const domainCounts = new Map<string, number>();
        data_.forEach(s => {
          domainCounts.set(s.domain, (domainCounts.get(s.domain) ?? 0) + 1);
        });
        setMultiDomains(domainCounts);
        setIntegrationCounts(new Map(data_.map((session) => [session.id, 0] as const)));
        setDocCounts(new Map(data_.map((session) => [session.id, 0] as const)));
        setLoading(false);

        const sessionIds = data_.map(d => d.id);
        if (sessionIds.length > 0) {
          void (async () => {
            const { data: docs, error: docsError } = await supabase
              .from('knowledge_documents')
              .select('session_id')
              .in('session_id', sessionIds);

            if (cancelled) return;
            if (docsError) {
              console.error('Failed to load knowledge file counts:', docsError);
              return;
            }

            const dCounts = new Map<string, number>(data_.map((session) => [session.id, 0] as const));
            (docs ?? []).forEach(d => dCounts.set(d.session_id, (dCounts.get(d.session_id) ?? 0) + 1));
            setDocCounts(dCounts);
          })();

          void (async () => {
            for (const batchIds of chunkArray(sessionIds, HISTORY_COUNT_BATCH_SIZE)) {
              const { data: countBatch, error: countError } = await supabase
                .from('crawl_sessions')
                .select(`id, ${INTEGRATION_KEYS.join(',')}`)
                .in('id', batchIds);

              if (cancelled) return;
              if (countError) {
                console.error('Failed to load integration counts:', countError);
                return;
              }

              setIntegrationCounts((prev) => {
                const next = new Map(prev);
                const countRows = ((countBatch ?? []) as unknown[]) as Array<Record<string, unknown> & { id: string }>;

                countRows.forEach((session) => {
                  next.set(session.id, countLoadedIntegrations(session));
                });

                return next;
              });
            }
          })();
        } else {
          setLoading(false);
        }
      }
    };

    fetchSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  // Unique statuses for filter
  const statuses = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => set.add(resolveStatus(s)));
    return Array.from(set).sort();
  }, [sessions]);

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
      list = list.filter(s => resolveStatus(s) === statusFilter);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'domain': cmp = a.domain.localeCompare(b.domain); break;
        case 'integrations': cmp = (integrationCounts.get(a.id) ?? 0) - (integrationCounts.get(b.id) ?? 0); break;
        case 'files': cmp = (docCounts.get(a.id) ?? 0) - (docCounts.get(b.id) ?? 0); break;
        case 'date': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case 'status': cmp = resolveStatus(a).localeCompare(resolveStatus(b)); break;
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
      const key = groupBy === 'domain' ? s.domain : resolveStatus(s);
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

  const renderRow = (session: CrawlSession) => (
    <TableRow
      key={session.id}
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => navigate(buildSitePath(session.domain, session.created_at, (multiDomains.get(session.domain) ?? 0) > 1))}
    >
      <TableCell>
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-medium">{session.domain}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1 text-muted-foreground">
          <Database className="h-3 w-3" />
          <span className="text-xs font-mono">{integrationCounts.get(session.id) ?? 0}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1 text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="text-xs font-mono">{docCounts.get(session.id) ?? 0}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
          <Clock className="h-3 w-3" />
          {format(new Date(session.created_at), 'MMM d, yyyy h:mm a')}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={resolveStatus(session) === 'completed' ? 'default' : 'secondary'}>
          {resolveStatus(session)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
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
      </TableCell>
    </TableRow>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Sites</h1>

        {loading ? (
          <p className="py-16 text-center text-muted-foreground">Loading...</p>
        ) : error ? (
          <div className="py-16 text-center">
            <Globe className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
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
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40%]">
                      <button onClick={() => toggleSort('domain')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Domain <SortIcon col="domain" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button onClick={() => toggleSort('integrations')} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                        Integrations <SortIcon col="integrations" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button onClick={() => toggleSort('files')} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                        Files <SortIcon col="files" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Date <SortIcon col="date" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button onClick={() => toggleSort('status')} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                        Status <SortIcon col="status" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedSessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No sites match your search or filter.
                      </TableCell>
                    </TableRow>
                  )}

                  {groupedSessions ? (
                    Array.from(groupedSessions.entries()).map(([groupKey, items]) => (
                      <>
                        <TableRow key={`group-${groupKey}`} className="bg-muted/30 hover:bg-muted/40">
                          <TableCell colSpan={6} className="py-1.5">
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
    </div>
  );
}
