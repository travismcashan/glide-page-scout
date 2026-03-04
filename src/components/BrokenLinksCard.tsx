import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, AlertTriangle, ArrowRight, XCircle, Clock, ExternalLink } from 'lucide-react';

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

export function BrokenLinksCard({ data }: { data: LinkCheckData }) {
  const { summary, results } = data;

  const okUrls = results.filter(r => r.statusCode >= 200 && r.statusCode < 300);
  const redirectUrls = results.filter(r => r.statusCode >= 300 && r.statusCode < 400);
  const brokenUrls = results.filter(r => r.statusCode >= 400 || r.statusCode === 0);

  const defaultTab = brokenUrls.length > 0 ? 'broken' : redirectUrls.length > 0 ? 'redirects' : 'ok';

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-foreground">{summary.ok}</span>
          <span className="text-xs text-muted-foreground">OK</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowRight className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-foreground">{summary.redirects}</span>
          <span className="text-xs text-muted-foreground">Redirects</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium text-foreground">{summary.clientErrors + summary.serverErrors + summary.failures}</span>
          <span className="text-xs text-muted-foreground">Broken</span>
        </div>
        <div className="ml-auto">
          <Badge variant="secondary" className="text-xs">{summary.total} checked</Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
        {summary.ok > 0 && (
          <div className="h-full bg-green-500" style={{ width: `${(summary.ok / summary.total) * 100}%` }} />
        )}
        {summary.redirects > 0 && (
          <div className="h-full bg-yellow-500" style={{ width: `${(summary.redirects / summary.total) * 100}%` }} />
        )}
        {(summary.clientErrors + summary.serverErrors + summary.failures) > 0 && (
          <div className="h-full bg-destructive" style={{ width: `${((summary.clientErrors + summary.serverErrors + summary.failures) / summary.total) * 100}%` }} />
        )}
      </div>

      {/* Tabbed URL lists */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="broken" className="gap-1">
            <XCircle className="h-3 w-3" /> Broken ({brokenUrls.length})
          </TabsTrigger>
          <TabsTrigger value="redirects" className="gap-1">
            <ArrowRight className="h-3 w-3" /> Redirects ({redirectUrls.length})
          </TabsTrigger>
          <TabsTrigger value="ok" className="gap-1">
            <CheckCircle className="h-3 w-3" /> OK ({okUrls.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broken" className="mt-3">
          {brokenUrls.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              No broken links found!
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card">
              {brokenUrls.map((r, i) => <LinkRow key={i} result={r} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="redirects" className="mt-3">
          {redirectUrls.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No redirects found.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card">
              {redirectUrls.map((r, i) => <LinkRow key={i} result={r} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ok" className="mt-3">
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card">
            {okUrls.map((r, i) => <LinkRow key={i} result={r} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
