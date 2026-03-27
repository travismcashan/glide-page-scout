import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

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
  dailyTrend?: any[];
  sitemaps?: any[];
  availableSites?: { url: string; permissionLevel: string }[];
};

type Props = {
  data: SearchConsoleData;
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function SearchConsoleCard({ data }: Props) {
  const [showQueries, setShowQueries] = useState(true);
  const [showPages, setShowPages] = useState(false);

  if (!data.found) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground italic">
          {data.message || 'No Search Console property found for this domain.'}
        </p>
        {data.availableSites && data.availableSites.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Available sites:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {data.availableSites.map((s, i) => (
                <li key={i}>{s.url} ({s.permissionLevel})</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

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
        <div className="flex items-center gap-4 flex-wrap">
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

      {/* Sitemaps info */}
      {data.sitemaps && data.sitemaps.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Submitted sitemaps:</span>{' '}
          {data.sitemaps.map((sm, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {sm.path}
              {sm.errors > 0 && <span className="text-red-500 ml-1">({sm.errors} errors)</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
