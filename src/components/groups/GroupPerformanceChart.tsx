import { useMemo } from 'react';
import { Trophy } from 'lucide-react';

type SessionData = { id: string; domain: string; [key: string]: any };

type Props = {
  sessions: SessionData[];
};

type MetricRow = {
  label: string;
  values: { domain: string; value: number | null; display: string }[];
  unit: string;
  higherIsBetter: boolean;
};

function getPsiScore(session: any, mode: 'mobile' | 'desktop'): number | null {
  const psi = session.psi_data;
  if (!psi?.[mode]) return null;
  const raw = psi[mode]?.lighthouseResult?.categories?.performance?.score;
  if (raw != null) return Math.round(raw * 100);
  const pre = psi[mode]?.categories?.performance;
  if (typeof pre === 'number') return Math.round(pre);
  return null;
}

function getCruxMetric(session: any, metric: string): { p75: number; unit: string } | null {
  const m = session.crux_data?.record?.metrics?.[metric];
  if (!m?.percentiles?.p75) return null;
  const p75 = m.percentiles.p75;
  if (metric === 'cumulative_layout_shift') return { p75: Math.round(p75 * 100) / 100, unit: '' };
  return { p75: Math.round(p75), unit: 'ms' };
}

function getGtmetrixGrade(session: any): string | null {
  if (session.gtmetrix_grade) return session.gtmetrix_grade;
  if (session.gtmetrix_scores?.grade) return session.gtmetrix_scores.grade;
  return null;
}

function getGtmetrixPerf(session: any): number | null {
  if (session.gtmetrix_scores?.performance != null) return Math.round(session.gtmetrix_scores.performance);
  return null;
}

function scoreToBarColor(score: number, max: number, higherIsBetter: boolean): string {
  const pct = higherIsBetter ? score / max : 1 - score / max;
  if (pct >= 0.8) return 'bg-emerald-500';
  if (pct >= 0.6) return 'bg-blue-500';
  if (pct >= 0.4) return 'bg-yellow-500';
  if (pct >= 0.2) return 'bg-orange-500';
  return 'bg-red-500';
}

function MetricSection({ title, rows }: { title: string; rows: MetricRow[] }) {
  const hasData = rows.some(r => r.values.some(v => v.value != null));
  if (!hasData) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {rows.map(row => {
        const withValues = row.values.filter(v => v.value != null);
        if (withValues.length === 0) return null;

        const numericValues = withValues.map(v => v.value!);
        const max = Math.max(...numericValues, 1);
        const bestValue = row.higherIsBetter ? Math.max(...numericValues) : Math.min(...numericValues);

        return (
          <div key={row.label} className="space-y-1.5">
            <div className="text-sm font-medium">{row.label}</div>
            <div className="space-y-1">
              {row.values.map(v => {
                if (v.value == null) return (
                  <div key={v.domain} className="flex items-center gap-2 h-7">
                    <span className="text-xs text-muted-foreground w-28 truncate shrink-0">{v.domain}</span>
                    <span className="text-xs text-muted-foreground/40">No data</span>
                  </div>
                );

                const barPct = row.higherIsBetter
                  ? (v.value / max) * 100
                  : ((max - v.value) / max) * 100 + 10;
                const isBest = v.value === bestValue && withValues.length > 1;

                return (
                  <div key={v.domain} className="flex items-center gap-2 h-7">
                    <span className="text-xs text-muted-foreground w-28 truncate shrink-0">{v.domain}</span>
                    <div className="flex-1 bg-muted/50 rounded-full h-5 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${scoreToBarColor(v.value, max, row.higherIsBetter)}`}
                        style={{ width: `${Math.max(barPct, 4)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-16 text-right tabular-nums">
                      {v.display}{row.unit && <span className="text-muted-foreground ml-0.5">{row.unit}</span>}
                    </span>
                    {isBest && <Trophy className="h-3 w-3 text-amber-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GroupPerformanceChart({ sessions }: Props) {
  const { psiRows, cruxRows, gtmetrixRows } = useMemo(() => {
    const psi: MetricRow[] = [
      {
        label: 'Mobile Performance',
        unit: '',
        higherIsBetter: true,
        values: sessions.map(s => ({ domain: s.domain, value: getPsiScore(s, 'mobile'), display: String(getPsiScore(s, 'mobile') ?? '') })),
      },
      {
        label: 'Desktop Performance',
        unit: '',
        higherIsBetter: true,
        values: sessions.map(s => ({ domain: s.domain, value: getPsiScore(s, 'desktop'), display: String(getPsiScore(s, 'desktop') ?? '') })),
      },
    ];

    const cruxMetrics = [
      { key: 'largest_contentful_paint', label: 'LCP', higherIsBetter: false },
      { key: 'interaction_to_next_paint', label: 'INP', higherIsBetter: false },
      { key: 'cumulative_layout_shift', label: 'CLS', higherIsBetter: false },
      { key: 'first_contentful_paint', label: 'FCP', higherIsBetter: false },
    ];

    const crux: MetricRow[] = cruxMetrics.map(m => ({
      label: m.label,
      unit: m.key === 'cumulative_layout_shift' ? '' : 'ms',
      higherIsBetter: m.higherIsBetter,
      values: sessions.map(s => {
        const data = getCruxMetric(s, m.key);
        return { domain: s.domain, value: data?.p75 ?? null, display: data ? String(data.p75) : '' };
      }),
    }));

    const gtmetrix: MetricRow[] = [
      {
        label: 'GTmetrix Performance',
        unit: '%',
        higherIsBetter: true,
        values: sessions.map(s => ({ domain: s.domain, value: getGtmetrixPerf(s), display: String(getGtmetrixPerf(s) ?? '') })),
      },
    ];

    return { psiRows: psi, cruxRows: crux, gtmetrixRows: gtmetrix };
  }, [sessions]);

  const hasAnyData = [...psiRows, ...cruxRows, ...gtmetrixRows].some(r => r.values.some(v => v.value != null));

  if (!hasAnyData) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No performance data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <MetricSection title="PageSpeed Insights" rows={psiRows} />
      <MetricSection title="Core Web Vitals (CrUX)" rows={cruxRows} />
      <MetricSection title="GTmetrix" rows={gtmetrixRows} />
    </div>
  );
}
