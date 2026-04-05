import {
  type OverallScore,
  type CategoryScore,
  type ScoreSignal,
  gradeToColor,
  gradeToBgColor,
  scoreToGrade,
} from '@/lib/siteScore';
import { Card } from '@/components/ui/card';
import { Shield, Search, Accessibility, FileText, Zap, Link, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  performance: <Zap className="h-4 w-4" />,
  seo: <Search className="h-4 w-4" />,
  accessibility: <Accessibility className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  'content-ux': <FileText className="h-4 w-4" />,
  'url-health': <Link className="h-4 w-4" />,
};

// ── Score Ring ──────────────────────────────────────────────

function ScoreRing({ score, grade, size = 140, placeholder, progressPercent }: {
  score: number; grade: string; size?: number; placeholder?: boolean; progressPercent?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = placeholder ? 0 : (score / 100) * circumference;

  const gradeColors: Record<string, string> = {
    A: '#10b981', B: '#3b82f6', C: '#eab308', D: '#f97316', F: '#ef4444',
  };
  const strokeColor = placeholder ? 'hsl(var(--muted))' : (gradeColors[grade] || '#ef4444');
  const glowColor = placeholder ? 'transparent' : `${strokeColor}40`;

  const hasProgress = placeholder && progressPercent !== undefined;
  const progressArc = hasProgress ? (progressPercent / 100) * circumference : 0;

  return (
    <div className={`relative ${!placeholder && grade === 'A' ? 'animate-grade-shimmer' : ''}`} style={{ width: size, height: size, filter: placeholder ? 'none' : `drop-shadow(0 0 12px ${glowColor})` }}>
      <svg width={size} height={size} className={placeholder && !hasProgress ? 'animate-spin' : '-rotate-90'} style={placeholder && !hasProgress ? { animationDuration: '2s' } : undefined}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} />
        {placeholder ? (
          hasProgress ? (
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth={strokeWidth}
              strokeDasharray={circumference} strokeDashoffset={circumference - progressArc} strokeLinecap="round" className="transition-all duration-700 ease-out" />
          ) : (
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--primary) / 0.4)" strokeWidth={strokeWidth}
              strokeDasharray={`${circumference * 0.3} ${circumference * 0.7}`} strokeLinecap="round" />
          )
        ) : (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round"
            className="transition-all duration-1000 ease-out" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {placeholder ? (
          hasProgress ? (
            <span className="text-3xl font-bold text-muted-foreground">{progressPercent}%</span>
          ) : (
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          )
        ) : (
          <>
            <span className={`text-4xl font-bold ${gradeToColor(grade as any)}`}>{grade}</span>
            <span className="text-base text-muted-foreground font-medium">{score}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Category Mini Card ─────────────────────────────────────

function CategoryMiniCard({ cat, onClick }: { cat: CategoryScore; onClick?: () => void }) {
  const gradeAccent = cat.grade === 'A' || cat.grade === 'B' ? 'border-l-emerald-500/50'
    : cat.grade === 'C' ? 'border-l-yellow-500/50'
    : 'border-l-red-500/50';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl border border-l-[3px] ${gradeAccent} px-3 py-2.5 text-left hover:bg-accent/40 transition-colors w-full ${gradeToBgColor(cat.grade)}`}
    >
      <div className="text-muted-foreground shrink-0">{CATEGORY_ICONS[cat.key]}</div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] text-muted-foreground leading-tight truncate">{cat.label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${gradeToColor(cat.grade)}`}>{cat.grade}</span>
          <span className="text-xs text-muted-foreground">· {cat.score}</span>
        </div>
      </div>
    </button>
  );
}

function CategoryMiniCardPlaceholder({ label, iconKey }: { label: string; iconKey: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 bg-muted/20">
      <div className="text-muted-foreground/30 shrink-0">{CATEGORY_ICONS[iconKey]}</div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] text-muted-foreground/40 leading-tight">{label}</span>
        <span className="text-sm font-medium text-muted-foreground/30">—</span>
      </div>
    </div>
  );
}

// ── Signal Items ───────────────────────────────────────────

function StrengthItem({ signal }: { signal: ScoreSignal }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
      <span className="text-[13px] text-foreground/75 leading-relaxed">{signal.summary}</span>
    </div>
  );
}

function GapItem({ signal, index }: { signal: ScoreSignal; index: number }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
        {index + 1}
      </span>
      <span className="text-[13px] text-foreground/75 leading-relaxed">{signal.summary}</span>
    </div>
  );
}

// ── AI Narrative ───────────────────────────────────────────

function generateFallbackNarrative(overallScore: OverallScore): string {
  const { grade, score, categories } = overallScore;
  if (categories.length === 0) return '';

  const sorted = [...categories].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const strengthCount = overallScore.topStrengths.length;
  const gapCount = overallScore.topGaps.length;

  let narrative = `Your site scored a ${grade} (${score}). `;

  if (best.key !== worst.key) {
    narrative += `${best.label} is your strongest area at ${best.grade} (${best.score}), while ${worst.label} needs the most attention at ${worst.grade} (${worst.score}). `;
  }

  if (strengthCount > 0 && gapCount > 0) {
    narrative += `We found ${strengthCount} strength${strengthCount > 1 ? 's' : ''} and ${gapCount} area${gapCount > 1 ? 's' : ''} needing improvement.`;
  } else if (strengthCount > 0) {
    narrative += `We found ${strengthCount} strength${strengthCount > 1 ? 's' : ''} across your site.`;
  } else if (gapCount > 0) {
    narrative += `We identified ${gapCount} area${gapCount > 1 ? 's' : ''} for improvement.`;
  }

  return narrative;
}

// ── Main Component ─────────────────────────────────────────

type Props = {
  overallScore: OverallScore;
  analyzing?: boolean;
  progressPercent?: number;
  aiNarrative?: string | null;
  onCategoryClick?: (categoryKey: string) => void;
};

export function ExecutiveSummaryHero({ overallScore, analyzing, progressPercent, aiNarrative, onCategoryClick }: Props) {
  const hasSignals = !analyzing && (overallScore.topStrengths.length > 0 || overallScore.topGaps.length > 0);
  const narrative = aiNarrative || (!analyzing ? generateFallbackNarrative(overallScore) : '');

  return (
    <Card className="p-6 sm:p-8 mb-8 bg-gradient-to-br from-primary/[0.015] to-transparent animate-hero-fade">
      {/* Top: Ring + Narrative */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <ScoreRing
            score={overallScore.score}
            grade={overallScore.grade}
            placeholder={analyzing}
            progressPercent={progressPercent}
          />
          <span className="text-xs text-muted-foreground font-medium">
            {analyzing ? 'Analyzing...' : 'Overall Score'}
          </span>
        </div>

        <div className="flex-1 w-full">
          {/* Narrative */}
          {narrative && !analyzing && (
            <p className="text-sm leading-relaxed text-foreground/80 mb-5">{narrative}</p>
          )}
          {analyzing && (
            <p className="text-sm text-muted-foreground mb-5">Running site health analysis. Scores will appear as integrations complete.</p>
          )}

          {/* Category Mini Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {analyzing
              ? overallScore.categories.map((cat) => (
                  <CategoryMiniCardPlaceholder key={cat.key} label={cat.label} iconKey={cat.key} />
                ))
              : overallScore.categories.map((cat, i) => (
                  <div key={cat.key} className="animate-pill-pop" style={{ animationDelay: `${i * 60}ms` }}>
                    <CategoryMiniCard
                      cat={cat}
                      onClick={() => onCategoryClick?.(cat.key)}
                    />
                  </div>
                ))
            }
          </div>
        </div>
      </div>

      {/* Bottom: Strengths + Priority Actions */}
      {hasSignals && (
        <div className="mt-6 pt-6 border-t border-border/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {overallScore.topStrengths.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  What's Working
                </h4>
                <div className="space-y-0.5">
                  {overallScore.topStrengths.map((s) => (
                    <StrengthItem key={s.key} signal={s} />
                  ))}
                </div>
              </div>
            )}
            {overallScore.topGaps.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Priority Actions
                </h4>
                <div className="space-y-0.5">
                  {overallScore.topGaps.map((s, i) => (
                    <GapItem key={s.key} signal={s} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-[10px] text-muted-foreground/50 mt-5">
        {analyzing
          ? 'SUPER CRAWL v1.0'
          : `SUPER CRAWL v1.0 — ${overallScore.categories.reduce((sum, c) => sum + c.integrations.length, 0)} integrations across ${overallScore.categories.length} health categories`
        }
      </p>
    </Card>
  );
}
