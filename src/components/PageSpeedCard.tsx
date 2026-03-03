import { Badge } from '@/components/ui/badge';
import { Loader2, Gauge } from 'lucide-react';

type PsiScores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: number | null;
  lcp: number | null;
  tbt: number | null;
  cls: number | null;
  si: number | null;
  tti: number | null;
};

type PsiCardProps = {
  data: { mobile?: PsiScores; desktop?: PsiScores } | null;
  isLoading: boolean;
};

function formatMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function scoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 90) return 'default';
  if (score >= 50) return 'secondary';
  return 'destructive';
}

function ScoreRow({ label, mobile, desktop }: { label: string; mobile: number; desktop: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <Badge variant={scoreBadgeVariant(mobile)} className="min-w-[3rem] justify-center">{mobile}</Badge>
        <Badge variant={scoreBadgeVariant(desktop)} className="min-w-[3rem] justify-center">{desktop}</Badge>
      </div>
    </div>
  );
}

export function PageSpeedCard({ data, isLoading }: PsiCardProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">PageSpeed Insights</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground min-h-[2.5rem]">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span className="text-sm">Running PageSpeed Insights (mobile + desktop)...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.mobile || !data.desktop) return null;

  const { mobile, desktop } = data;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">PageSpeed Insights</span>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground px-1">
        <span className="min-w-[3rem] text-center">Mobile</span>
        <span className="min-w-[3rem] text-center">Desktop</span>
      </div>

      {/* Category scores */}
      <div className="space-y-2">
        <ScoreRow label="Performance" mobile={mobile.performance} desktop={desktop.performance} />
        <ScoreRow label="Accessibility" mobile={mobile.accessibility} desktop={desktop.accessibility} />
        <ScoreRow label="Best Practices" mobile={mobile.bestPractices} desktop={desktop.bestPractices} />
        <ScoreRow label="SEO" mobile={mobile.seo} desktop={desktop.seo} />
      </div>

      {/* Core Web Vitals */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Core Web Vitals (Mobile)</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className={`text-lg font-bold ${scoreColor(mobile.lcp != null && mobile.lcp <= 2500 ? 90 : mobile.lcp != null && mobile.lcp <= 4000 ? 60 : 30)}`}>
              {formatMs(mobile.lcp)}
            </div>
            <div className="text-xs text-muted-foreground">LCP</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className={`text-lg font-bold ${scoreColor(mobile.tbt != null && mobile.tbt <= 200 ? 90 : mobile.tbt != null && mobile.tbt <= 600 ? 60 : 30)}`}>
              {formatMs(mobile.tbt)}
            </div>
            <div className="text-xs text-muted-foreground">TBT</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className={`text-lg font-bold ${scoreColor(mobile.cls != null && mobile.cls <= 0.1 ? 90 : mobile.cls != null && mobile.cls <= 0.25 ? 60 : 30)}`}>
              {mobile.cls?.toFixed(3) ?? '—'}
            </div>
            <div className="text-xs text-muted-foreground">CLS</div>
          </div>
        </div>
      </div>
    </div>
  );
}
