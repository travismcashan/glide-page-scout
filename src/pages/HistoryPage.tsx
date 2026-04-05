import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessions, useInvalidateSessions } from '@/hooks/useCachedQueries';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Globe, Clock, Trash2, Share2, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Loader2, Users, ArrowRight, X } from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { supabase } from '@/integrations/supabase/client';
import { buildSitePath } from '@/lib/sessionSlug';
import { format } from 'date-fns';
import { toast } from 'sonner';
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
  company_name?: string | null;
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
  // Show pending/cancelled/failed as-is
  if (session.status === 'pending' || session.status === 'cancelled' || (session.status as string) === 'failed') {
    return session.status;
  }
  return session.status;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { sessions, domainCounts, loading, error } = useSessions();
  const invalidateSessions = useInvalidateSessions();

  // New crawl state
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crawlUrl.trim()) return;
    setIsStarting(true);
    try {
      const formattedUrl = crawlUrl.trim().startsWith('http') ? crawlUrl.trim() : `https://${crawlUrl.trim()}`;
      const domain = new URL(formattedUrl).hostname.replace(/^www\./i, '');

      // Auto-link to company: find or create by domain
      let companyId: string | null = null;
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('domain', domain)
        .limit(1)
        .maybeSingle();
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        // Create a new company from the domain
        const name = domain.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const { data: newCompany } = await supabase
          .from('companies')
          .insert({ name, domain, status: 'prospect' } as any)
          .select('id')
          .single();
        if (newCompany) companyId = newCompany.id;
      }

      // Create session as 'pending' — crawl-start will set 'analyzing' once pipeline is ready
      const { data: session, error: insertError } = await supabase
        .from('crawl_sessions')
        .insert({ domain, base_url: formattedUrl, status: 'pending', company_id: companyId } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      const { count } = await supabase
        .from('crawl_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('domain', domain);

      invalidateSessions();
      navigate(buildSitePath(domain, session.created_at, (count ?? 0) > 1));

      // Await crawl-start — if it fails, user gets a toast and session stays 'pending'
      const { error: startError } = await supabase.functions.invoke('crawl-start', {
        body: { session_id: session.id },
      });

      if (startError) {
        console.error('crawl-start invoke error:', startError);
        await supabase.from('crawl_sessions').update({ status: 'failed' } as any).eq('id', session.id);
        toast.error('Failed to start analysis pipeline — please try again');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to start analysis');
      setIsStarting(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<CrawlSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [integrationCounts, setIntegrationCounts] = useState<Map<string, number>>(new Map());

  // Bulk delete state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Search, sort, filter, group state
  const [search, setSearch] = useState('');
  const looksLikeUrl = /[a-z0-9][-a-z0-9]*\.[a-z]{2,}/i.test(crawlUrl.trim());
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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
  }, [sessions, search, statusFilter, sortKey, sortDir, integrationCounts]);

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
      invalidateSessions();
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
    invalidateSessions();
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
      className={`cursor-pointer hover:bg-accent/5 [&>td]:py-1.5 [&>td]:whitespace-nowrap${bulkMode && bulkSelected.has(session.id) ? ' bg-primary/5' : ''}`}
      onClick={() => {
        if (bulkMode) {
          toggleBulkSelect(session.id);
        } else {
          navigate(buildSitePath(session.domain, session.created_at, (domainCounts.get(session.domain) ?? 0) > 1));
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
      <TableCell className="max-w-[280px]">
        <div className="flex items-center gap-2.5 min-w-0 h-8">
          <Globe className="h-4 w-4 shrink-0 text-primary" />
          <div className="font-medium text-foreground truncate text-sm">{session.domain.replace(/^www\./, '')}</div>
        </div>
      </TableCell>
      <TableCell className="text-sm truncate max-w-[180px]">
        {(session as any).company_name ? (
          <span
            role="link"
            onClick={(e) => { e.stopPropagation(); navigate(`/companies/${session.company_id}`); }}
            className="text-primary hover:underline cursor-pointer truncate block"
          >
            {(session as any).company_name}
          </span>
        ) : (
          <span className="text-muted-foreground/30">--</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {format(new Date(session.created_at), 'MMM d, yyyy')}
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        <Badge variant={session.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 capitalize">
          {session.status === 'completed_with_errors' ? 'Partial' : session.status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm tabular-nums">
        {(() => {
          const psi = (session as any).psi_data;
          if (!psi?.categories) return <span className="text-muted-foreground/30">--</span>;
          const perf = psi.categories.performance?.score;
          if (perf == null) return <span className="text-muted-foreground/30">--</span>;
          const score = Math.round(perf * 100);
          return <span className={score >= 90 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'}>{score}</span>;
        })()}
      </TableCell>
    </TableRow>
  );

  return (
    <div>
      <main className="px-4 sm:px-6 py-6">
        {/* ── Row 1: Title + Count + Unified search/crawl input ── */}
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-2xl font-bold tracking-tight shrink-0">Crawls</h1>
          {!loading && (
            <Badge variant="secondary" className="text-sm px-2.5 py-0.5 tabular-nums shrink-0">
              {sessions.length}
            </Badge>
          )}

          <form onSubmit={(e) => { e.preventDefault(); if (looksLikeUrl) handleStartCrawl(e); }} className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={crawlUrl}
              onChange={(e) => { setCrawlUrl(e.target.value); setSearch(e.target.value); }}
              placeholder="Search or enter URL to crawl..."
              className="pl-8 pr-20 h-8 text-sm"
              disabled={isStarting}
            />
            {looksLikeUrl && crawlUrl.trim() && (
              <Button
                type="submit"
                disabled={isStarting || !crawlUrl.trim()}
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 rounded px-3 gap-1 text-xs shrink-0"
              >
                {isStarting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <><span>Crawl</span><ArrowRight className="h-3 w-3" /></>
                )}
              </Button>
            )}
            {crawlUrl && !looksLikeUrl && (
              <button type="button" onClick={() => { setCrawlUrl(''); setSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </form>

          <div className="flex-1" />

          <Select value={`${sortKey}_${sortDir}`} onValueChange={(v) => {
            const [k, d] = v.split('_') as [SortKey, SortDir];
            setSortKey(k); setSortDir(d);
          }}>
            <SelectTrigger className="w-fit h-8 text-sm">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest</SelectItem>
              <SelectItem value="date_asc">Oldest</SelectItem>
              <SelectItem value="domain_asc">Domain (A-Z)</SelectItem>
              <SelectItem value="domain_desc">Domain (Z-A)</SelectItem>
              <SelectItem value="status_asc">Status</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-fit h-8 text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map(s => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {bulkMode && (
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={processedSessions.length > 0 && bulkSelected.size === processedSessions.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                    )}
                    <TableHead
                      className="cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort('domain')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Domain
                        {sortKey === 'domain' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </span>
                    </TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort('date')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Date
                        {sortKey === 'date' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort('status')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Status
                        {sortKey === 'status' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </span>
                    </TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedSessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={bulkMode ? 6 : 5} className="text-center py-8 text-muted-foreground">
                        No sites match your search or filter.
                      </TableCell>
                    </TableRow>
                  )}

                  {groupedSessions ? (
                    Array.from(groupedSessions.entries()).map(([groupKey, items]) => (
                      <>
                        <TableRow key={`group-${groupKey}`} className="bg-muted/30 hover:bg-muted/40">
                          <TableCell colSpan={bulkMode ? 6 : 5} className="py-1.5">
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
