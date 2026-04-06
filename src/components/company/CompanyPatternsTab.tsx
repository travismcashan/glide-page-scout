import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, Layers, TrendingUp, AlertTriangle, Sparkles, Info, Zap, Brain } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePatterns,
  useCompanyPatterns,
  useRecordApplication,
  type Pattern,
  type PatternApplication,
} from '@/hooks/usePatterns';
import {
  usePatternSuggestions,
  useGeneratePatternSuggestions,
  type PatternSuggestion,
} from '@/hooks/usePatternSuggestions';
import { PATTERN_TYPE_COLORS, PATTERN_STATUS_COLORS, OUTCOME_COLORS } from '@/config/badge-styles';

function normalizeIndustry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function ConfidenceBar({ score, max = 1 }: { score: number; max?: number }) {
  const pct = max === 1 ? Math.round(score * 100) : Math.round(score);
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
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PATTERN_TYPE_COLORS[pattern.pattern_type] ?? ''}`}>
                {pattern.pattern_type}
              </Badge>
              {pattern.block_type && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {pattern.block_type}
                </Badge>
              )}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PATTERN_STATUS_COLORS[pattern.status] ?? ''}`}>
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

function SuggestedPatternCard({
  pattern,
  suggestion,
  applied,
  onApply,
  applying,
}: {
  pattern: Pattern;
  suggestion: PatternSuggestion;
  applied: boolean;
  onApply: () => void;
  applying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="group border-purple-500/20 bg-purple-500/[0.02]">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium leading-snug">{pattern.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PATTERN_TYPE_COLORS[pattern.pattern_type] ?? ''}`}>
                {pattern.pattern_type}
              </Badge>
              {pattern.block_type && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {pattern.block_type}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-500/30 text-purple-700 dark:text-purple-400">
                AI suggested
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ConfidenceBar score={suggestion.confidence_score} max={100} />
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
        {/* AI reasoning */}
        <div className="rounded-md bg-purple-500/5 border border-purple-500/10 px-3 py-2 mb-2">
          <p className="text-xs text-purple-800 dark:text-purple-300">
            <Brain className="h-3 w-3 inline mr-1 -mt-0.5" />
            {suggestion.reasoning}
          </p>
          {suggestion.suggested_customizations && (
            <p className="text-xs text-muted-foreground mt-1">
              <Zap className="h-3 w-3 inline mr-1 -mt-0.5" />
              {suggestion.suggested_customizations}
            </p>
          )}
        </div>

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
  // Resolve industry: explicit field -> Apollo -> Ocean.io
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

  // AI suggestions
  const { suggestions, data: suggestionsData, loading: suggestionsLoading } = usePatternSuggestions(companyId);
  const generateSuggestions = useGeneratePatternSuggestions();

  const appliedPatternIds = new Set(applications.map((a) => a.pattern_id));
  const loading = patternsLoading || allLoading || appsLoading;

  // Build a pattern lookup map for suggestion cards
  const patternMap = new Map(allPatterns.map((p) => [p.id, p]));

  // If industry matched, show those. Otherwise show all.
  const industryMatched = industry && patterns.length > 0;
  const displayPatterns = industryMatched ? patterns : allPatterns;

  // Filter out patterns already shown in AI suggestions from the library section
  const suggestedPatternIds = new Set(suggestions.map((s) => s.pattern_id));

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

  const handleGenerate = async () => {
    try {
      const result = await generateSuggestions.mutateAsync(companyId);
      toast.success(`Generated ${result.length} pattern suggestions`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to generate suggestions: ${message}`);
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
      {/* AI Suggestions Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600" />
            AI Suggestions
            {suggestions.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({suggestions.length})
              </span>
            )}
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            disabled={generateSuggestions.isPending}
            onClick={handleGenerate}
          >
            {generateSuggestions.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {suggestions.length > 0 ? 'Regenerate' : 'Generate Suggestions'}
          </Button>
        </div>

        {suggestionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestionsData?.generated_at && (
              <p className="text-[10px] text-muted-foreground">
                Generated {new Date(suggestionsData.generated_at).toLocaleDateString()} — {suggestionsData.patterns_analyzed} patterns analyzed
                {suggestionsData.had_crawl_data ? ' with crawl data' : ''}
              </p>
            )}
            {suggestions.map((suggestion) => {
              const pattern = patternMap.get(suggestion.pattern_id);
              if (!pattern) return null;
              return (
                <SuggestedPatternCard
                  key={suggestion.pattern_id}
                  pattern={pattern}
                  suggestion={suggestion}
                  applied={appliedPatternIds.has(suggestion.pattern_id)}
                  onApply={() => handleApply(suggestion.pattern_id)}
                  applying={applyingId === suggestion.pattern_id}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-purple-500/20 bg-purple-500/[0.02] p-6 text-center">
            <Brain className="h-8 w-8 text-purple-500/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No AI suggestions yet</p>
            <p className="text-xs text-muted-foreground">
              Click "Generate Suggestions" to analyze this company against the pattern library.
            </p>
          </div>
        )}
      </section>

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
