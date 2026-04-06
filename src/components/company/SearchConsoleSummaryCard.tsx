import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, MousePointerClick, Eye, Hash, ArrowUpDown } from 'lucide-react';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

interface SearchConsoleSummaryCardProps {
  data: any;
}

export function SearchConsoleSummaryCard({ data }: SearchConsoleSummaryCardProps) {
  if (!data || !data.summary) return null;

  const s = data.summary;

  const stats = [
    { label: 'Clicks', value: formatNumber(s.totalClicks || 0), icon: MousePointerClick },
    { label: 'Impressions', value: formatNumber(s.totalImpressions || 0), icon: Eye },
    { label: 'Avg CTR', value: `${((s.avgCtr || 0) * 100).toFixed(1)}%`, icon: Hash },
    { label: 'Avg Position', value: (s.avgPosition || 0).toFixed(1), icon: ArrowUpDown },
  ];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          Search Console
          {data.siteUrl && <span className="text-xs text-muted-foreground font-normal">— {data.siteUrl}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(st => (
            <div key={st.label} className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <st.icon className="h-3 w-3" />
                {st.label}
              </div>
              <span className="text-lg font-semibold">{st.value}</span>
            </div>
          ))}
        </div>

        {data.topQueries?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Top Queries</p>
            <div className="space-y-1">
              {data.topQueries.slice(0, 5).map((q: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                  <span className="truncate flex-1 text-muted-foreground">{q.query}</span>
                  <div className="flex items-center gap-3 ml-2 shrink-0">
                    <span className="font-medium">{formatNumber(q.clicks)} clicks</span>
                    <span className="text-muted-foreground">{formatNumber(q.impressions)} imp</span>
                  </div>
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
