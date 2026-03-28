import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Globe, Clock, ExternalLink, Loader2, Trash2, ArrowRight, Search, History } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { buildSitePath } from '@/lib/sessionSlug';

interface GroupMember {
  id: string;
  session_id: string;
  priority: number;
  notes: string | null;
  domain: string;
  base_url: string;
  status: string;
  created_at: string;
}

interface IntegrationProgress {
  session_id: string;
  total: number;
  done: number;
}

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [progress, setProgress] = useState<Map<string, IntegrationProgress>>(new Map());
  const [loading, setLoading] = useState(true);

  // Add site dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<string>('existing');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [existingSessions, setExistingSessions] = useState<{ id: string; domain: string; created_at: string }[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [loadingExisting, setLoadingExisting] = useState(false);

  const fetchData = async () => {
    if (!groupId) return;

    const [{ data: groupData }, { data: memberRows }] = await Promise.all([
      supabase.from('site_groups').select('*').eq('id', groupId).single(),
      supabase.from('site_group_members').select('*').eq('group_id', groupId).order('priority', { ascending: true }),
    ]);

    if (!groupData) { setLoading(false); return; }
    setGroup(groupData);

    if (!memberRows?.length) { setMembers([]); setLoading(false); return; }

    const sessionIds = memberRows.map(m => m.session_id);
    const { data: sessions } = await supabase
      .from('crawl_sessions')
      .select('id, domain, base_url, status, created_at')
      .in('id', sessionIds);

    const sessionMap = new Map(sessions?.map(s => [s.id, s]) ?? []);

    const merged: GroupMember[] = memberRows
      .map(m => {
        const s = sessionMap.get(m.session_id);
        if (!s) return null;
        return {
          id: m.id,
          session_id: m.session_id,
          priority: m.priority ?? 0,
          notes: m.notes,
          domain: s.domain,
          base_url: s.base_url,
          status: s.status,
          created_at: s.created_at,
        };
      })
      .filter(Boolean) as GroupMember[];

    setMembers(merged);

    // Fetch integration_runs progress
    const { data: runs } = await supabase
      .from('integration_runs')
      .select('session_id, status')
      .in('session_id', sessionIds);

    const progMap = new Map<string, IntegrationProgress>();
    runs?.forEach(r => {
      const p = progMap.get(r.session_id) ?? { session_id: r.session_id, total: 0, done: 0 };
      p.total++;
      if (r.status === 'done' || r.status === 'failed') p.done++;
      progMap.set(r.session_id, p);
    });
    setProgress(progMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [groupId]);

  // Realtime subscription for integration_runs updates
  useEffect(() => {
    if (!members.length) return;
    const sessionIds = members.map(m => m.session_id);

    const channel = supabase
      .channel(`group-${groupId}-runs`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'integration_runs',
      }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (!row || !sessionIds.includes(row.session_id)) return;
        // Refetch progress
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [members.length, groupId]);

  // Fetch existing sessions when dialog opens on "existing" tab
  const fetchExistingSessions = async () => {
    setLoadingExisting(true);
    const memberSessionIds = members.map(m => m.session_id);
    const { data } = await supabase
      .from('crawl_sessions')
      .select('id, domain, created_at')
      .neq('domain', '__global_chat__')
      .order('created_at', { ascending: false })
      .limit(100);

    // Filter out sessions already in the group
    const filtered = (data ?? []).filter(s => !memberSessionIds.includes(s.id));
    setExistingSessions(filtered);
    setLoadingExisting(false);
  };

  useEffect(() => {
    if (addOpen && addTab === 'existing') {
      fetchExistingSessions();
      setSelectedSessionIds(new Set());
    }
  }, [addOpen, addTab]);

  const toggleSession = (id: string) => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAddExisting = async () => {
    if (!groupId || selectedSessionIds.size === 0) return;
    setAdding(true);
    try {
      const rows = Array.from(selectedSessionIds).map(session_id => ({
        group_id: groupId,
        session_id,
      }));
      const { error } = await supabase.from('site_group_members').insert(rows);
      if (error) throw error;
      toast.success(`Added ${selectedSessionIds.size} site${selectedSessionIds.size > 1 ? 's' : ''} to group`);
      setAddOpen(false);
      setSelectedSessionIds(new Set());
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add sites');
    } finally {
      setAdding(false);
    }
  };

  const handleAddSite = async () => {
    if (!newUrl.trim() || !groupId) return;
    setAdding(true);
    try {
      const formattedUrl = newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`;
      const domain = new URL(formattedUrl).hostname;

      const { data: session, error: sessErr } = await supabase
        .from('crawl_sessions')
        .insert({ domain, base_url: formattedUrl, status: 'analyzing' } as any)
        .select()
        .single();

      if (sessErr) throw sessErr;

      const { error: memErr } = await supabase
        .from('site_group_members')
        .insert({ group_id: groupId, session_id: session.id });

      if (memErr) throw memErr;

      supabase.functions.invoke('crawl-start', {
        body: { session_id: session.id },
      }).catch(err => console.error('crawl-start error:', err));

      toast.success(`Started analyzing ${domain}`);
      setAddOpen(false);
      setNewUrl('');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add site');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from('site_group_members').delete().eq('id', memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    toast.success('Site removed from group');
  };

  const completedCount = members.filter(m => {
    const p = progress.get(m.session_id);
    return p && p.total > 0 && p.done === p.total;
  }).length;

  // Multi-domain detection for proper URL building
  const domainCounts = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach(m => counts.set(m.domain, (counts.get(m.domain) ?? 0) + 1));
    return counts;
  }, [members]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Group not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
            {group.description && (
              <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {members.length} site{members.length !== 1 ? 's' : ''}
              {members.length > 0 && ` · ${completedCount}/${members.length} complete`}
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Add Site
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Site to Group</DialogTitle>
              </DialogHeader>
              <Tabs value={addTab} onValueChange={setAddTab} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="existing" className="flex-1 gap-1.5">
                    <History className="h-3.5 w-3.5" /> Existing Sites
                  </TabsTrigger>
                  <TabsTrigger value="new" className="flex-1 gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> New URL
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="mt-4 space-y-4">
                  {loadingExisting ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : existingSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No available sites to add.
                    </p>
                  ) : (
                    <ScrollArea className="h-[280px] -mx-1 px-1">
                      <div className="space-y-1">
                        {existingSessions.map(s => (
                          <label
                            key={s.id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedSessionIds.has(s.id)}
                              onCheckedChange={() => toggleSession(s.id)}
                            />
                            <Globe className="h-4 w-4 shrink-0 text-primary/60" />
                            <span className="text-sm font-medium flex-1 truncate">{s.domain}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(s.created_at), 'MMM d, yyyy')}
                            </span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  <DialogFooter>
                    <Button
                      onClick={handleAddExisting}
                      disabled={selectedSessionIds.size === 0 || adding}
                      className="gap-2"
                    >
                      {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                      Add {selectedSessionIds.size || ''} Site{selectedSessionIds.size !== 1 ? 's' : ''}
                    </Button>
                  </DialogFooter>
                </TabsContent>

                <TabsContent value="new" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">URL</label>
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        placeholder="Enter a URL to analyze…"
                        value={newUrl}
                        onChange={e => setNewUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddSite()}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddSite} disabled={!newUrl.trim() || adding} className="gap-2">
                      {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                      Add & Analyze
                    </Button>
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

        {/* Members list */}
        {members.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Globe className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">No sites in this group yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {members.map(m => {
              const p = progress.get(m.session_id);
              const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              const isComplete = p && p.total > 0 && p.done === p.total;
              const needsTimestamp = (domainCounts.get(m.domain) ?? 0) > 1;

              return (
                <div
                  key={m.id}
                  className="flex items-center gap-4 px-5 py-4 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 shrink-0 text-primary/60" />
                      <span className="text-sm font-medium truncate">{m.domain}</span>
                      {!isComplete && p && p.total > 0 && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {pct}%
                        </span>
                      )}
                      {isComplete && (
                        <span className="text-xs text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                          Complete
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1 ml-6">
                      <Clock className="h-3 w-3" />
                      {format(new Date(m.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => navigate(buildSitePath(m.domain, m.created_at, needsTimestamp))}
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveMember(m.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
