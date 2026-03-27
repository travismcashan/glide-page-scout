import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle, AlertTriangle, Clock, Globe, ChevronDown, ChevronUp, Server, FileText } from 'lucide-react';
import { useState } from 'react';

type TimingPhases = {
  wait?: number;
  dns?: number;
  tcp?: number;
  tls?: number;
  request?: number;
  firstByte?: number;
  download?: number;
  total?: number;
};

type Hop = {
  step: number;
  url: string;
  statusCode: number;
  statusMessage: string;
  redirectFrom: string | null;
  redirectTo: string | null;
  redirectType: string | null;
  ip: string | null;
  latency: number | null;
  timings: TimingPhases | null;
  responseHeaders: Record<string, string> | null;
  requestHeaders: Record<string, string> | null;
  parsedUrl: Record<string, any> | null;
  parsedHostname: Record<string, any> | null;
};

type HttpStatusData = {
  requestUrl: string;
  finalUrl: string;
  finalStatusCode: number;
  redirectCount: number;
  hops: Hop[];
  meta: any | null;
  apiMeta: any | null;
  // legacy fields
  metadata?: any | null;
  parsedUrl?: any | null;
};

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'bg-green-500/10 text-green-600 border-green-500/30';
  if (code >= 300 && code < 400) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
  if (code >= 400) return 'bg-destructive/10 text-destructive border-destructive/30';
  return 'bg-muted text-muted-foreground border-border';
}

function formatMs(ms: number | undefined | null): string {
  if (ms == null) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function HeadersTable({ headers, label }: { headers: Record<string, string>; label: string }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(headers);
  if (entries.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {label} ({entries.length})
      </button>
      {open && (
        <div className="mt-1 rounded-md border border-border bg-muted/30 overflow-hidden">
          <table className="w-full text-[11px]">
            <tbody>
              {entries.map(([k, v]) => (
                <tr key={k} className="border-b border-border/50 last:border-0">
                  <td className="px-2 py-1 font-mono font-semibold text-muted-foreground whitespace-nowrap align-top">{k}</td>
                  <td className="px-2 py-1 font-mono text-foreground break-all">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TimingBar({ timings }: { timings: TimingPhases }) {
  const phases = [
    { key: 'dns', label: 'DNS', color: 'bg-blue-500' },
    { key: 'tcp', label: 'TCP', color: 'bg-green-500' },
    { key: 'tls', label: 'TLS', color: 'bg-purple-500' },
    { key: 'request', label: 'Req', color: 'bg-orange-500' },
    { key: 'firstByte', label: 'TTFB', color: 'bg-yellow-500' },
    { key: 'download', label: 'DL', color: 'bg-cyan-500' },
  ] as const;

  const total = timings.total || 1;
  const validPhases = phases.filter(p => (timings[p.key] ?? 0) > 0);

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" /> Total: {formatMs(timings.total)}
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        {validPhases.map(p => {
          const val = timings[p.key] ?? 0;
          const pct = Math.max((val / total) * 100, 2);
          return (
            <div
              key={p.key}
              className={`${p.color} h-full`}
              style={{ width: `${pct}%` }}
              title={`${p.label}: ${formatMs(val)}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        {validPhases.map(p => (
          <span key={p.key} className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-full ${p.color}`} />
            {p.label} {formatMs(timings[p.key])}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HttpStatusCard({ data }: { data: HttpStatusData }) {
  const { hops, redirectCount, apiMeta } = data;

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
        {apiMeta?.responseTime != null && (
          <span className="text-[10px] text-muted-foreground">API: {apiMeta.responseTime}ms</span>
        )}
      </div>

      {/* Redirect Chain */}
      <div className="space-y-0">
        {hops.map((hop, i) => {
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
                    {hop.statusMessage && <span>{hop.statusMessage}</span>}
                    {hop.ip && (
                      <span className="flex items-center gap-0.5">
                        <Globe className="h-3 w-3" /> {hop.ip}
                      </span>
                    )}
                    {hop.latency != null && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" /> {formatMs(hop.latency)}
                      </span>
                    )}
                    {hop.redirectType && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">{hop.redirectType}</Badge>
                    )}
                    {hop.parsedHostname?.isIp && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">IP address</Badge>
                    )}
                  </div>

                  {/* Parsed hostname badges */}
                  {hop.parsedHostname && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {hop.parsedHostname.domain && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{hop.parsedHostname.domain}</Badge>
                      )}
                      {hop.parsedHostname.subdomain && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">sub: {hop.parsedHostname.subdomain}</Badge>
                      )}
                      {hop.parsedHostname.publicSuffix && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">TLD: {hop.parsedHostname.publicSuffix}</Badge>
                      )}
                      {hop.parsedHostname.isIcann && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-500/30">ICANN</Badge>
                      )}
                    </div>
                  )}

                  {/* Timing waterfall */}
                  {hop.timings && <TimingBar timings={hop.timings} />}

                  {/* Response headers */}
                  {hop.responseHeaders && (
                    <HeadersTable headers={hop.responseHeaders} label="Response Headers" />
                  )}

                  {/* Request headers */}
                  {hop.requestHeaders && (
                    <HeadersTable headers={hop.requestHeaders} label="Request Headers" />
                  )}
                </div>
              </div>

              {/* Arrow between hops */}
              {!isLast && (
                <div className="flex items-center gap-2 pl-[22px] py-0.5">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {hop.statusCode === 301 ? 'Permanent redirect' : hop.statusCode === 302 ? 'Temporary redirect' : hop.statusCode === 307 ? 'Temporary (307)' : hop.statusCode === 308 ? 'Permanent (308)' : 'Redirect'}
                    {hop.redirectType ? ` · ${hop.redirectType}` : ''}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>



            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Page Metadata</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {pageMeta.title && (
              <div>
                <p className="text-[10px] text-muted-foreground">Title</p>
                <p className="text-sm text-foreground">{pageMeta.title}</p>
              </div>
            )}
            {pageMeta.description && (
              <div>
                <p className="text-[10px] text-muted-foreground">Meta Description</p>
                <p className="text-sm text-foreground">{pageMeta.description}</p>
              </div>
            )}
            {pageMeta.canonical && (
              <div>
                <p className="text-[10px] text-muted-foreground">Canonical</p>
                <p className="text-sm font-mono text-foreground truncate">{pageMeta.canonical}</p>
              </div>
            )}
            {pageMeta.robots && (
              <div>
                <p className="text-[10px] text-muted-foreground">Meta Robots</p>
                <p className="text-sm font-mono text-foreground">{pageMeta.robots}</p>
              </div>
            )}
            {pageMeta.keywords && (
              <div>
                <p className="text-[10px] text-muted-foreground">Keywords</p>
                <p className="text-sm text-foreground">{pageMeta.keywords}</p>
              </div>
            )}
            {pageMeta.language && (
              <div>
                <p className="text-[10px] text-muted-foreground">Language</p>
                <p className="text-sm text-foreground">{pageMeta.language}</p>
              </div>
            )}
            {pageMeta.author && (
              <div>
                <p className="text-[10px] text-muted-foreground">Author</p>
                <p className="text-sm text-foreground">{pageMeta.author}</p>
              </div>
            )}
            {pageMeta.published && (
              <div>
                <p className="text-[10px] text-muted-foreground">Published</p>
                <p className="text-sm text-foreground">{pageMeta.published}</p>
              </div>
            )}
            {pageMeta.modified && (
              <div>
                <p className="text-[10px] text-muted-foreground">Modified</p>
                <p className="text-sm text-foreground">{pageMeta.modified}</p>
              </div>
            )}
            {pageMeta.image && (
              <div>
                <p className="text-[10px] text-muted-foreground">OG Image</p>
                <p className="text-sm font-mono text-foreground truncate">{pageMeta.image}</p>
              </div>
            )}
            {pageMeta.type && (
              <div>
                <p className="text-[10px] text-muted-foreground">Type</p>
                <p className="text-sm text-foreground">{pageMeta.type}</p>
              </div>
            )}
            {pageMeta.hreflang && Array.isArray(pageMeta.hreflang) && pageMeta.hreflang.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground">Hreflang Tags</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {pageMeta.hreflang.map((tag: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0">
                      {tag.lang || tag.hreflang}: {tag.href || tag.url}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Final hop parsed URL */}
      {(() => {
        const lastHop = hops.length > 0 ? hops[hops.length - 1] : null;
        const pu = lastHop?.parsedUrl || data.parsedUrl;
        if (!pu) return null;
        return (
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Final URL Breakdown</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {pu.protocol && <Badge variant="outline" className="text-[10px]">{pu.protocol}</Badge>}
              {pu.hostname && <Badge variant="outline" className="text-xs">{pu.hostname}</Badge>}
              {pu.port && <Badge variant="secondary" className="text-[10px]">Port: {pu.port}</Badge>}
              {pu.pathname && pu.pathname !== '/' && <Badge variant="secondary" className="text-[10px]">Path: {pu.pathname}</Badge>}
              {pu.origin && <Badge variant="secondary" className="text-[10px]">Origin: {pu.origin}</Badge>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
