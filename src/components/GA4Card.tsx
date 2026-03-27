import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

type GA4Data = {
  success: boolean;
  found?: boolean;
  message?: string;
  propertyName?: string;
  period?: { start: string; end: string };
  overview?: {
    current: Record<string, number>;
    previous: Record<string, number>;
  } | null;
  topPages?: any[];
  trafficSources?: any[];
  dailyTrend?: any[];
  availableProperties?: { name: string; id: string }[];
};

type Props = {
  data: GA4Data;
  onSelectProperty?: (propertyId: string, propertyName: string) => void;
  isSelecting?: boolean;
};

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

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  if (!previous || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 1) return <Minus className="h-3 w-3 text-muted-foreground" />;
  return change > 0
    ? <span className="flex items-center gap-0.5 text-emerald-600 text-[10px] font-medium"><TrendingUp className="h-3 w-3" />+{change.toFixed(0)}%</span>
    : <span className="flex items-center gap-0.5 text-red-500 text-[10px] font-medium"><TrendingDown className="h-3 w-3" />{change.toFixed(0)}%</span>;
}

export function GA4Card({ data, onSelectProperty, isSelecting }: Props) {
  const [showPages, setShowPages] = useState(false);
  const [showSources, setShowSources] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!data.found) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {data.message || 'No GA4 property found for this domain.'}
        </p>
        {data.availableProperties && data.availableProperties.length > 0 && onSelectProperty && (
          <div className="space-y-2">
            <p className="text-xs font-medium">Select a GA4 property:</p>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {data.availableProperties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedId(p.id);
                    onSelectProperty(p.id, p.name);
                  }}
                  disabled={isSelecting}
                  className="w-full text-left px-3 py-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors text-sm disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.name}</span>
                    {isSelecting && selectedId === p.id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.id}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const overview = data.overview;
  const current = overview?.current || {};
  const previous = overview?.previous || {};

  return (
    <div className="space-y-4">
      {/* Property info */}
      {data.propertyName && (
        <p className="text-xs text-muted-foreground">
          Property: <span className="font-medium text-foreground">{data.propertyName}</span>
          {data.period && <span className="ml-2">({data.period.start} → {data.period.end})</span>}
        </p>
      )}

      {/* Overview metrics */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <MetaStat value={formatNumber(current.sessions || 0)} label="Sessions" />
          <ChangeIndicator current={current.sessions || 0} previous={previous.sessions || 0} />
        </div>
        <MetaStatDivider />
        <div className="flex items-center gap-1.5">
          <MetaStat value={formatNumber(current.totalUsers || 0)} label="Users" />
          <ChangeIndicator current={current.totalUsers || 0} previous={previous.totalUsers || 0} />
        </div>
        <MetaStatDivider />
        <div className="flex items-center gap-1.5">
          <MetaStat value={formatNumber(current.screenPageViews || 0)} label="Pageviews" />
          <ChangeIndicator current={current.screenPageViews || 0} previous={previous.screenPageViews || 0} />
        </div>
        <MetaStatDivider />
        <MetaStat value={formatPct(current.bounceRate || 0)} label="Bounce Rate" />
        <MetaStatDivider />
        <MetaStat value={formatDuration(current.averageSessionDuration || 0)} label="Avg Duration" />
        <MetaStatDivider />
        <MetaStat value={formatPct(current.engagementRate || 0)} label="Engagement" />
      </div>

      {/* Traffic Sources */}
      {data.trafficSources && data.trafficSources.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowSources(!showSources)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
          >
            {showSources ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-xs font-semibold">Traffic Sources</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{data.trafficSources.length}</Badge>
          </button>
          {showSources && (
            <div>
              <div className="flex items-center px-3 py-1 border-b border-border bg-muted/20">
                <span className="flex-1 text-[10px] font-medium text-muted-foreground">Channel</span>
                <span className="w-20 text-right text-[10px] font-medium text-muted-foreground">Sessions</span>
                <span className="w-16 text-right text-[10px] font-medium text-muted-foreground">Users</span>
                <span className="w-20 text-right text-[10px] font-medium text-muted-foreground">Engagement</span>
              </div>
              {data.trafficSources.map((src, i) => (
                <div key={i} className="flex items-center px-3 py-1.5 border-t border-border/50 hover:bg-muted/20 text-xs">
                  <span className="flex-1 font-medium">{src.sessionDefaultChannelGroup}</span>
                  <span className="w-20 text-right text-muted-foreground">{formatNumber(src.sessions)}</span>
                  <span className="w-16 text-right text-muted-foreground">{formatNumber(src.totalUsers)}</span>
                  <span className="w-20 text-right text-muted-foreground">{formatPct(src.engagementRate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top Pages */}
      {data.topPages && data.topPages.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowPages(!showPages)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
          >
            {showPages ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-xs font-semibold">Top Pages</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{data.topPages.length}</Badge>
          </button>
          {showPages && (
            <div className="max-h-[300px] overflow-y-auto">
              <div className="sticky top-0 flex items-center px-3 py-1 border-b border-border bg-muted/80 backdrop-blur-sm z-10">
                <span className="flex-1 text-[10px] font-medium text-muted-foreground">Page</span>
                <span className="w-20 text-right text-[10px] font-medium text-muted-foreground">Views</span>
                <span className="w-16 text-right text-[10px] font-medium text-muted-foreground">Sessions</span>
                <span className="w-16 text-right text-[10px] font-medium text-muted-foreground">Bounce</span>
              </div>
              {data.topPages.map((page, i) => (
                <div key={i} className="flex items-center px-3 py-1.5 border-t border-border/50 hover:bg-muted/20 text-xs">
                  <span className="flex-1 font-mono text-muted-foreground truncate mr-2" title={page.pageTitle}>{page.pagePath}</span>
                  <span className="w-20 text-right">{formatNumber(page.screenPageViews)}</span>
                  <span className="w-16 text-right text-muted-foreground">{formatNumber(page.sessions)}</span>
                  <span className="w-16 text-right text-muted-foreground">{formatPct(page.bounceRate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}