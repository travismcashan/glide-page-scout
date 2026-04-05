import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlans, useCreatePlan, useDeletePlan, useUpdatePlan, type Plan, type PlanInsert } from '@/hooks/usePlans';
import { BrandLoader } from '@/components/BrandLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
import { ScrollText, Plus, Search, MoreVertical, Trash2, Archive, Rocket, Check, Calendar, Monitor, Terminal } from 'lucide-react';
import { toast } from 'sonner';

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

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  ready: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'in-progress': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  shipped: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  archived: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

const PRIORITY_COLORS: Record<string, string> = {
  p0: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  p1: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  p2: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  p3: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
};

const EFFORT_LABELS: Record<string, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
  xl: 'XL',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  const [showNewDialog, setShowNewDialog] = useState(false);

  // New plan form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<PlanInsert['category']>('feature');
  const [newPriority, setNewPriority] = useState<PlanInsert['priority']>('p1');
  const [newEffort, setNewEffort] = useState<string>('');
  const [newSummary, setNewSummary] = useState('');
  const [newComputerName, setNewComputerName] = useState('');
  const [newSessionId, setNewSessionId] = useState('');

  const filtered = plans.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.summary?.toLowerCase().includes(q) ||
        p.tags?.some((t: string) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

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
      </div>

      {/* Plans list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ScrollText className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">{plans.length === 0 ? 'No plans yet. Create your first one.' : 'No plans match your filters.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((plan) => (
            <Card
              key={plan.id}
              className="px-5 py-4 cursor-pointer hover:bg-accent/40 transition-colors group"
              onClick={() => navigate(`/plans/${plan.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* Title + badges row */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-semibold text-sm">{plan.title}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[plan.status]}`}>
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
                    <DropdownMenuItem onClick={() => handleStatusChange(plan.id, 'in-progress')}>
                      <Rocket className="mr-2 h-4 w-4" />
                      Start Work
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(plan.id, 'shipped')}>
                      <Check className="mr-2 h-4 w-4" />
                      Mark Shipped
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(plan.id, 'archived')}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(plan.id, plan.title)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
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
