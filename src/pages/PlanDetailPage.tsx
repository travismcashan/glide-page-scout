import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlan, useUpdatePlan, useDeletePlan } from '@/hooks/usePlans';
import { BrandLoader } from '@/components/BrandLoader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ArrowLeft, ChevronDown, ChevronRight, Copy, Pencil, Trash2, Check, Calendar, Monitor, Terminal, FileCode2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { plan, loading, error } = usePlan(id);
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editEffort, setEditEffort] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editComputerName, setEditComputerName] = useState('');
  const [editSessionId, setEditSessionId] = useState('');
  const [editPlanContent, setEditPlanContent] = useState('');
  const [editResearchNotes, setEditResearchNotes] = useState('');

  const [researchOpen, setResearchOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const startEdit = () => {
    if (!plan) return;
    setEditTitle(plan.title);
    setEditSummary(plan.summary || '');
    setEditStatus(plan.status);
    setEditPriority(plan.priority);
    setEditEffort(plan.effort_estimate || '');
    setEditCategory(plan.category);
    setEditComputerName(plan.computer_name || '');
    setEditSessionId(plan.session_id || '');
    setEditPlanContent(plan.plan_content || '');
    setEditResearchNotes(plan.research_notes || '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!plan) return;
    try {
      await updatePlan.mutateAsync({
        id: plan.id,
        title: editTitle.trim(),
        summary: editSummary.trim() || null,
        status: editStatus as any,
        priority: editPriority as any,
        effort_estimate: (editEffort || null) as any,
        category: editCategory as any,
        computer_name: editComputerName.trim() || null,
        session_id: editSessionId.trim() || null,
        plan_content: editPlanContent || null,
        research_notes: editResearchNotes || null,
        ...(editStatus === 'shipped' && !plan.shipped_at ? { shipped_at: new Date().toISOString() } : {}),
      });
      setEditing(false);
      toast.success('Plan updated');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!plan || !confirm(`Delete "${plan.title}"?`)) return;
    try {
      await deletePlan.mutateAsync(plan.id);
      toast.success('Plan deleted');
      navigate('/plans');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCopy = () => {
    if (!plan) return;
    const text = [
      `# ${plan.title}`,
      plan.summary ? `\n${plan.summary}` : '',
      plan.plan_content ? `\n---\n\n## Plan\n\n${plan.plan_content}` : '',
      plan.research_notes ? `\n---\n\n## Research Notes\n\n${plan.research_notes}` : '',
    ].join('');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
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

  if (error || !plan) {
    return (
      <main className="px-4 sm:px-6 py-6">
        <p className="text-sm text-muted-foreground">{error || 'Plan not found.'}</p>
        <Button variant="link" onClick={() => navigate('/plans')} className="mt-2 p-0">Back to Plans</Button>
      </main>
    );
  }

  if (editing) {
    return (
      <main className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <h2 className="text-lg font-semibold mb-4">Edit Plan</h2>
        <div className="space-y-4">
          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" />
          <Textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} placeholder="Summary" rows={2} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="infrastructure">Infrastructure</SelectItem>
                <SelectItem value="refactor">Refactor</SelectItem>
                <SelectItem value="integration">Integration</SelectItem>
              </SelectContent>
            </Select>
            <Select value={editPriority} onValueChange={setEditPriority}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="p0">P0</SelectItem>
                <SelectItem value="p1">P1</SelectItem>
                <SelectItem value="p2">P2</SelectItem>
                <SelectItem value="p3">P3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={editEffort} onValueChange={setEditEffort}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Effort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="xl">XL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={editComputerName} onChange={(e) => setEditComputerName(e.target.value)} placeholder="Computer name" />
            <Input value={editSessionId} onChange={(e) => setEditSessionId(e.target.value)} placeholder="Session ID" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Plan Content (Markdown)</label>
            <Textarea
              value={editPlanContent}
              onChange={(e) => setEditPlanContent(e.target.value)}
              placeholder="Full plan content..."
              rows={20}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Research Notes (Markdown)</label>
            <Textarea
              value={editResearchNotes}
              onChange={(e) => setEditResearchNotes(e.target.value)}
              placeholder="Agent research notes..."
              rows={20}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={updatePlan.isPending}>Save</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
      {/* Back nav */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/plans')} className="-ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Plans
        </Button>
      </div>

      {/* Header card */}
      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="text-xl font-semibold leading-tight">{plan.title}</h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-muted-foreground" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-muted-foreground" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-destructive/60 hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <Badge variant="outline" className={`text-[11px] ${STATUS_COLORS[plan.status]}`}>{plan.status}</Badge>
          <Badge variant="outline" className="text-[11px]">{plan.category}</Badge>
          <Badge variant="outline" className={`text-[11px] ${PRIORITY_COLORS[plan.priority]}`}>{plan.priority.toUpperCase()}</Badge>
          {plan.effort_estimate && <Badge variant="outline" className="text-[11px]">{plan.effort_estimate}</Badge>}
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(plan.created_at)}
          </span>
          {plan.shipped_at && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" />
              Shipped {formatDate(plan.shipped_at)}
            </span>
          )}
          {plan.computer_name && (
            <span className="inline-flex items-center gap-1">
              <Monitor className="h-3 w-3" />
              {plan.computer_name}
            </span>
          )}
          {plan.session_id && (
            <span className="inline-flex items-center gap-1">
              <Terminal className="h-3 w-3" />
              <code className="font-mono text-[11px]">{plan.session_id}</code>
            </span>
          )}
        </div>

        {/* Summary */}
        {plan.summary && (
          <>
            <Separator className="my-4" />
            <p className="text-sm text-muted-foreground leading-relaxed">{plan.summary}</p>
          </>
        )}

        {/* Related files */}
        {plan.related_files && plan.related_files.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="flex items-start gap-2">
              <FileCode2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                {plan.related_files.map((f, i) => (
                  <code key={i} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{f}</code>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Plan content */}
      {plan.plan_content && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Plan</h2>
          <Card className="p-6">
            <article className="prose prose-sm dark:prose-invert max-w-none
              prose-headings:font-semibold prose-headings:tracking-tight
              prose-h2:text-base prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
              prose-h3:text-sm prose-h3:mt-6 prose-h3:mb-2
              prose-h4:text-sm prose-h4:mt-4 prose-h4:mb-1 prose-h4:text-muted-foreground
              prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-foreground/85
              prose-li:text-[13px] prose-li:leading-relaxed prose-li:text-foreground/85
              prose-strong:text-foreground prose-strong:font-semibold
              prose-table:text-xs
              prose-th:text-left prose-th:font-semibold prose-th:text-muted-foreground prose-th:pb-2 prose-th:border-b prose-th:border-border
              prose-td:py-1.5 prose-td:pr-4 prose-td:border-b prose-td:border-border/50
              prose-code:text-[12px] prose-code:font-mono prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:text-foreground/80 prose-code:before:content-none prose-code:after:content-none
              prose-hr:border-border prose-hr:my-6
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.plan_content}</ReactMarkdown>
            </article>
          </Card>
        </div>
      )}

      {/* Research notes (collapsible) */}
      {plan.research_notes && (
        <div className="mb-6">
          <Collapsible open={researchOpen} onOpenChange={setResearchOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-4 group">
              {researchOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Research Notes
              <span className="text-[10px] font-normal normal-case tracking-normal opacity-60 group-hover:opacity-100">
                (click to {researchOpen ? 'collapse' : 'expand'})
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="p-6 border-dashed">
                <article className="prose prose-sm dark:prose-invert max-w-none
                  prose-headings:font-semibold prose-headings:tracking-tight
                  prose-h2:text-base prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
                  prose-h3:text-sm prose-h3:mt-6 prose-h3:mb-2
                  prose-h4:text-sm prose-h4:mt-4 prose-h4:mb-1 prose-h4:text-muted-foreground
                  prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-foreground/85
                  prose-li:text-[13px] prose-li:leading-relaxed prose-li:text-foreground/85
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-table:text-xs
                  prose-th:text-left prose-th:font-semibold prose-th:text-muted-foreground prose-th:pb-2 prose-th:border-b prose-th:border-border
                  prose-td:py-1.5 prose-td:pr-4 prose-td:border-b prose-td:border-border/50
                  prose-code:text-[12px] prose-code:font-mono prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:text-foreground/80 prose-code:before:content-none prose-code:after:content-none
                  prose-hr:border-border prose-hr:my-6
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.research_notes}</ReactMarkdown>
                </article>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Empty state */}
      {!plan.plan_content && !plan.research_notes && (
        <Card className="p-12 text-center">
          <p className="text-sm text-muted-foreground">No content yet. Click <Pencil className="h-3 w-3 inline mx-0.5" /> to add plan details and research notes.</p>
        </Card>
      )}
    </main>
  );
}
