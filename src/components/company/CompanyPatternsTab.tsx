import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, Layers, TrendingUp, AlertTriangle, Sparkles, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePatterns,
  useCompanyPatterns,
  useRecordApplication,
  type Pattern,
  type PatternApplication,
} from '@/hooks/usePatterns';

const TYPE_COLORS: Record<string, string> = {
  conversion: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  layout: 'border-blue-500/40 text-blue-700 dark:text-blue-400',
  content: 'border-purple-500/40 text-purple-700 dark:text-purple-400',
  navigation: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  engagement: 'border-pink-500/40 text-pink-700 dark:text-pink-400',
  seo: 'border-cyan-500/40 text-cyan-700 dark:text-cyan-400',
  accessibility: 'border-orange-500/40 text-orange-700 dark:text-orange-400',
};

const STATUS_COLORS: Record<string, string> = {
  validated: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  draft: 'bg-muted text-muted-foreground border-border',
  deprecated: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
};

const OUTCOME_COLORS: Record<string, string> = {
  improved: 'text-emerald-600',
  neutral: 'text-muted-foreground',
  declined: 'text-red-600',
  pending: 'text-amber-600',
};

function normalizeIndustry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span>{pct}%</span>
    </div>
  );
}

function PatternCard({
  pattern,
  applied,
  onApply,
  applying,
}: {
  pattern: Pattern;
  applied: boolean;
  onApply: () => void;
  applying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const lift = (pattern.conversion_data as any)?.lift_percent;

  return (
    <Card className="group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium leading-snug">{pattern.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[pattern.pattern_type] ?? ''}`}>
                {pattern.pattern_type}
              </Badge>
              {pattern.block_type && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {pattern.block_type}
                </Badge>
              )}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[pattern.status] ?? ''}`}>
                {pattern.status}
              </Badge>
              {lift && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                  <TrendingUp className="h-3 w-3" /> +{lift}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ConfidenceBar score={pattern.confidence_score} />
            {applied ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Applied
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={applying}
                onClick={(e) => { e.stopPropagation(); onApply(); }}
              >
                {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Apply
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className={`text-xs text-muted-foreground ${expanded ? '' : 'line-clamp-2'}`}>
          {pattern.description}
        </p>
        {pattern.description.length > 150 && (
          <button
            className="text-xs text-primary hover:underline mt-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        {expanded && (
          <div className="mt-3 space-y-2 text-xs">
            {pattern.evidence && (
              <div>
                <span className="font-medium text-foreground">Evidence:</span>{' '}
                <span className="text-muted-foreground">{pattern.evidence}</span>
              </div>
            )}
            {pattern.implementation_notes && (
              <div>
                <span className="font-medium text-foreground">Implementation:</span>{' '}
                <span className="text-muted-foreground">{pattern.implementation_notes}</span>
              </div>
            )}
            {pattern.anti_pattern && (
              <div>
                <span className="font-medium text-foreground">Anti-pattern:</span>{' '}
                <span className="text-muted-foreground">{pattern.anti_pattern}</span>
              </div>
            )}
            {pattern.persona_mapping?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {pattern.persona_mapping.map((pm, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                    {pm.persona} — {pm.jtbd}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationCard({ app }: { app: PatternApplication & { pattern: Pattern } }) {
  return (
    <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{app.pattern?.title ?? 'Unknown pattern'}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span>{new Date(app.applied_at).toLocaleDateString()}</span>
          {app.applied_to && <span>on {app.applied_to}</span>}
          {app.notes && <span>— {app.notes}</span>}
        </div>
      </div>
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 shrink-0 ${OUTCOME_COLORS[app.outcome ?? 'pending']}`}
      >
        {app.outcome ?? 'pending'}
      </Badge>
    </div>
  );
}

interface CompanyPatternsTabProps {
  companyId: string;
  companyIndustry: string | null;
  enrichmentData?: any;
}

export function CompanyPatternsTab({ companyId, companyIndustry, enrichmentData }: CompanyPatternsTabProps) {
  // Resolve industry: explicit field → Apollo → Ocean.io
  const rawIndustry =
    companyIndustry ||
    enrichmentData?.apollo_org?.industry ||
    enrichmentData?.ocean?.industry ||
    null;
  const industry = normalizeIndustry(rawIndustry);

  const { patterns, loading: patternsLoading } = usePatterns(
    industry ? { industry } : undefined
  );
  const { allPatterns, loading: allLoading } = usePatterns();
  const { applications, loading: appsLoading } = useCompanyPatterns(companyId);
  const recordApplication = useRecordApplication();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const appliedPatternIds = new Set(applications.map((a) => a.pattern_id));
  const loading = patternsLoading || allLoading || appsLoading;

  // If industry matched, show those. Otherwise show all.
  const industryMatched = industry && patterns.length > 0;
  const displayPatterns = industryMatched ? patterns : allPatterns;

  const handleApply = async (patternId: string) => {
    setApplyingId(patternId);
    try {
      await recordApplication.mutateAsync({
        pattern_id: patternId,
        company_id: companyId,
        outcome: 'pending',
      });
      toast.success('Pattern applied');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to apply pattern: ${message}`);
    } finally {
      setApplyingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Applied Patterns */}
      {applications.length > 0 && (
        <section>
          <h3 className="text-base font-semibold flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Applied Patterns ({applications.length})
          </h3>
          <div className="space-y-2">
            {applications.map((app) => (
              <ApplicationCard key={app.id} app={app as PatternApplication & { pattern: Pattern }} />
            ))}
          </div>
        </section>
      )}

      {/* Available Patterns */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {industryMatched
              ? `Patterns for "${rawIndustry}" (${displayPatterns.length})`
              : `All Patterns (${displayPatterns.length})`}
          </h3>
        </div>

        {!industryMatched && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 mb-4 text-xs text-amber-700 dark:text-amber-400">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              No industry set for this company — showing all patterns. Set the company industry or enrich via Apollo/Ocean.io to see targeted recommendations.
            </span>
          </div>
        )}

        {displayPatterns.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No patterns in the library yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayPatterns.map((p) => (
              <PatternCard
                key={p.id}
                pattern={p}
                applied={appliedPatternIds.has(p.id)}
                onApply={() => handleApply(p.id)}
                applying={applyingId === p.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
