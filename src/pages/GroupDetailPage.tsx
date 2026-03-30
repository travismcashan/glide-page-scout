import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Plus, Globe, Clock, ArrowRight, Loader2, Trash2, Search, History, BarChart3, Cpu, Gauge, Sparkles, ChevronDown, ChevronUp, Settings2, ChevronRight, Share2, Check, AlertTriangle } from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { buildSitePath } from '@/lib/sessionSlug';
import { GroupScoreGrid } from '@/components/groups/GroupScoreGrid';
import { GroupTechMatrix } from '@/components/groups/GroupTechMatrix';
import { GroupPerformanceChart } from '@/components/groups/GroupPerformanceChart';

// ── Types ──────────────────────────────────────────────────────

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

// ── Data columns used to calculate real progress ──────────────
const DATA_COLUMNS = [
  'builtwith_data', 'semrush_data', 'psi_data', 'detectzestack_data',
  'gtmetrix_scores', 'carbon_data', 'crux_data', 'wave_data',
  'observatory_data', 'httpstatus_data', 'w3c_data', 'schema_data',
  'readable_data', 'yellowlab_data', 'ocean_data', 'hubspot_data',
  'sitemap_data', 'nav_structure', 'discovered_urls',
  'tech_analysis_data', 'avoma_data', 'apollo_data',
  'content_types_data', 'forms_data', 'linkcheck_data',
  'apollo_team_data',
  'page_tags',
];

// ── Map integration_key → db column (must match crawl-start INTEGRATIONS) ──
const KEY_TO_COLUMN: Record<string, string> = {
  'builtwith': 'builtwith_data', 'semrush': 'semrush_data', 'psi': 'psi_data',
  'detectzestack': 'detectzestack_data', 'gtmetrix': 'gtmetrix_scores',
  'carbon': 'carbon_data', 'crux': 'crux_data', 'wave': 'wave_data',
  'observatory': 'observatory_data', 'httpstatus': 'httpstatus_data',
  'w3c': 'w3c_data', 'schema': 'schema_data', 'readable': 'readable_data',
  'yellowlab': 'yellowlab_data', 'ocean': 'ocean_data', 'hubspot': 'hubspot_data',
  'sitemap': 'sitemap_data', 'nav-structure': 'nav_structure',
  'firecrawl-map': 'discovered_urls', 'tech-analysis': 'tech_analysis_data',
  'avoma': 'avoma_data', 'apollo': 'apollo_data',
  'content-types': 'content_types_data', 'forms': 'forms_data',
  'link-checker': 'linkcheck_data', 'apollo-team': 'apollo_team_data',
  'page-tags': 'page_tags',
};

// ── Integration categories for the picker ─────────────────────
const INTEGRATION_CATEGORIES = [
  {
    name: 'URL Analysis', keys: [
      { key: 'httpstatus', label: 'HTTP Status & Redirects' },
      { key: 'sitemap', label: 'Sitemap Parse' },
      { key: 'firecrawl-map', label: 'URL Discovery' },
      { key: 'nav-structure', label: 'Navigation Extract' },
    ],
  },
  {
    name: 'Content Analysis', keys: [
      { key: 'content-types', label: 'Content Types' },
      { key: 'page-tags', label: 'Page Tagging' },
      { key: 'forms', label: 'Forms Detection' },
      { key: 'readable', label: 'Readability' },
      { key: 'schema', label: 'Schema.org Validation' },
      { key: 'link-checker', label: 'Link Checker' },
    ],
  },
  {
    name: 'Design Analysis', keys: [
      { key: 'yellowlab', label: 'Yellow Lab Tools' },
    ],
  },
  {
    name: 'Technology Detection', keys: [
      { key: 'builtwith', label: 'BuiltWith' },
      { key: 'detectzestack', label: 'DetectZeStack' },
      { key: 'tech-analysis', label: 'AI Tech Analysis' },
    ],
  },
  {
    name: 'Performance & Sustainability', keys: [
      { key: 'psi', label: 'PageSpeed Insights' },
      { key: 'gtmetrix', label: 'GTmetrix' },
      { key: 'crux', label: 'CrUX Field Data' },
      { key: 'carbon', label: 'Website Carbon' },
      { key: 'semrush', label: 'SEMrush' },
    ],
  },
  {
    name: 'Security & Compliance', keys: [
      { key: 'wave', label: 'WAVE Accessibility' },
      { key: 'w3c', label: 'W3C Validation' },
      { key: 'observatory', label: 'Mozilla Observatory' },
    ],
  },
  {
    name: 'Enrichment & Prospecting', keys: [
      { key: 'apollo', label: 'Apollo.io' },
      { key: 'apollo-team', label: 'Apollo Team Search' },
      { key: 'hubspot', label: 'HubSpot' },
      { key: 'ocean', label: 'Ocean.io' },
      { key: 'avoma', label: 'Avoma' },
    ],
  },
];

// ── Flat key → label map built from INTEGRATION_CATEGORIES ───
const KEY_TO_LABEL: Record<string, string> = {};
INTEGRATION_CATEGORIES.forEach(c => c.keys.forEach(k => { KEY_TO_LABEL[k.key] = k.label; }));

// ── Integration run type for per-session tracking ────────────
type IntegrationRun = { integration_key: string; status: string };

// ── Sites Tab (member list) ────────────────────────────────────

function SitesTab({
  members,
  progress,
  integrationRuns,
  domainCounts,
  onRemove,
  onNavigate,
}: {
  members: GroupMember[];
  progress: Map<string, IntegrationProgress>;
  integrationRuns: Map<string, IntegrationRun[]>;
  domainCounts: Map<string, number>;
  onRemove: (id: string) => void;
  onNavigate: (m: GroupMember) => void;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <Globe className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">No sites in this group yet. Add one to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Domain</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map(m => {
            const p = progress.get(m.session_id);
            const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
            const isComplete = (p && p.total > 0 && p.done === p.total) || m.status === 'completed' || m.status === 'completed_with_errors';
            const runs = integrationRuns?.get(m.session_id) ?? [];
            const hasErrors = m.status === 'completed_with_errors' || runs.some(r => r.status === 'failed');
            const isExpanded = expandedRows.has(m.id);
            const sortedRuns = [...runs].sort((a, b) => {
              const order: Record<string, number> = { done: 0, failed: 1, running: 2, pending: 3, skipped: 4 };
              return (order[a.status] ?? 3) - (order[b.status] ?? 3);
            });

            return (
              <Fragment key={m.id}>
                <TableRow
                  className={`cursor-pointer relative overflow-hidden ${!isComplete && p && p.total > 0 ? 'border-b-0' : ''}`}
                  onClick={() => onNavigate(m)}
                >
                  <TableCell className="w-8 px-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      onClick={e => { e.stopPropagation(); toggleExpand(m.id); }}
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 shrink-0 text-primary/60" />
                      <span className="text-sm font-medium truncate">{m.domain}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(m.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {isComplete
                      ? hasErrors
                        ? <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">completed with errors</Badge>
                        : <Badge variant="default">completed</Badge>
                      : m.status === 'queued'
                        ? <Badge variant="outline" className="text-muted-foreground">queued</Badge>
                        : p && p.total > 0
                          ? <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                          : null}
                    {/* Full-width rainbow progress bar at bottom of row */}
                    {!isComplete && p && p.total > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-border/50">
                        <div
                          className="h-full transition-all duration-700 ease-out"
                          style={{
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)',
                            backgroundSize: '200% auto',
                            animation: 'rainbow-shift 8s linear infinite',
                          }}
                        />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(window.location.origin + '/' + m.domain); }}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={e => { e.stopPropagation(); onRemove(m.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && runs.length > 0 && (
                  <TableRow key={`${m.id}-capsules`} className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-2 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sortedRuns.map(r => (
                          <span
                            key={r.integration_key}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-300 ${
                              r.status === 'done'
                                ? 'bg-green-600/20 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                                : r.status === 'running'
                                ? 'bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                                : r.status === 'failed'
                                ? 'bg-destructive/15 text-destructive'
                                : r.status === 'skipped'
                                ? 'bg-muted text-muted-foreground/40 line-through'
                                : 'bg-muted text-muted-foreground/60'
                            }`}
                          >
                            {r.status === 'done' && <Check className="h-2.5 w-2.5" />}
                            {r.status === 'running' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                            {r.status === 'failed' && <AlertTriangle className="h-2.5 w-2.5" />}
                            {KEY_TO_LABEL[r.integration_key] ?? r.integration_key}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Integration Picker ─────────────────────────────────────────

function IntegrationPicker({ enabled, onToggle }: { enabled: Set<string>; onToggle: (key: string) => void }) {
  const allKeys = INTEGRATION_CATEGORIES.flatMap(c => c.keys.map(k => k.key));
  const allOn = allKeys.every(k => enabled.has(k));
  const count = allKeys.filter(k => enabled.has(k)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{count}/{allKeys.length} integrations enabled</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => allKeys.forEach(k => { if (!enabled.has(k)) onToggle(k); })}>All On</Button>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => allKeys.forEach(k => { if (enabled.has(k)) onToggle(k); })}>All Off</Button>
        </div>
      </div>
      {INTEGRATION_CATEGORIES.map(cat => {
        const catEnabled = cat.keys.filter(k => enabled.has(k.key)).length;
        return (
          <Collapsible key={cat.name}>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
              <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium flex-1">
                <ChevronDown className="h-3 w-3" />
                {cat.name} ({catEnabled}/{cat.keys.length})
              </CollapsibleTrigger>
              <div className="flex gap-1.5">
                <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => cat.keys.forEach(k => { if (!enabled.has(k.key)) onToggle(k.key); })}>On</button>
                <span className="text-muted-foreground/30">|</span>
                <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => cat.keys.forEach(k => { if (enabled.has(k.key)) onToggle(k.key); })}>Off</button>
              </div>
            </div>
            <CollapsibleContent>
              <div className="pl-4 py-1 space-y-1">
                {cat.keys.map(k => (
                  <label key={k.key} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted/30 cursor-pointer">
                    <span className="text-xs">{k.label}</span>
                    <Switch checked={enabled.has(k.key)} onCheckedChange={() => onToggle(k.key)} className="scale-75" />
                  </label>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

// ── Add Site Dialog ────────────────────────────────────────────

function AddSiteDialog({
  open,
  onOpenChange,
  members,
  groupId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: GroupMember[];
  groupId: string;
  onAdded: () => void;
}) {
  const [addTab, setAddTab] = useState<string>('new');
  const [bulkUrls, setBulkUrls] = useState('');
  const [adding, setAdding] = useState(false);
  const [addingProgress, setAddingProgress] = useState<{ current: number; total: number } | null>(null);
  const [existingSessions, setExistingSessions] = useState<{ id: string; domain: string; created_at: string }[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [showIntPicker, setShowIntPicker] = useState(false);

  // All integrations enabled by default EXCEPT enrichment (burns API credits)
  const allKeys = INTEGRATION_CATEGORIES.flatMap(c => c.keys.map(k => k.key));
  const enrichmentKeys = new Set(
    INTEGRATION_CATEGORIES.find(c => c.name === 'Enrichment & Prospecting')?.keys.map(k => k.key) ?? []
  );
  const [enabledInts, setEnabledInts] = useState<Set<string>>(
    new Set(allKeys.filter(k => !enrichmentKeys.has(k)))
  );
  const toggleInt = (key: string) => {
    setEnabledInts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (open && addTab === 'existing') {
      setLoadingExisting(true);
      const memberSessionIds = members.map(m => m.session_id);
      supabase
        .from('crawl_sessions')
        .select('id, domain, created_at')
        .neq('domain', '__global_chat__')
        .order('created_at', { ascending: false })
        .limit(100)
        .then(({ data }) => {
          setExistingSessions((data ?? []).filter(s => !memberSessionIds.includes(s.id)));
          setLoadingExisting(false);
        });
      setSelectedSessionIds(new Set());
    }
  }, [open, addTab]);

  const toggleSession = (id: string) => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAddExisting = async () => {
    if (selectedSessionIds.size === 0) return;
    setAdding(true);
    try {
      const rows = Array.from(selectedSessionIds).map(session_id => ({ group_id: groupId, session_id }));
      const { error } = await supabase.from('site_group_members').insert(rows);
      if (error) throw error;
      toast.success(`Added ${selectedSessionIds.size} site${selectedSessionIds.size > 1 ? 's' : ''}`);
      onOpenChange(false);
      setSelectedSessionIds(new Set());
      onAdded();
    } catch { toast.error('Failed to add sites'); }
    finally { setAdding(false); }
  };

  const parseUrls = (text: string): string[] => {
    return text
      .split(/[\n,\/]/)
      .map(u => u.trim())
      .filter(Boolean)
      .map(u => u.startsWith('http') ? u : `https://${u}`)
      .filter(u => { try { new URL(u); return true; } catch { return false; } });
  };

  const handleAnalyzeBulk = async () => {
    const urls = parseUrls(bulkUrls);
    if (urls.length === 0) return;
    setAdding(true);
    setAddingProgress({ current: 0, total: urls.length });

    // Build integration_overrides from picker (paused = keys NOT enabled)
    const disabledKeys = allKeys.filter(k => !enabledInts.has(k));
    const integration_overrides = disabledKeys.length > 0
      ? Object.fromEntries(disabledKeys.map(k => [k, { paused: true }]))
      : undefined;

    // Create all sessions, but only start crawling the first one.
    // The rest are queued — the polling logic will start the next one
    // when the current one completes (sequential processing).
    let succeeded = 0;
    let firstSessionId: string | null = null;
    for (let i = 0; i < urls.length; i++) {
      try {
        const domain = new URL(urls[i]).hostname;
        const isFirst = succeeded === 0;
        const { data: session, error: sessErr } = await supabase
          .from('crawl_sessions')
          .insert({ domain, base_url: urls[i], status: isFirst ? 'analyzing' : 'queued' } as any)
          .select().single();
        if (sessErr) throw sessErr;
        await supabase.from('site_group_members').insert({ group_id: groupId, session_id: session.id });
        if (isFirst) {
          firstSessionId = session.id;
        }
        succeeded++;
      } catch (e) {
        console.error(`Failed to add ${urls[i]}:`, e);
      }
      setAddingProgress({ current: i + 1, total: urls.length });
    }

    // Fire crawl-start ONLY for the first site
    if (firstSessionId) {
      supabase.functions.invoke('crawl-start', {
        body: { session_id: firstSessionId, integration_overrides },
      }).catch(console.error);
    }

    toast.success(`Started analyzing ${succeeded} site${succeeded !== 1 ? 's' : ''} (sequential)`);
    onOpenChange(false);
    setBulkUrls('');
    setAddingProgress(null);
    onAdded();
    setAdding(false);
  };

  const parsedCount = parseUrls(bulkUrls).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add Sites</DialogTitle></DialogHeader>
        <Tabs value={addTab} onValueChange={setAddTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="new" className="flex-1 gap-1.5"><Plus className="h-3.5 w-3.5" /> New URLs</TabsTrigger>
            <TabsTrigger value="existing" className="flex-1 gap-1.5"><History className="h-3.5 w-3.5" /> Existing Sites</TabsTrigger>
          </TabsList>
          <TabsContent value="new" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder={"example.com\nanother-site.com\nhttps://third-site.com"}
                value={bulkUrls}
                onChange={e => setBulkUrls(e.target.value)}
                rows={5}
                className="resize-none text-sm"
              />
              {parsedCount > 0 && (
                <p className="text-xs text-muted-foreground">{parsedCount} URL{parsedCount !== 1 ? 's' : ''} detected</p>
              )}
            </div>

            <Collapsible open={showIntPicker} onOpenChange={setShowIntPicker}>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Settings2 className="h-3.5 w-3.5" />
                Customize integrations
                <ChevronDown className={`h-3 w-3 transition-transform ${showIntPicker ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <ScrollArea className="h-[240px]">
                  <IntegrationPicker enabled={enabledInts} onToggle={toggleInt} />
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter>
              <Button onClick={handleAnalyzeBulk} disabled={parsedCount === 0 || adding} className="gap-2">
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {addingProgress ? `${addingProgress.current}/${addingProgress.total}` : 'Starting...'}
                  </>
                ) : (
                  `Analyze ${parsedCount || ''} Site${parsedCount !== 1 ? 's' : ''}`
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="existing" className="mt-4 space-y-4">
            {loadingExisting ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : existingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No available sites to add.</p>
            ) : (
              <ScrollArea className="h-[280px] -mx-1 px-1">
                <div className="space-y-1">
                  {existingSessions.map(s => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox checked={selectedSessionIds.has(s.id)} onCheckedChange={() => toggleSession(s.id)} />
                      <Globe className="h-4 w-4 shrink-0 text-primary/60" />
                      <span className="text-sm font-medium flex-1 truncate">{s.domain}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'MMM d, yyyy')}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
            <DialogFooter>
              <Button onClick={handleAddExisting} disabled={selectedSessionIds.size === 0 || adding} className="gap-2">
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                Add {selectedSessionIds.size || ''} Site{selectedSessionIds.size !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [progress, setProgress] = useState<Map<string, IntegrationProgress>>(new Map());
  const [integrationRuns, setIntegrationRuns] = useState<Map<string, IntegrationRun[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [mainTab, setMainTab] = useState('sites');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteSitesToo, setDeleteSitesToo] = useState(false);

  // Full session data for comparison tabs
  const [fullSessions, setFullSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

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
    // Fetch full session data so we can calculate progress from actual columns
    const { data: sessions } = await supabase
      .from('crawl_sessions')
      .select('*')
      .in('id', sessionIds);

    const sessionMap = new Map(sessions?.map(s => [s.id, s]) ?? []);
    const merged: GroupMember[] = memberRows
      .map(m => { const s = sessionMap.get(m.session_id); if (!s) return null; return { id: m.id, session_id: m.session_id, priority: m.priority ?? 0, notes: m.notes, domain: s.domain, base_url: s.base_url, status: s.status, created_at: s.created_at }; })
      .filter(Boolean) as GroupMember[];
    setMembers(merged);

    // Calculate progress: count data columns populated + finished integration_runs with null data
    // An integration is "finished" if status is done, failed, or skipped — all count toward progress
    const { data: runs } = await supabase.from('integration_runs').select('session_id, integration_key, status').in('session_id', sessionIds);
    const finishedBySession = new Map<string, Set<string>>();
    runs?.forEach(r => {
      if (r.status === 'done' || r.status === 'failed' || r.status === 'skipped') {
        const set = finishedBySession.get(r.session_id) ?? new Set();
        set.add(r.integration_key);
        finishedBySession.set(r.session_id, set);
      }
    });

    const progMap = new Map<string, IntegrationProgress>();
    sessions?.forEach(s => {
      const populated = DATA_COLUMNS.filter(col => (s as any)[col] != null).length;
      // Count finished integrations whose column is still null (no data found, but not a failure)
      const populatedCols = new Set(DATA_COLUMNS.filter(col => (s as any)[col] != null));
      const extraFinished = [...(finishedBySession.get(s.id) ?? [])].filter(k => {
        const col = KEY_TO_COLUMN[k];
        return col && !populatedCols.has(col);
      }).length;
      progMap.set(s.id, { session_id: s.id, total: DATA_COLUMNS.length, done: populated + extraFinished });
    });
    setProgress(progMap);

    // Store per-session integration runs for capsule display
    const runsMap = new Map<string, IntegrationRun[]>();
    runs?.forEach(r => {
      const list = runsMap.get(r.session_id) ?? [];
      list.push({ integration_key: r.integration_key, status: r.status });
      runsMap.set(r.session_id, list);
    });
    setIntegrationRuns(runsMap);

    // Sequential crawl: if no site is currently analyzing, start the next queued one
    const anyAnalyzing = sessions?.some(s => s.status === 'analyzing');
    if (!anyAnalyzing) {
      const nextQueued = sessions?.find(s => s.status === 'queued');
      if (nextQueued) {
        console.log(`[group] Starting next queued site: ${nextQueued.domain}`);
        await supabase.from('crawl_sessions').update({ status: 'analyzing' }).eq('id', nextQueued.id);
        supabase.functions.invoke('crawl-start', {
          body: { session_id: nextQueued.id },
        }).catch(console.error);
      }
    }

    setLoading(false);
  };

  // Fetch full session data when switching to comparison tabs
  const fetchFullSessions = async () => {
    if (members.length === 0 || fullSessions.length > 0) return;
    setLoadingSessions(true);
    const sessionIds = members.map(m => m.session_id);
    const { data } = await supabase.from('crawl_sessions').select('*').in('id', sessionIds);
    setFullSessions(data ?? []);
    setLoadingSessions(false);
  };

  useEffect(() => { fetchData(); }, [groupId]);

  useEffect(() => {
    if (['scores', 'technology', 'performance'].includes(mainTab)) {
      fetchFullSessions();
    }
  }, [mainTab, members.length]);

  // Polling: every 1s while any site is in progress or queued
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const anyInProgress = Array.from(progress.values()).some(p => p.done < p.total);
    const anyQueued = members.some(m => m.status === 'queued');
    if ((anyInProgress || anyQueued) && members.length > 0) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => { fetchData(); }, 1_000);
      }
    } else {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [progress, members.length]);

  // Realtime for crawl_sessions updates
  useEffect(() => {
    if (!members.length) return;
    const sessionIds = members.map(m => m.session_id);
    const channel = supabase
      .channel(`group-${groupId}-sessions`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crawl_sessions' }, (payload: any) => {
        const row = payload.new;
        if (!row || !sessionIds.includes(row.id)) return;
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [members.length, groupId]);

  const completedCount = members.filter(m => {
    const p = progress.get(m.session_id);
    if (p && p.total > 0) return p.done === p.total;
    return m.status === 'completed' || m.status === 'completed_with_errors';
  }).length;

  const overallProgress = useMemo(() => {
    if (members.length === 0) return 0;
    let totalDone = 0;
    let totalPossible = 0;
    members.forEach(m => {
      const p = progress.get(m.session_id);
      if (p && p.total > 0) {
        totalDone += p.done;
        totalPossible += p.total;
      }
    });
    return totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
  }, [members, progress]);

  const domainCounts = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach(m => counts.set(m.domain, (counts.get(m.domain) ?? 0) + 1));
    return counts;
  }, [members]);

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from('site_group_members').delete().eq('id', memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    setFullSessions([]); // Clear cached full sessions
    toast.success('Site removed from group');
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;
    setDeleting(true);
    try {
      if (deleteSitesToo) {
        // Delete all sessions and their child data
        for (const m of members) {
          await supabase.from('crawl_pages').delete().eq('session_id', m.session_id);
          await supabase.from('crawl_screenshots').delete().eq('session_id', m.session_id);
          await supabase.from('integration_runs').delete().eq('session_id', m.session_id);
          await supabase.from('knowledge_documents').delete().eq('session_id', m.session_id);
          await supabase.from('crawl_sessions').delete().eq('id', m.session_id);
        }
      }
      const { error } = await supabase.from('site_groups').delete().eq('id', groupId);
      if (error) throw error;
      toast.success('Group deleted');
      navigate('/sites');
    } catch (err) {
      toast.error('Failed to delete group');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center"><BrandLoader size={48} /></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">Group not found.</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-1.5">
              <button onClick={() => navigate('/sites')} className="text-muted-foreground hover:text-foreground transition-colors font-bold">Sites</button>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
              <span className="text-foreground">{group.name}</span>
            </h1>
            {group.description && <p className="text-sm text-muted-foreground mt-1">{group.description}</p>}
            <p className="text-xs text-muted-foreground mt-2">
              {members.length} site{members.length !== 1 ? 's' : ''}
              {members.length > 0 && completedCount < members.length && ` · ${overallProgress}% overall`}
              {members.length > 0 && completedCount === members.length && ` · All complete`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
            <Button className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Sites
            </Button>
          </div>
        </div>

        {/* Main tabbed dashboard */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            <TabsTrigger value="sites" className="gap-1.5"><Globe className="h-3.5 w-3.5" /> Sites</TabsTrigger>
            <TabsTrigger value="scores" className="gap-1.5"><Gauge className="h-3.5 w-3.5" /> Scores</TabsTrigger>
            <TabsTrigger value="technology" className="gap-1.5"><Cpu className="h-3.5 w-3.5" /> Technology</TabsTrigger>
            <TabsTrigger value="performance" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Performance</TabsTrigger>
            <TabsTrigger value="strategy" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Strategy</TabsTrigger>
          </TabsList>

          <TabsContent value="sites" className="mt-6">
            <SitesTab
              members={members}
              progress={progress}
              integrationRuns={integrationRuns}
              domainCounts={domainCounts}
              onRemove={handleRemoveMember}
              onNavigate={(m) => { const path = buildSitePath(m.domain, m.created_at, (domainCounts.get(m.domain) ?? 0) > 1); navigate(path, { state: { fromGroup: { id: groupId, name: group.name } } }); }}
            />
          </TabsContent>

          <TabsContent value="scores" className="mt-6">
            {loadingSessions ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <GroupScoreGrid sessions={fullSessions} />
            )}
          </TabsContent>

          <TabsContent value="technology" className="mt-6">
            {loadingSessions ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <GroupTechMatrix sessions={fullSessions} />
            )}
          </TabsContent>

          <TabsContent value="performance" className="mt-6">
            {loadingSessions ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <GroupPerformanceChart sessions={fullSessions} />
            )}
          </TabsContent>

          <TabsContent value="strategy" className="mt-6">
            <div className="text-center py-16 space-y-4">
              <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="font-medium">AI Strategy Brief</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Generate a unified platform recommendation, migration priority order, and consolidation roadmap across all sites in this group.
                </p>
              </div>
              <Button disabled variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" /> Coming Soon
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <AddSiteDialog open={addOpen} onOpenChange={setAddOpen} members={members} groupId={groupId!} onAdded={() => { fetchData(); setFullSessions([]); }} />

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete group "{group.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the group. Sites will remain in your sites list unless you check the option below.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {members.length > 0 && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={deleteSitesToo} onCheckedChange={(v) => setDeleteSitesToo(!!v)} />
                  Also delete all {members.length} sites in this group
                </label>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1 text-xs text-muted-foreground pl-6">
                    {members.map(m => <div key={m.id}>{m.domain}</div>)}
                  </div>
                </ScrollArea>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteGroup} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                {deleteSitesToo ? `Delete Group & ${members.length} Sites` : 'Delete Group'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
