import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, TrendingDown, Users, Clock, MousePointerClick } from 'lucide-react';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function Change({ current, previous }: { current: number; previous: number }) {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 1) return null;
  return pct > 0
    ? <span className="flex items-center gap-0.5 text-emerald-500 text-[10px]"><TrendingUp className="h-3 w-3" />+{pct.toFixed(0)}%</span>
    : <span className="flex items-center gap-0.5 text-red-500 text-[10px]"><TrendingDown className="h-3 w-3" />{pct.toFixed(0)}%</span>;
}

interface GA4SummaryCardProps {
  data: any;
}

export function GA4SummaryCard({ data }: GA4SummaryCardProps) {
  if (!data || !data.overview?.current) return null;

  const c = data.overview.current;
  const p = data.overview.previous || {};

  const stats = [
    { label: 'Users', value: formatNumber(c.totalUsers || 0), prev: p.totalUsers, current: c.totalUsers, icon: Users },
    { label: 'Sessions', value: formatNumber(c.sessions || 0), prev: p.sessions, current: c.sessions, icon: MousePointerClick },
    { label: 'Avg Duration', value: formatDuration(c.averageSessionDuration || 0), prev: null, current: null, icon: Clock },
    { label: 'Bounce Rate', value: formatPct(c.bounceRate || 0), prev: null, current: null, icon: BarChart3 },
  ];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Google Analytics (GA4)
          {data.propertyName && <span className="text-xs text-muted-foreground font-normal">— {data.propertyName}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <s.icon className="h-3 w-3" />
                {s.label}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-semibold">{s.value}</span>
                {s.prev != null && s.current != null && <Change current={s.current} previous={s.prev} />}
              </div>
            </div>
          ))}
        </div>

        {data.topPages?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Top Pages</p>
            <div className="space-y-1">
              {data.topPages.slice(0, 5).map((page: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                  <span className="truncate flex-1 text-muted-foreground">{page.pagePath || page.page || '/'}</span>
                  <span className="font-medium ml-2">{formatNumber(page.screenPageViews || page.views || 0)} views</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.period && (
          <p className="text-[10px] text-muted-foreground mt-3">
            {data.period.start} — {data.period.end}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
