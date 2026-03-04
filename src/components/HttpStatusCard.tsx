import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle, AlertTriangle, ExternalLink, Clock, Globe } from 'lucide-react';

type Hop = {
  step: number;
  url: string;
  statusCode: number;
  statusText: string;
  redirectUrl: string | null;
  ip: string | null;
  timing: any | null;
  tls: any | null;
};

type HttpStatusData = {
  requestUrl: string;
  finalUrl: string;
  finalStatusCode: number;
  redirectCount: number;
  hops: Hop[];
  metadata: any | null;
  parsedUrl: any | null;
};

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'bg-green-500/10 text-green-600 border-green-500/30';
  if (code >= 300 && code < 400) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
  if (code >= 400 && code < 500) return 'bg-destructive/10 text-destructive border-destructive/30';
  if (code >= 500) return 'bg-destructive/10 text-destructive border-destructive/30';
  return 'bg-muted text-muted-foreground border-border';
}

function formatMs(ms: number | undefined | null): string {
  if (ms == null) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export function HttpStatusCard({ data }: { data: HttpStatusData }) {
  const { hops, redirectCount, metadata, parsedUrl } = data;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className={`text-xs px-2 py-0.5 ${statusColor(data.finalStatusCode)}`}>
          {data.finalStatusCode}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {redirectCount === 0 ? 'No redirects' : `${redirectCount} redirect${redirectCount > 1 ? 's' : ''}`}
        </span>
        {redirectCount > 3 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            <AlertTriangle className="h-3 w-3 mr-0.5" /> Long chain
          </Badge>
        )}
        {redirectCount === 0 && data.finalStatusCode === 200 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-0.5" /> Clean
          </Badge>
        )}
      </div>

      {/* Redirect Chain */}
      <div className="space-y-0">
        {hops.map((hop, i) => {
          const totalMs = hop.timing?.total || hop.timing?.totalMs || null;
          const isLast = i === hops.length - 1;
          return (
            <div key={i}>
              <div className="flex items-start gap-3 py-2.5">
                {/* Step indicator */}
                <div className="flex flex-col items-center pt-0.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border ${statusColor(hop.statusCode)}`}>
                    {hop.statusCode}
                  </div>
                  {!isLast && <div className="w-px h-full min-h-[16px] bg-border mt-1" />}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-mono truncate text-foreground">{hop.url}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {hop.statusText && <span>{hop.statusText}</span>}
                    {hop.ip && (
                      <span className="flex items-center gap-0.5">
                        <Globe className="h-3 w-3" /> {hop.ip}
                      </span>
                    )}
                    {totalMs != null && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" /> {formatMs(totalMs)}
                      </span>
                    )}
                    {hop.tls?.valid === true && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-500/30">TLS ✓</Badge>
                    )}
                    {hop.tls?.valid === false && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">TLS ✗</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Arrow between hops */}
              {!isLast && (
                <div className="flex items-center gap-2 pl-[22px] py-0.5">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {hop.statusCode === 301 ? 'Permanent redirect' : hop.statusCode === 302 ? 'Temporary redirect' : hop.statusCode === 307 ? 'Temporary (307)' : hop.statusCode === 308 ? 'Permanent (308)' : 'Redirect'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Metadata */}
      {metadata && (
        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Page Metadata</p>
          <div className="grid grid-cols-1 gap-2">
            {metadata.title && (
              <div>
                <p className="text-[10px] text-muted-foreground">Title</p>
                <p className="text-sm text-foreground">{metadata.title}</p>
              </div>
            )}
            {metadata.description && (
              <div>
                <p className="text-[10px] text-muted-foreground">Meta Description</p>
                <p className="text-sm text-foreground">{metadata.description}</p>
              </div>
            )}
            {metadata.canonical && (
              <div>
                <p className="text-[10px] text-muted-foreground">Canonical</p>
                <p className="text-sm font-mono text-foreground truncate">{metadata.canonical}</p>
              </div>
            )}
            {metadata.robots && (
              <div>
                <p className="text-[10px] text-muted-foreground">Meta Robots</p>
                <p className="text-sm font-mono text-foreground">{metadata.robots}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Parsed URL */}
      {parsedUrl && (
        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parsed URL</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {parsedUrl.hostname && (
              <Badge variant="outline" className="text-xs">{parsedUrl.hostname}</Badge>
            )}
            {parsedUrl.subdomain && (
              <Badge variant="secondary" className="text-[10px]">Subdomain: {parsedUrl.subdomain}</Badge>
            )}
            {parsedUrl.publicSuffix && (
              <Badge variant="secondary" className="text-[10px]">TLD: {parsedUrl.publicSuffix}</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
