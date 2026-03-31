import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Search, Link2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type DailyTrendItem = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type SitemapItem = {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  warnings?: number;
  errors?: number;
  contents?: { type: string; submitted?: number; indexed?: number }[];
};

type SearchConsoleData = {
  success: boolean;
  found?: boolean;
  message?: string;
  siteUrl?: string;
  period?: { start: string; end: string };
  summary?: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
    totalQueries: number;
    totalPages: number;
  };
  topQueries?: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topPages?: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
  dailyTrend?: DailyTrendItem[];
  sitemaps?: SitemapItem[];
  availableSites?: { url: string; permissionLevel: string }[];
};

type Props = {
  data: SearchConsoleData | null;
  onSelectSite?: (siteUrl: string) => void;
  isSelecting?: boolean;
  isConnected?: boolean;
  onConnect?: () => void;
  isConnecting?: boolean;
  availableSites?: { url: string; permissionLevel: string }[];
  onFetchSites?: () => void;
  isFetchingSites?: boolean;
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function SearchConsoleCard({ data, onSelectSite, isSelecting, isConnected, onConnect, isConnecting, availableSites, onFetchSites, isFetchingSites }: Props) {
  const [showQueries, setShowQueries] = useState(true);
  const [showPages, setShowPages] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const [trendMetric, setTrendMetric] = useState<'clicks' | 'impressions'>('clicks');
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // State 1: Not connected — show connect button
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-6 space-y-3">
        <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Search className="h-5 w-5 text-emerald-600" />
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Connect your Google Search Console to pull search queries, impressions, clicks, and indexing data for this site.
        </p>
        <Button
          size="sm"
          onClick={onConnect}
          disabled={isConnecting}
        >
          {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />}
          Connect Search Console
        </Button>
      </div>
    );
  }

  // State 2: Connected but no data — show site picker
  if (!data || !data.found) {
    const sites = data?.availableSites || availableSites || [];
    const count = sites.length;
    return (
      <div className="space-y-3">
        {data?.message ? (
          <p className="text-sm text-muted-foreground">{data.message}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Google account connected. Select a Search Console property to pull data for this site.
          </p>
        )}
        {count > 0 && onSelectSite ? (
          <div className="space-y-2">
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {pickerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Select a Search Console site ({count} available)
            </button>
            {pickerOpen && (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pl-6">
                {sites.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedUrl(s.url);
                      onSelectSite(s.url);
                    }}
                    disabled={isSelecting}
                    className="w-full text-left px-3 py-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors text-sm disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium font-mono">{s.url}</span>
                      {isSelecting && selectedUrl === s.url && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.permissionLevel}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : count === 0 && onFetchSites ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onFetchSites}
            disabled={isFetchingSites}
          >
            {isFetchingSites ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
            Load available sites
          </Button>
        ) : null}
      </div>
    );
  }

  // State 3: Has data — show search console analytics
  const summary = data.summary;

  return (
    <div className="space-y-4">
      {/* Site info */}
      {data.siteUrl && (
        <p className="text-xs text-muted-foreground">
          Property: <span className="font-medium text-foreground">{data.siteUrl}</span>
          {data.period && <span className="ml-2">({data.period.start} → {data.period.end})</span>}
        </p>
      )}

      {/* Summary metrics */}
      {summary && (
        <div className="flex items-center gap-3 flex-wrap">
          <MetaStat value={formatNumber(summary.totalClicks)} label="Total Clicks" />
          <MetaStatDivider />
          <MetaStat value={formatNumber(summary.totalImpressions)} label="Impressions" />
          <MetaStatDivider />
          <MetaStat value={formatPct(summary.avgCtr)} label="Avg CTR" />
          <MetaStatDivider />
          <MetaStat value={summary.avgPosition.toFixed(1)} label="Avg Position" />
          <MetaStatDivider />
          <MetaStat value={summary.totalQueries} label="Queries" />
          <MetaStatDivider />
          <MetaStat value={summary.totalPages} label="Pages" />
        </div>
      )}

      {/* Top Queries */}
      {data.topQueries && data.topQueries.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowQueries(!showQueries)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
          >
            {showQueries ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-xs font-semibold">Top Search Queries</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{data.topQueries.length}</Badge>
          </button>
          {showQueries && (
            <div className="max-h-[300px] overflow-y-auto">
              <div className="sticky top-0 flex items-center px-3 py-1 border-b border-border bg-muted/80 backdrop-blur-sm z-10">
                <span className="flex-1 text-[10px] font-medium text-muted-foreground">Query</span>
                <span className="w-16 text-right text-[10px] font-medium text-muted-foreground">Clicks</span>
                <span className="w-20 text-right text-[10px] font-medium text-muted-foreground">Impressions</span>
                <span className="w-14 text-right text-[10px] font-medium text-muted-foreground">CTR</span>
                <span className="w-14 text-right text-[10px] font-medium text-muted-foreground">Position</span>
              </div>
              {data.topQueries.map((q, i) => (
                <div key={i} className="flex items-center px-3 py-1.5 border-t border-border/50 hover:bg-muted/20 text-xs">
                  <span className="flex-1 truncate mr-2">{q.query}</span>
                  <span className="w-16 text-right font-medium">{formatNumber(q.clicks)}</span>
                  <span className="w-20 text-right text-muted-foreground">{formatNumber(q.impressions)}</span>
                  <span className="w-14 text-right text-muted-foreground">{formatPct(q.ctr)}</span>
                  <span className="w-14 text-right text-muted-foreground">{q.position.toFixed(1)}</span>
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
            <span className="text-xs font-semibold">Top Pages by Clicks</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{data.topPages.length}</Badge>
          </button>
          {showPages && (
            <div className="max-h-[300px] overflow-y-auto">
              <div className="sticky top-0 flex items-center px-3 py-1 border-b border-border bg-muted/80 backdrop-blur-sm z-10">
                <span className="flex-1 text-[10px] font-medium text-muted-foreground">Page</span>
                <span className="w-16 text-right text-[10px] font-medium text-muted-foreground">Clicks</span>
                <span className="w-20 text-right text-[10px] font-medium text-muted-foreground">Impressions</span>
                <span className="w-14 text-right text-[10px] font-medium text-muted-foreground">CTR</span>
                <span className="w-14 text-right text-[10px] font-medium text-muted-foreground">Position</span>
              </div>
              {data.topPages.map((p, i) => {
                let displayPath = p.page;
                try { displayPath = new URL(p.page).pathname; } catch {}
                return (
                  <div key={i} className="flex items-center px-3 py-1.5 border-t border-border/50 hover:bg-muted/20 text-xs">
                    <span className="flex-1 font-mono text-muted-foreground truncate mr-2" title={p.page}>{displayPath}</span>
                    <span className="w-16 text-right font-medium">{formatNumber(p.clicks)}</span>
                    <span className="w-20 text-right text-muted-foreground">{formatNumber(p.impressions)}</span>
                    <span className="w-14 text-right text-muted-foreground">{formatPct(p.ctr)}</span>
                    <span className="w-14 text-right text-muted-foreground">{p.position.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Daily Trend */}
      {data.dailyTrend && data.dailyTrend.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowTrend(!showTrend)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
          >
            {showTrend ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-xs font-semibold">Daily Trend</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{data.dailyTrend.length}d</Badge>
          </button>
          {showTrend && (
            <div className="p-3 space-y-2">
              <div className="flex gap-1">
                {(['clicks', 'impressions'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setTrendMetric(m)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      trendMetric === m
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      className="text-muted-foreground"
                      tickFormatter={(d: string) => {
                        const dt = new Date(d);
                        return `${dt.getMonth() + 1}/${dt.getDate()}`;
                      }}
                      interval={Math.max(0, Math.floor((data.dailyTrend?.length || 0) / 8))}
                    />
                    <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" width={40} tickFormatter={(v: number) => formatNumber(v)} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
                      formatter={(value: number) => [formatNumber(value), trendMetric.charAt(0).toUpperCase() + trendMetric.slice(1)]}
                    />
                    <Area
                      type="monotone"
                      dataKey={trendMetric}
                      className="fill-primary/20 stroke-primary"
                      fill="hsl(var(--primary) / 0.2)"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sitemaps info */}
      {data.sitemaps && data.sitemaps.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <span className="text-xs font-semibold">Submitted Sitemaps</span>
          <div className="space-y-1.5">
            {data.sitemaps.map((sm: SitemapItem, i: number) => (
              <div key={i} className="text-xs space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground truncate">{sm.path}</span>
                  {sm.errors && sm.errors > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">{sm.errors} errors</Badge>}
                  {sm.warnings && sm.warnings > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-yellow-600">{sm.warnings} warnings</Badge>}
                  {sm.isPending && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Pending</Badge>}
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  {sm.lastSubmitted && <span>Submitted: {new Date(sm.lastSubmitted).toLocaleDateString()}</span>}
                  {sm.lastDownloaded && <span>Downloaded: {new Date(sm.lastDownloaded).toLocaleDateString()}</span>}
                </div>
                {sm.contents && sm.contents.length > 0 && (
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    {sm.contents.map((c, ci) => (
                      <span key={ci}>{c.type}: {c.submitted ?? '?'} submitted{c.indexed != null ? `, ${c.indexed} indexed` : ''}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
