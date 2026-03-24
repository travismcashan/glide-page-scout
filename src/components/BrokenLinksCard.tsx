import { CardTabs } from '@/components/CardTabs';
import { CheckCircle, ArrowRight, XCircle } from 'lucide-react';

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

function LinkList({ results, emptyMessage, showRedirect }: { results: LinkResult[]; emptyMessage?: string; showRedirect?: boolean }) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center italic">{emptyMessage || 'None found.'}</p>
    );
  }
  return (
    <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm table-fixed">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
          <tr className="text-left">
            <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground">URL</th>
            {showRedirect && (
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground">Redirects To</th>
            )}
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} className="border-t border-border/50 hover:bg-muted/20 transition-colors group">
              <td className="px-3 py-1">
                <div className="flex items-center gap-1 min-w-0">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono leading-5 truncate text-muted-foreground hover:text-primary hover:underline">
                    {r.url}
                  </a>
                  {r.error && (
                    <span className="text-[10px] text-destructive shrink-0">({r.error})</span>
                  )}
                </div>
              </td>
              {showRedirect && (
                <td className="px-3 py-1">
                  {r.redirectUrl ? (
                    <a href={r.redirectUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-mono leading-5 truncate block text-muted-foreground hover:text-primary hover:underline">
                      {r.redirectUrl}
                    </a>
                  ) : null}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
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
            icon: <XCircle className="h-3.5 w-3.5 text-destructive" />,
            content: <LinkList results={brokenUrls} emptyMessage="No broken links found!" />,
          },
          {
            value: 'redirects',
            label: `Redirects (${redirectUrls.length})`,
            icon: <ArrowRight className="h-3.5 w-3.5 text-yellow-500" />,
            content: <LinkList results={redirectUrls} emptyMessage="No redirects found." showRedirect />,
          },
          {
            value: 'ok',
            label: `OK (${okUrls.length})`,
            icon: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
            content: <LinkList results={okUrls} />,
          },
        ]}
      />
    </div>
  );
}
