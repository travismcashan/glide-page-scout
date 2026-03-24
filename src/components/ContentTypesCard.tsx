import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ContentTypeSummary = {
  type: string;
  count: number;
  urls: string[];
  totalUrls: number;
  confidence: { high: number; medium: number; low: number };
};

type ContentTypesData = {
  summary: ContentTypeSummary[];
  stats: {
    total: number;
    bySource: Record<string, number>;
    uniqueTypes: number;
    ambiguousScanned: number;
  };
};

function confidenceBadge(conf: { high: number; medium: number; low: number }) {
  const total = conf.high + conf.medium + conf.low;
  if (total === 0) return null;
  const pct = Math.round((conf.high / total) * 100);
  if (pct >= 80) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30">High</Badge>;
  if (pct >= 40) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Medium</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-600 border-orange-500/30">Low</Badge>;
}

function sourceBadge(source: string) {
  const styles: Record<string, string> = {
    'url-pattern': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    'schema-org': 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    'meta-tags': 'bg-teal-500/10 text-teal-600 border-teal-500/30',
    'css-classes': 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    'ai': 'bg-pink-500/10 text-pink-600 border-pink-500/30',
  };
  const labels: Record<string, string> = {
    'url-pattern': 'URL Pattern',
    'schema-org': 'Schema.org',
    'meta-tags': 'Meta Tags',
    'css-classes': 'CSS Classes',
    'ai': 'AI',
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles[source] || ''}`}>
      {labels[source] || source}
    </Badge>
  );
}

export function ContentTypesCard({ data }: { data: ContentTypesData }) {
  if (!data?.summary?.length) {
    return <p className="text-sm text-muted-foreground">No content types detected.</p>;
  }

  const { summary, stats } = data;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        <span><strong className="text-foreground">{stats.total}</strong> URLs analyzed</span>
        <span>·</span>
        <span><strong className="text-foreground">{stats.uniqueTypes}</strong> content types found</span>
        {stats.ambiguousScanned > 0 && (
          <>
            <span>·</span>
            <span><strong className="text-foreground">{stats.ambiguousScanned}</strong> pages scanned for HTML signals</span>
          </>
        )}
      </div>

      {/* Detection source badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(stats.bySource)
          .filter(([, count]) => count > 0)
          .map(([source, count]) => (
            <span key={source} className="flex items-center gap-1">
              {sourceBadge(source)}
              <span className="text-[10px] text-muted-foreground">{count}</span>
            </span>
          ))}
      </div>

      {/* Summary table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Content Type</TableHead>
              <TableHead className="text-xs text-right w-[60px]">Count</TableHead>
              <TableHead className="text-xs w-[80px]">Confidence</TableHead>
              <TableHead className="text-xs">Example URLs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((row) => (
              <TableRow key={row.type}>
                <TableCell className="text-sm font-medium">{row.type}</TableCell>
                <TableCell className="text-sm text-right font-mono">{row.count}</TableCell>
                <TableCell>{confidenceBadge(row.confidence)}</TableCell>
                <TableCell>
                  <TooltipProvider>
                    <div className="flex flex-col gap-0.5 max-w-[400px]">
                      {row.urls.slice(0, 2).map((url) => (
                        <Tooltip key={url}>
                          <TooltipTrigger asChild>
                            <span className="text-[11px] font-mono text-muted-foreground truncate block cursor-default">
                              {(() => { try { return new URL(url).pathname; } catch { return url; } })()}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md">
                            <p className="text-xs font-mono break-all">{url}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {row.totalUrls > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{row.totalUrls - 2} more</span>
                      )}
                    </div>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
