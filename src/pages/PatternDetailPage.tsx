import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  usePattern,
  useUpdatePattern,
  useDeletePattern,
  usePatternApplications,
  type Pattern,
} from '@/hooks/usePatterns';
import { BrandLoader } from '@/components/BrandLoader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Users,
  BarChart3,
  Building2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PATTERN_TYPE_COLORS,
  INDUSTRY_COLORS,
  PATTERN_STATUS_COLORS,
  OUTCOME_COLORS,
} from '@/config/badge-styles';

function formatIndustry(industry: string): string {
  return industry.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.6) return 'bg-blue-500';
  if (score >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PatternDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pattern, loading } = usePattern(id);
  const { applications, loading: appsLoading } = usePatternApplications(id);
  const updatePattern = useUpdatePattern();
  const deletePattern = useDeletePattern();

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Pattern>>({});

  const startEdit = () => {
    if (!pattern) return;
    setEditData({
      title: pattern.title,
      description: pattern.description,
      evidence: pattern.evidence,
      anti_pattern: pattern.anti_pattern,
      implementation_notes: pattern.implementation_notes,
      status: pattern.status,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!pattern) return;
    try {
      await updatePattern.mutateAsync({ id: pattern.id, ...editData });
      toast.success('Pattern updated');
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!pattern || !confirm(`Delete "${pattern.title}"?`)) return;
    try {
      await deletePattern.mutateAsync(pattern.id);
      toast.success('Pattern deleted');
      navigate('/patterns');
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

  if (!pattern) {
    return (
      <main className="px-4 sm:px-6 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/patterns')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Patterns
        </Button>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-sm">Pattern not found.</p>
        </div>
      </main>
    );
  }

  const conversionData = pattern.conversion_data ?? {};
  const personas = (pattern.persona_mapping ?? []) as Array<{
    persona: string;
    relevance: 'primary' | 'secondary';
    jtbd: string;
  }>;
  const tags = (pattern.tags ?? []) as string[];

  const totalApps = applications.length;
  const improvedCount = applications.filter((a) => a.outcome === 'improved').length;
  const declinedCount = applications.filter((a) => a.outcome === 'declined').length;

  return (
    <main className="px-4 sm:px-6 py-6 max-w-4xl">
      {/* Back nav */}
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/patterns')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Patterns
      </Button>

      {/* ── Section A: Header ── */}
      <div className="mb-6">
        {editing ? (
          <Input
            value={editData.title ?? ''}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
            className="text-xl font-semibold mb-3"
          />
        ) : (
          <h1 className="text-xl font-semibold mb-3">{pattern.title}</h1>
        )}

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="outline" className={`text-xs px-2 py-0.5 ${INDUSTRY_COLORS[pattern.industry] ?? ''}`}>
            {formatIndustry(pattern.industry)}
          </Badge>
          {pattern.vertical && (
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              {formatIndustry(pattern.vertical)}
            </Badge>
          )}
          <Badge variant="outline" className={`text-xs px-2 py-0.5 ${PATTERN_TYPE_COLORS[pattern.pattern_type] ?? ''}`}>
            {pattern.pattern_type}
          </Badge>
          {pattern.block_type && (
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              {pattern.block_type.replace(/_/g, ' ')}
            </Badge>
          )}
          {editing ? (
            <Select
              value={editData.status ?? pattern.status}
              onValueChange={(v) => setEditData({ ...editData, status: v as Pattern['status'] })}
            >
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="validated">Validated</SelectItem>
                <SelectItem value="deprecated">Deprecated</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${PATTERN_STATUS_COLORS[pattern.status] ?? ''}`}>
              {pattern.status}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs px-2 py-0.5 text-muted-foreground">
            {pattern.source}
          </Badge>
        </div>

        {/* Confidence bar */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-muted-foreground">Confidence:</span>
          <div className="h-2 w-40 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${confidenceColor(Number(pattern.confidence_score))}`}
              style={{ width: `${Number(pattern.confidence_score) * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium tabular-nums">
            {Math.round(Number(pattern.confidence_score) * 100)}%
          </span>
          <span className="text-xs text-muted-foreground">
            ({pattern.application_count} application{pattern.application_count !== 1 ? 's' : ''})
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={saveEdit} disabled={updatePattern.isPending}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Section B: Content ── */}
      <div className="space-y-4 mb-8">
        {/* Description */}
        <Card className="px-5 py-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Pattern
          </h3>
          {editing ? (
            <Textarea
              value={editData.description ?? ''}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={4}
              className="text-sm"
            />
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{pattern.description}</p>
          )}
        </Card>

        {/* Evidence */}
        {(pattern.evidence || editing) && (
          <Card className="px-5 py-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Evidence
            </h3>
            {editing ? (
              <Textarea
                value={editData.evidence ?? ''}
                onChange={(e) => setEditData({ ...editData, evidence: e.target.value })}
                rows={3}
                className="text-sm"
                placeholder="What data supports this pattern?"
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">{pattern.evidence}</p>
            )}
          </Card>
        )}

        {/* Anti-pattern */}
        {(pattern.anti_pattern || editing) && (
          <Card className="px-5 py-4 border-red-500/20">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              What NOT To Do
            </h3>
            {editing ? (
              <Textarea
                value={editData.anti_pattern ?? ''}
                onChange={(e) => setEditData({ ...editData, anti_pattern: e.target.value })}
                rows={2}
                className="text-sm"
                placeholder="What does the opposite look like?"
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">{pattern.anti_pattern}</p>
            )}
          </Card>
        )}

        {/* Implementation Notes */}
        {(pattern.implementation_notes || editing) && (
          <Card className="px-5 py-4">
            <h3 className="text-sm font-semibold mb-2">Implementation Notes</h3>
            {editing ? (
              <Textarea
                value={editData.implementation_notes ?? ''}
                onChange={(e) => setEditData({ ...editData, implementation_notes: e.target.value })}
                rows={3}
                className="text-sm"
                placeholder="How to apply this pattern"
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">{pattern.implementation_notes}</p>
            )}
          </Card>
        )}

        {/* Conversion Data */}
        {Object.keys(conversionData).length > 0 && (
          <Card className="px-5 py-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Conversion Data
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {conversionData.lift_percent != null && (
                <div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    +{conversionData.lift_percent}%
                  </div>
                  <div className="text-[11px] text-muted-foreground">Avg. Lift</div>
                </div>
              )}
              {conversionData.sample_size != null && (
                <div>
                  <div className="text-2xl font-bold">{conversionData.sample_size}</div>
                  <div className="text-[11px] text-muted-foreground">Sample Size</div>
                </div>
              )}
              {conversionData.before?.metric && (
                <div>
                  <div className="text-lg font-semibold text-muted-foreground">
                    {conversionData.before.value}{conversionData.before.unit === 'percent' ? '%' : ` ${conversionData.before.unit ?? ''}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Before ({conversionData.before.metric.replace(/_/g, ' ')})
                  </div>
                </div>
              )}
              {conversionData.after?.metric && (
                <div>
                  <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {conversionData.after.value}{conversionData.after.unit === 'percent' ? '%' : ` ${conversionData.after.unit ?? ''}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    After ({conversionData.after.metric.replace(/_/g, ' ')})
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Persona Mapping */}
        {personas.length > 0 && (
          <Card className="px-5 py-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" />
              Persona Mapping
            </h3>
            <div className="space-y-2">
              {personas.map((p, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${p.relevance === 'primary' ? 'border-violet-500/30 text-violet-600 dark:text-violet-400' : ''}`}>
                    {p.relevance}
                  </Badge>
                  <div>
                    <span className="font-medium">{p.persona}</span>
                    <span className="text-muted-foreground"> — {p.jtbd}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px] px-2 py-0.5">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* ── Section C: Applications ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold">Applications</h2>
          <Badge variant="secondary" className="text-xs tabular-nums">{totalApps}</Badge>
          {totalApps > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {improvedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  {improvedCount} improved
                </span>
              )}
              {declinedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                  <TrendingDown className="h-3 w-3" />
                  {declinedCount} declined
                </span>
              )}
            </div>
          )}
        </div>

        {appsLoading ? (
          <div className="flex items-center justify-center py-8">
            <BrandLoader size={32} />
          </div>
        ) : applications.length === 0 ? (
          <Card className="px-5 py-8 text-center text-muted-foreground">
            <p className="text-sm">No applications yet. Apply this pattern to a company to start tracking outcomes.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {applications.map((app) => (
              <Card key={app.id} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {app.company?.name ?? 'Unknown Company'}
                      </span>
                      {app.applied_to && (
                        <span className="text-xs text-muted-foreground">
                          on {app.applied_to}
                        </span>
                      )}
                    </div>
                    {app.notes && (
                      <p className="text-[12px] text-muted-foreground line-clamp-1 mt-0.5">{app.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {app.outcome && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${OUTCOME_COLORS[app.outcome] ?? ''}`}>
                        {app.outcome}
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(app.applied_at)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
