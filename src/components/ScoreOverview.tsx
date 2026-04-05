import {
  type OverallScore,
  type CategoryScore,
  type ScoreSignal,
  gradeToColor,
  gradeToBgColor,
} from '@/lib/siteScore';
import { Shield, Search, Accessibility, FileText, Zap, Link, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  performance: <Zap className="h-4 w-4" />,
  seo: <Search className="h-4 w-4" />,
  accessibility: <Accessibility className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  'content-ux': <FileText className="h-4 w-4" />,
  'url-health': <Link className="h-4 w-4" />,
};

function ScoreRing({ score, grade, size = 120, placeholder, progressPercent }: { score: number; grade: string; size?: number; placeholder?: boolean; progressPercent?: number }) {
  const strokeWidth = size > 80 ? 8 : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = placeholder ? 0 : (score / 100) * circumference;

  const strokeColor = placeholder ? 'hsl(var(--muted))' : grade === 'A' ? '#10b981' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#eab308' : grade === 'D' ? '#f97316' : '#ef4444';

  const hasProgress = placeholder && progressPercent !== undefined;
  const progressArc = hasProgress ? (progressPercent / 100) * circumference : 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className={placeholder && !hasProgress ? 'animate-spin' : '-rotate-90'} style={placeholder && !hasProgress ? { animationDuration: '2s' } : undefined}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        {placeholder ? (
          hasProgress ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--primary) / 0.4)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progressArc}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          ) : (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--primary) / 0.4)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference * 0.3} ${circumference * 0.7}`}
              strokeLinecap="round"
            />
          )
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {placeholder ? (
          hasProgress ? (
            <span className="text-3xl font-bold text-muted-foreground">{progressPercent}%</span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">Analyzing</span>
          )
        ) : (
          <>
            <span className={`text-3xl font-bold ${gradeToColor(grade as any)}`}>{grade}</span>
            <span className="text-sm text-muted-foreground">{score}</span>
          </>
        )}
      </div>
    </div>
  );
}

function CategoryPill({ cat }: { cat: CategoryScore }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${gradeToBgColor(cat.grade)}`}>
      <div className="text-muted-foreground">{CATEGORY_ICONS[cat.key]}</div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground leading-tight">{cat.label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${gradeToColor(cat.grade)}`}>{cat.grade}</span>
          <span className="text-xs text-muted-foreground">· {cat.score}</span>
        </div>
      </div>
    </div>
  );
}

function CategoryPillPlaceholder({ label, iconKey }: { label: string; iconKey: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 bg-muted/30">
      <div className="text-muted-foreground/40">{CATEGORY_ICONS[iconKey]}</div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground/60 leading-tight">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-muted-foreground/40">—</span>
        </div>
      </div>
    </div>
  );
}

function SignalItem({ signal, type }: { signal: ScoreSignal; type: 'strength' | 'gap' }) {
  return (
    <div className="flex items-start gap-2 py-1">
      {type === 'strength' ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
      )}
      <span className="text-xs text-muted-foreground leading-relaxed">{signal.summary}</span>
    </div>
  );
}

type Props = {
  overallScore: OverallScore;
  analyzing?: boolean;
  progressPercent?: number;
};

export function ScoreOverview({ overallScore, analyzing, progressPercent }: Props) {
  const hasSignals = !analyzing && (overallScore.topStrengths.length > 0 || overallScore.topGaps.length > 0);

  return (
    <Card className="p-6 mb-8">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Overall ring */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <ScoreRing score={overallScore.score} grade={overallScore.grade} placeholder={analyzing} progressPercent={progressPercent} />
          <span className="text-xs text-muted-foreground font-medium mt-1">
            {analyzing ? 'Analyzing…' : 'Overall Score'}
          </span>
        </div>

        {/* Category pills */}
        <div className="flex-1 w-full">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {analyzing
              ? overallScore.categories.map((cat) => (
                  <CategoryPillPlaceholder key={cat.key} label={cat.label} iconKey={cat.key} />
                ))
              : overallScore.categories.map((cat) => (
                  <CategoryPill key={cat.key} cat={cat} />
                ))
            }
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            {analyzing
              ? 'Scores will appear once all integrations complete.'
              : `SUPER CRAWL v1.0 — ${overallScore.categories.reduce((sum, c) => sum + c.integrations.length, 0)} integrations across ${overallScore.categories.length} health categories. Missing integrations are excluded, not penalized.`
            }
          </p>
        </div>
      </div>

      {/* Strengths & Gaps */}
      {hasSignals && (
        <div className="mt-5 pt-5 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Strengths */}
            {overallScore.topStrengths.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  What's Working
                </h4>
                <div className="space-y-0.5">
                  {overallScore.topStrengths.map((s) => (
                    <SignalItem key={s.key} signal={s} type="strength" />
                  ))}
                </div>
              </div>
            )}
            {/* Gaps */}
            {overallScore.topGaps.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Needs Attention
                </h4>
                <div className="space-y-0.5">
                  {overallScore.topGaps.map((s) => (
                    <SignalItem key={s.key} signal={s} type="gap" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
