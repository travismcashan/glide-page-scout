import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import {
  type OverallScore,
  type CategoryScore,
  gradeToColor,
  gradeToBgColor,
} from '@/lib/siteScore';
import { Gauge, Shield, Search, Accessibility, FileText, Code, Zap, Link, Loader2 } from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  performance: <Zap className="h-4 w-4" />,
  seo: <Search className="h-4 w-4" />,
  accessibility: <Accessibility className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  content: <FileText className="h-4 w-4" />,
  technology: <Code className="h-4 w-4" />,
  'url-analysis': <Link className="h-4 w-4" />,
};

function ScoreRing({ score, grade, size = 120, placeholder }: { score: number; grade: string; size?: number; placeholder?: boolean }) {
  const strokeWidth = size > 80 ? 8 : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = placeholder ? 0 : (score / 100) * circumference;

  const strokeColor = placeholder ? 'hsl(var(--muted))' : grade === 'A' ? '#10b981' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#eab308' : grade === 'D' ? '#f97316' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        {!placeholder && (
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
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

type Props = {
  overallScore: OverallScore;
  analyzing?: boolean;
};

export function ScoreOverview({ overallScore, analyzing }: Props) {
  return (
    <Card className="p-6 mb-8">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Overall ring */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <ScoreRing score={overallScore.score} grade={overallScore.grade} placeholder={analyzing} />
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
              : `Based on ${overallScore.categories.reduce((sum, c) => sum + c.integrations.length, 0)} integrations across ${overallScore.categories.length} categories. Missing integrations are excluded, not penalized.`
            }
          </p>
        </div>
      </div>
    </Card>
  );
}
