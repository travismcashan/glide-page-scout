import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlan, usePlans, useUpdatePlan, useDeletePlan } from '@/hooks/usePlans';
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
import {
  ArrowLeft, ChevronDown, ChevronRight, Copy, Pencil, Trash2,
  Check, Calendar, Monitor, Terminal, FileCode2, X, Plus,
  Eye, Code2, Tag, ArrowRight, Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PLAN_STATUS_COLORS, PRIORITY_COLORS, TIER_COLORS } from '@/config/badge-styles';

const STATUS_FLOW: Record<string, { next: string; label: string }> = {
  draft: { next: 'ready', label: 'Mark Ready' },
  ready: { next: 'in-progress', label: 'Start Work' },
  'in-progress': { next: 'shipped', label: 'Ship It' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Extract tier number from tags or summary. Returns null if none found. */
function extractTier(plan: { tags?: string[]; summary?: string | null; title?: string }): string | null {
  // Check tags first: "tier-0", "tier-1", "Tier 0", etc.
  for (const tag of plan.tags || []) {
    const m = tag.match(/tier[\s-]*(\d+)/i);
    if (m) return m[1];
  }
  // Check title
  const titleMatch = plan.title?.match(/\[tier[\s-]*(\d+)\]/i) || plan.title?.match(/tier[\s-]*(\d+)/i);
  if (titleMatch) return titleMatch[1];
  // Check summary
  const summaryMatch = plan.summary?.match(/tier[\s-]*(\d+)/i);
  if (summaryMatch) return summaryMatch[1];
  return null;
}

const PROSE_CLASSES = `prose prose-sm dark:prose-invert max-w-none
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
  prose-a:text-primary prose-a:no-underline hover:prose-a:underline`;

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { plan, loading, error } = usePlan(id);
  const { plans: allPlans } = usePlans();
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
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const [researchOpen, setResearchOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview' | 'split'>('split');

  const tier = plan ? extractTier(plan) : null;

  // Related plans: share at least one tag (excluding this plan)
  const relatedPlans = useMemo(() => {
    if (!plan?.tags?.length) return [];
    const myTags = new Set(plan.tags.map(t => t.toLowerCase()));
    return allPlans
      .filter(p => p.id !== plan.id && p.tags?.some(t => myTags.has(t.toLowerCase())))
      .slice(0, 8);
  }, [plan, allPlans]);

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
    setEditTags(plan.tags || []);
    setNewTag('');
    setEditing(true);
  };

  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (!tag || editTags.includes(tag)) return;
    setEditTags([...editTags, tag]);
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
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
        tags: editTags,
        ...(editStatus === 'shipped' && !plan.shipped_at ? { shipped_at: new Date().toISOString() } : {}),
      });
      setEditing(false);
      toast.success('Plan updated');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleStatusTransition = async (newStatus: string) => {
    if (!plan) return;
    try {
      await updatePlan.mutateAsync({
        id: plan.id,
        status: newStatus as any,
        ...(newStatus === 'shipped' ? { shipped_at: new Date().toISOString() } : {}),
      });
      toast.success(`Status updated to ${newStatus}`);
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

  // ── EDIT MODE ──
  if (editing) {
    const renderMarkdownEditor = (
      label: string,
      value: string,
      onChange: (v: string) => void,
      placeholder: string,
    ) => (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground">{label}</label>
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <Button
              variant={previewMode === 'edit' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setPreviewMode('edit')}
            >
              <Code2 className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button
              variant={previewMode === 'split' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setPreviewMode('split')}
            >
              Split
            </Button>
            <Button
              variant={previewMode === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setPreviewMode('preview')}
            >
              <Eye className="h-3 w-3 mr-1" /> Preview
            </Button>
          </div>
        </div>
        {previewMode === 'edit' && (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={20}
            className="font-mono text-xs"
          />
        )}
        {previewMode === 'preview' && (
          <Card className="p-6 min-h-[300px]">
            {value ? (
              <article className={PROSE_CLASSES}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
              </article>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nothing to preview</p>
            )}
          </Card>
        )}
        {previewMode === 'split' && (
          <div className="grid grid-cols-2 gap-3">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={20}
              className="font-mono text-xs"
            />
            <Card className="p-4 overflow-auto max-h-[500px]">
              {value ? (
                <article className={PROSE_CLASSES}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
                </article>
              ) : (
                <p className="text-sm text-muted-foreground italic">Preview appears here</p>
              )}
            </Card>
          </div>
        )}
      </div>
    );

    return (
      <main className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">
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

          {/* Tags editor */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tags</label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {editTags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[11px] gap-1 pr-1">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag..."
                className="h-7 text-xs max-w-[200px]"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
              />
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleAddTag} disabled={!newTag.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {renderMarkdownEditor('Plan Content (Markdown)', editPlanContent, setEditPlanContent, 'Full plan content...')}
          {renderMarkdownEditor('Research Notes (Markdown)', editResearchNotes, setEditResearchNotes, 'Agent research notes...')}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={updatePlan.isPending}>Save</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      </main>
    );
  }

  // ── VIEW MODE ──
  const nextStatus = STATUS_FLOW[plan.status];

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
          <div className="flex items-center gap-3 min-w-0">
            {tier && (
              <Badge variant="outline" className={`text-xs font-semibold shrink-0 ${TIER_COLORS[tier] || TIER_COLORS['6']}`}>
                <Layers className="h-3 w-3 mr-1" />
                Tier {tier}
              </Badge>
            )}
            <h1 className="text-xl font-semibold leading-tight">{plan.title}</h1>
          </div>
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

        {/* Badges + Status Transition */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <Badge variant="outline" className={`text-[11px] ${PLAN_STATUS_COLORS[plan.status]}`}>{plan.status}</Badge>
          <Badge variant="outline" className="text-[11px]">{plan.category}</Badge>
          <Badge variant="outline" className={`text-[11px] ${PRIORITY_COLORS[plan.priority]}`}>{plan.priority.toUpperCase()}</Badge>
          {plan.effort_estimate && <Badge variant="outline" className="text-[11px]">{plan.effort_estimate}</Badge>}

          {/* Status transition button */}
          {nextStatus && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2.5 text-[11px] gap-1"
                onClick={() => handleStatusTransition(nextStatus.next)}
                disabled={updatePlan.isPending}
              >
                {nextStatus.label}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>

        {/* Tags */}
        {plan.tags && plan.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {plan.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] font-normal">{tag}</Badge>
            ))}
          </div>
        )}

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
            <article className={PROSE_CLASSES}>
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
                <article className={`${PROSE_CLASSES} prose-hr:border-border prose-hr:my-6`}>
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

      {/* Related Plans */}
      {relatedPlans.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Related Plans</h2>
          <div className="space-y-1.5">
            {relatedPlans.map((rp) => {
              const rpTier = extractTier(rp);
              return (
                <Card
                  key={rp.id}
                  className="px-4 py-3 cursor-pointer hover:bg-accent/40 transition-colors"
                  onClick={() => navigate(`/plans/${rp.id}`)}
                >
                  <div className="flex items-center gap-2">
                    {rpTier && (
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${TIER_COLORS[rpTier] || TIER_COLORS['6']}`}>
                        T{rpTier}
                      </Badge>
                    )}
                    <span className="text-sm font-medium truncate">{rp.title}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ml-auto shrink-0 ${PLAN_STATUS_COLORS[rp.status]}`}>
                      {rp.status}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${PRIORITY_COLORS[rp.priority]}`}>
                      {rp.priority.toUpperCase()}
                    </Badge>
                  </div>
                  {rp.tags && rp.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 ml-0">
                      {rp.tags.filter(t => plan.tags?.map(tt => tt.toLowerCase()).includes(t.toLowerCase())).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-[9px] font-normal px-1 py-0">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
