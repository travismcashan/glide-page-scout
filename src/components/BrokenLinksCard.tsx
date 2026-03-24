import { Badge } from '@/components/ui/badge';
import { CardTabs } from '@/components/CardTabs';
import { CheckCircle, ArrowRight, XCircle, Clock, ExternalLink } from 'lucide-react';

type LinkResult = {
  url: string;
  statusCode: number;
  redirectUrl: string | null;
  responseTimeMs: number;
  error: string | null;
};

type LinkCheckData = {
  summary: {
    total: number;
    ok: number;
    redirects: number;
    clientErrors: number;
    serverErrors: number;
    failures: number;
  };
  results: LinkResult[];
};

function statusBadgeClass(code: number): string {
  if (code >= 200 && code < 300) return 'bg-green-500/10 text-green-600 border-green-500/30';
  if (code >= 300 && code < 400) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
  if (code >= 400) return 'bg-destructive/10 text-destructive border-destructive/30';
  return 'bg-muted text-muted-foreground border-border';
}

function LinkRow({ result }: { result: LinkResult }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 border-b border-border last:border-0">
      <Badge variant="outline" className={`text-[11px] px-1.5 py-0 font-mono shrink-0 ${statusBadgeClass(result.statusCode)}`}>
        {result.statusCode || 'ERR'}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-mono truncate text-foreground">{result.url}</p>
        {result.redirectUrl && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="truncate">{result.redirectUrl}</span>
          </div>
        )}
        {result.error && (
          <p className="text-xs text-destructive mt-0.5">{result.error}</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <Clock className="h-3 w-3" />
        <span>{result.responseTimeMs}ms</span>
      </div>
      <a href={result.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function LinkList({ results, emptyMessage }: { results: LinkResult[]; emptyMessage?: string }) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">{emptyMessage || 'None found.'}</p>
    );
  }
  return (
    <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card">
      {results.map((r, i) => <LinkRow key={i} result={r} />)}
    </div>
  );
}

export function BrokenLinksCard({ data }: { data: LinkCheckData }) {
  const { summary, results } = data;

  const okUrls = results.filter(r => r.statusCode >= 200 && r.statusCode < 300);
  const redirectUrls = results.filter(r => r.statusCode >= 300 && r.statusCode < 400);
  const brokenUrls = results.filter(r => r.statusCode >= 400 || r.statusCode === 0);
  const brokenCount = summary.clientErrors + summary.serverErrors + summary.failures;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
        {summary.ok > 0 && (
          <div className="h-full bg-green-500" style={{ width: `${(summary.ok / summary.total) * 100}%` }} />
        )}
        {summary.redirects > 0 && (
          <div className="h-full bg-yellow-500" style={{ width: `${(summary.redirects / summary.total) * 100}%` }} />
        )}
        {brokenCount > 0 && (
          <div className="h-full bg-destructive" style={{ width: `${(brokenCount / summary.total) * 100}%` }} />
        )}
      </div>

      <CardTabs
        defaultValue="broken"
        tabs={[
          {
            value: 'broken',
            label: `Broken (${brokenUrls.length})`,
            icon: <XCircle className="h-3.5 w-3.5" />,
            content: <LinkList results={brokenUrls} emptyMessage="No broken links found!" />,
          },
          {
            value: 'redirects',
            label: `Redirects (${redirectUrls.length})`,
            icon: <ArrowRight className="h-3.5 w-3.5" />,
            content: <LinkList results={redirectUrls} emptyMessage="No redirects found." />,
          },
          {
            value: 'ok',
            label: `OK (${okUrls.length})`,
            icon: <CheckCircle className="h-3.5 w-3.5" />,
            content: <LinkList results={okUrls} />,
          },
        ]}
      />
    </div>
  );
}
