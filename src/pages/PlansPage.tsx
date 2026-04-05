import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlans, useCreatePlan, useDeletePlan, useUpdatePlan, type Plan, type PlanInsert } from '@/hooks/usePlans';
import { BrandLoader } from '@/components/BrandLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollText, Plus, Search, MoreVertical, Trash2, Archive, Rocket, Check, Calendar, Monitor, Terminal, ChevronRight, ChevronDown, Zap, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { PLAN_STATUS_COLORS, PRIORITY_COLORS, EFFORT_LABELS } from '@/config/badge-styles';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'archived', label: 'Archived' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'feature', label: 'Feature' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'integration', label: 'Integration' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priorities' },
  { value: 'p0', label: 'P0' },
  { value: 'p1', label: 'P1' },
  { value: 'p2', label: 'P2' },
  { value: 'p3', label: 'P3' },
] as const;

const DOMAIN_OPTIONS = [
  { value: 'all', label: 'All Domains' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'product', label: 'Product' },
  { value: 'strategy', label: 'Strategy' },
] as const;

const PRIORITY_ORDER: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };
const STATUS_ORDER: Record<string, number> = { 'in-progress': 0, ready: 1, draft: 2, shipped: 3, archived: 4 };

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Extract tier number from tags array (e.g., "Tier 0" → 0). Returns -1 if no tier tag. */
function extractTier(tags: string[]): number {
  for (const tag of tags) {
    const m = tag.match(/^tier\s*(\d+)$/i);
    if (m) return parseInt(m[1], 10);
  }
  return -1;
}

/** Extract domain tags (architecture, product, strategy) from tags array */
function extractDomains(tags: string[]): string[] {
  const domains = ['architecture', 'product', 'strategy'];
  return tags.filter(t => domains.includes(t.toLowerCase())).map(t => t.toLowerCase());
}

/** Sort plans: priority first (p0 first), then status (in-progress first) */
function sortPlans(a: Plan, b: Plan): number {
  const pa = PRIORITY_ORDER[a.priority] ?? 9;
  const pb = PRIORITY_ORDER[b.priority] ?? 9;
  if (pa !== pb) return pa - pb;
  const sa = STATUS_ORDER[a.status] ?? 9;
  const sb = STATUS_ORDER[b.status] ?? 9;
  return sa - sb;
}

export default function PlansPage() {
  const navigate = useNavigate();
  const { plans, loading } = usePlans();
  const createPlan = useCreatePlan();
  const deletePlan = useDeletePlan();
  const updatePlan = useUpdatePlan();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedTiers, setCollapsedTiers] = useState<Set<number>>(new Set());

  // New plan form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<PlanInsert['category']>('feature');
  const [newPriority, setNewPriority] = useState<PlanInsert['priority']>('p1');
  const [newEffort, setNewEffort] = useState<string>('');
  const [newSummary, setNewSummary] = useState('');
  const [newComputerName, setNewComputerName] = useState('');
  const [newSessionId, setNewSessionId] = useState('');

  const filtered = useMemo(() => plans.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
    if (domainFilter !== 'all') {
      const domains = extractDomains(p.tags || []);
      if (!domains.includes(domainFilter)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.summary?.toLowerCase().includes(q) ||
        p.tags?.some((t: string) => t.toLowerCase().includes(q))
      );
    }
    return true;
  }), [plans, statusFilter, categoryFilter, priorityFilter, domainFilter, search]);

  // Group filtered plans by tier
  const tierGroups = useMemo(() => {
    const groups = new Map<number, Plan[]>();
    for (const plan of filtered) {
      const tier = extractTier(plan.tags || []);
      if (!groups.has(tier)) groups.set(tier, []);
      groups.get(tier)!.push(plan);
    }
    // Sort plans within each tier
    for (const plans of groups.values()) {
      plans.sort(sortPlans);
    }
    // Sort tiers: -1 (untagged) goes last
    const sortedTiers = [...groups.keys()].sort((a, b) => {
      if (a === -1) return 1;
      if (b === -1) return -1;
      return a - b;
    });
    return sortedTiers.map(tier => ({ tier, plans: groups.get(tier)! }));
  }, [filtered]);

  // Find highest-priority non-completed plan for "Next Up"
  const nextUp = useMemo(() => {
    const active = plans.filter(p => p.status !== 'shipped' && p.status !== 'archived');
    active.sort(sortPlans);
    return active[0] || null;
  }, [plans]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const plan = await createPlan.mutateAsync({
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        effort_estimate: (newEffort || null) as any,
        summary: newSummary.trim() || null,
        computer_name: newComputerName.trim() || null,
        session_id: newSessionId.trim() || null,
        status: 'draft',
      });
      toast.success('Plan created');
      setShowNewDialog(false);
      setNewTitle('');
      setNewSummary('');
      setNewComputerName('');
      setNewSessionId('');
      navigate(`/plans/${plan.id}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await deletePlan.mutateAsync(id);
      toast.success('Plan deleted');
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleStatusChange = async (id: string, status: Plan['status']) => {
    try {
      await updatePlan.mutateAsync({
        id,
        status,
        ...(status === 'shipped' ? { shipped_at: new Date().toISOString() } : {}),
      });
      toast.success(`Status updated to ${status}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleBulkStatus = async (status: Plan['status']) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map(id => updatePlan.mutateAsync({
        id,
        status,
        ...(status === 'shipped' ? { shipped_at: new Date().toISOString() } : {}),
      })));
      toast.success(`${ids.length} plan${ids.length > 1 ? 's' : ''} updated to ${status}`);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTier = (tier: number) => {
    setCollapsedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  if (loading) {
    return (
      <main className="px-4 sm:px-6 py-6">
        <div className="flex items-center justify-center py-20">
          <BrandLoader size={48} />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <ScrollText className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Claude Code Plans</h1>
        <Badge variant="secondary" className="text-xs tabular-nums">{plans.length}</Badge>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Plan
        </Button>
      </div>

      {/* Next Up card */}
      {nextUp && (
        <Card
          className="px-5 py-4 mb-4 border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => navigate(`/plans/${nextUp.id}`)}
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Next Up</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">{nextUp.title}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PLAN_STATUS_COLORS[nextUp.status]}`}>
              {nextUp.status}
            </Badge>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[nextUp.priority]}`}>
              {nextUp.priority.toUpperCase()}
            </Badge>
            {(() => { const t = extractTier(nextUp.tags || []); return t >= 0 ? <Badge variant="outline" className="text-[10px] px-1.5 py-0">Tier {t}</Badge> : null; })()}
          </div>
          {nextUp.summary && (
            <p className="text-[13px] text-muted-foreground mt-1 line-clamp-1">{nextUp.summary}</p>
          )}
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOMAIN_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-muted/50 rounded-lg border">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkStatus('ready')}>
            Ready
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkStatus('in-progress')}>
            In Progress
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkStatus('shipped')}>
            Shipped
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkStatus('archived')}>
            Archive
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Plans grouped by tier */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ScrollText className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">{plans.length === 0 ? 'No plans yet. Create your first one.' : 'No plans match your filters.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tierGroups.map(({ tier, plans: tierPlans }) => {
            const shippedCount = tierPlans.filter(p => p.status === 'shipped').length;
            const totalCount = tierPlans.length;
            const isCollapsed = collapsedTiers.has(tier);
            const tierLabel = tier >= 0 ? `Tier ${tier}` : 'Untagged';

            return (
              <Collapsible key={tier} open={!isCollapsed} onOpenChange={() => toggleTier(tier)}>
                <CollapsibleTrigger className="w-full flex items-center gap-2 py-2 group cursor-pointer text-left">
                  {isCollapsed
                    ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                  <span className="font-semibold text-sm">{tierLabel}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 tabular-nums">
                    {shippedCount}/{totalCount} shipped
                  </Badge>
                  {tierPlans.some(p => p.status === 'in-progress') && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PLAN_STATUS_COLORS['in-progress']}`}>
                      active
                    </Badge>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-1">
                    {tierPlans.map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        selected={selectedIds.has(plan.id)}
                        onToggleSelect={() => toggleSelect(plan.id)}
                        onClick={() => navigate(`/plans/${plan.id}`)}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* New Plan Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Plan title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Textarea
              placeholder="Summary (2-3 sentences)"
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              rows={2}
            />
            <div className="grid grid-cols-3 gap-2">
              <Select value={newCategory} onValueChange={(v) => setNewCategory(v as any)}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="refactor">Refactor</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newPriority} onValueChange={(v) => setNewPriority(v as any)}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p0">P0 - Critical</SelectItem>
                  <SelectItem value="p1">P1 - High</SelectItem>
                  <SelectItem value="p2">P2 - Medium</SelectItem>
                  <SelectItem value="p3">P3 - Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newEffort} onValueChange={setNewEffort}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Effort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="xl">XL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Computer name (optional)"
                value={newComputerName}
                onChange={(e) => setNewComputerName(e.target.value)}
              />
              <Input
                placeholder="Session ID (optional)"
                value={newSessionId}
                onChange={(e) => setNewSessionId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || createPlan.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

// ── Plan Card (extracted for checkbox support) ─────────────────────────

function PlanCard({
  plan,
  selected,
  onToggleSelect,
  onClick,
  onStatusChange,
  onDelete,
}: {
  plan: Plan;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  onStatusChange: (id: string, status: Plan['status']) => void;
  onDelete: (id: string, title: string) => void;
}) {
  return (
    <Card
      className="px-5 py-4 cursor-pointer hover:bg-accent/40 transition-colors group"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="h-4 w-4"
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-semibold text-sm">{plan.title}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PLAN_STATUS_COLORS[plan.status]}`}>
              {plan.status}
            </Badge>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[plan.priority]}`}>
              {plan.priority.toUpperCase()}
            </Badge>
            {plan.effort_estimate && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {EFFORT_LABELS[plan.effort_estimate] || plan.effort_estimate}
              </Badge>
            )}
          </div>

          {/* Summary */}
          {plan.summary && (
            <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2 mb-2">{plan.summary}</p>
          )}

          {/* Metadata row with icons */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(plan.created_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              {plan.category}
            </span>
            {plan.computer_name && (
              <span className="inline-flex items-center gap-1">
                <Monitor className="h-3 w-3" />
                {plan.computer_name}
              </span>
            )}
            {plan.session_id && (
              <span className="inline-flex items-center gap-1">
                <Terminal className="h-3 w-3" />
                <code className="font-mono">{plan.session_id}</code>
              </span>
            )}
            {plan.shipped_at && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                Shipped {formatDate(plan.shipped_at)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onStatusChange(plan.id, 'in-progress')}>
              <Rocket className="mr-2 h-4 w-4" />
              Start Work
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(plan.id, 'shipped')}>
              <Check className="mr-2 h-4 w-4" />
              Mark Shipped
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(plan.id, 'archived')}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(plan.id, plan.title)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
