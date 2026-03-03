import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Users, Smartphone, Monitor, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type MetricData = {
  p75: number;
  good: number;
  needsImprovement: number;
  poor: number;
};

type CruxMetrics = {
  largest_contentful_paint?: MetricData;
  cumulative_layout_shift?: MetricData;
  interaction_to_next_paint?: MetricData;
  first_contentful_paint?: MetricData;
  experimental_time_to_first_byte?: MetricData;
};

type CruxData = {
  overall: CruxMetrics | null;
  phone: CruxMetrics | null;
  desktop: CruxMetrics | null;
  collectionPeriod?: { firstDate?: { year: number; month: number; day: number }; lastDate?: { year: number; month: number; day: number } } | null;
};

type Props = {
  data: CruxData | null;
  isLoading: boolean;
  noData?: boolean;
};

const metricConfig: { key: string; label: string; unit: 'ms' | 'score'; goodThreshold: number; poorThreshold: number }[] = [
  { key: 'largest_contentful_paint', label: 'LCP', unit: 'ms', goodThreshold: 2500, poorThreshold: 4000 },
  { key: 'cumulative_layout_shift', label: 'CLS', unit: 'score', goodThreshold: 0.1, poorThreshold: 0.25 },
  { key: 'interaction_to_next_paint', label: 'INP', unit: 'ms', goodThreshold: 200, poorThreshold: 500 },
  { key: 'first_contentful_paint', label: 'FCP', unit: 'ms', goodThreshold: 1800, poorThreshold: 3000 },
  { key: 'experimental_time_to_first_byte', label: 'TTFB', unit: 'ms', goodThreshold: 800, poorThreshold: 1800 },
];

function formatValue(value: number | string | undefined, unit: 'ms' | 'score'): string {
  if (value == null) return '—';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '—';
  if (unit === 'score') return num.toFixed(2);
  if (num >= 1000) return `${(num / 1000).toFixed(1)}s`;
  return `${Math.round(num)}ms`;
}

function getAssessment(value: number | undefined, good: number, poor: number): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
  if (value == null) return 'unknown';
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

function assessmentColor(a: string): string {
  if (a === 'good') return 'text-green-600 dark:text-green-400';
  if (a === 'needs-improvement') return 'text-yellow-600 dark:text-yellow-400';
  if (a === 'poor') return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

function assessmentBg(a: string): string {
  if (a === 'good') return 'bg-green-100 dark:bg-green-900/30';
  if (a === 'needs-improvement') return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (a === 'poor') return 'bg-red-100 dark:bg-red-900/30';
  return 'bg-muted';
}

function DistributionBar({ good, needsImprovement, poor }: { good: number; needsImprovement: number; poor: number }) {
  const gPct = Math.round(good * 100);
  const niPct = Math.round(needsImprovement * 100);
  const pPct = Math.round(poor * 100);

  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-2 rounded-full overflow-hidden flex">
        {gPct > 0 && <div className="bg-green-500 h-full" style={{ width: `${gPct}%` }} />}
        {niPct > 0 && <div className="bg-yellow-500 h-full" style={{ width: `${niPct}%` }} />}
        {pPct > 0 && <div className="bg-red-500 h-full" style={{ width: `${pPct}%` }} />}
      </div>
      <div className="flex gap-1.5 text-[9px] text-muted-foreground shrink-0">
        <span className="text-green-600">{gPct}%</span>
        <span className="text-yellow-600">{niPct}%</span>
        <span className="text-red-600">{pPct}%</span>
      </div>
    </div>
  );
}

function MetricRow({ metric, data }: { metric: typeof metricConfig[0]; data: MetricData | undefined }) {
  if (!data) return null;
  const assessment = getAssessment(data.p75, metric.goodThreshold, metric.poorThreshold);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
        <div className={`text-sm font-bold ${assessmentColor(assessment)}`}>
          {formatValue(data.p75, metric.unit)}
        </div>
      </div>
      <DistributionBar good={data.good} needsImprovement={data.needsImprovement} poor={data.poor} />
    </div>
  );
}

function MetricsPanel({ label, icon, metrics }: { label: string; icon: React.ReactNode; metrics: CruxMetrics | null }) {
  const [open, setOpen] = useState(label === 'All Users');

  if (!metrics) return null;

  // Compute overall CWV pass/fail
  const lcp = metrics.largest_contentful_paint;
  const cls = metrics.cumulative_layout_shift;
  const inp = metrics.interaction_to_next_paint;
  const cwvPass = lcp && cls && inp &&
    lcp.p75 <= 2500 && cls.p75 <= 0.1 && inp.p75 <= 200;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
        {icon}
        <span className="text-sm font-medium flex-1">{label}</span>
        {cwvPass != null && (
          <Badge variant={cwvPass ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
            {cwvPass ? 'CWV Pass' : 'CWV Fail'}
          </Badge>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pt-2 pb-2 space-y-3">
        {metricConfig.map(mc => {
          const d = metrics[mc.key as keyof CruxMetrics];
          return d ? <MetricRow key={mc.key} metric={mc} data={d} /> : null;
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function formatPeriod(period: CruxData['collectionPeriod']): string {
  if (!period?.firstDate || !period?.lastDate) return '';
  const fmt = (d: { year: number; month: number; day: number }) =>
    `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  return `${fmt(period.firstDate)} → ${fmt(period.lastDate)}`;
}

export function CruxCard({ data, isLoading, noData }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Users className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Fetching real-user field data from CrUX...</span>
      </div>
    );
  }

  if (noData) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Chrome UX Report — Field Data</span>
        </div>
        <p className="text-xs text-muted-foreground">No field data available. This origin may not have enough Chrome traffic to be included in CrUX.</p>
      </div>
    );
  }

  if (!data) return null;

  const period = formatPeriod(data.collectionPeriod);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Chrome UX Report — Field Data</span>
        </div>
        {period && <span className="text-[10px] text-muted-foreground">{period}</span>}
      </div>

      <p className="text-xs text-muted-foreground">
        Real-user experience data from Chrome browsers over the last 28 days. Distribution bars show % of page loads rated good / needs improvement / poor.
      </p>

      <div className="space-y-1">
        <MetricsPanel label="All Users" icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />} metrics={data.overall} />
        <MetricsPanel label="Mobile" icon={<Smartphone className="h-3.5 w-3.5 text-muted-foreground" />} metrics={data.phone} />
        <MetricsPanel label="Desktop" icon={<Monitor className="h-3.5 w-3.5 text-muted-foreground" />} metrics={data.desktop} />
      </div>
    </div>
  );
}
