import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Clock, ChevronDown, ChevronUp, Shield, ArrowRight } from 'lucide-react';
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

type CanonicalVariant = {
  url: string;
  finalUrl: string;
  finalStatusCode: number;
  redirectCount: number;
  error: string | null;
};

type Hop = {
  step: number;
  url: string;
  statusCode: number;
  statusMessage: string;
  redirectTo: string | null;
  redirectType: string | null;
  latency: number | null;
  timings: TimingPhases | null;
  responseHeaders: Record<string, string> | null;
};

type HttpStatusData = {
  requestUrl: string;
  finalUrl: string;
  finalStatusCode: number;
  redirectCount: number;
  hops: Hop[];
  timings?: TimingPhases | null;
  responseHeaders?: Record<string, string> | null;
  canonical?: {
    variants: CanonicalVariant[];
    allResolveToSame: boolean;
    canonicalUrl: string | null;
  };
  // legacy
  meta?: any;
  apiMeta?: any;
};

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-green-600';
  if (code >= 300 && code < 400) return 'text-yellow-600';
  if (code >= 400) return 'text-destructive';
  return 'text-muted-foreground';
}

function statusBadgeClass(code: number): string {
  if (code >= 200 && code < 300) return 'bg-green-500/10 text-green-600 border-green-500/30';
  if (code >= 300 && code < 400) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
  if (code >= 400) return 'bg-destructive/10 text-destructive border-destructive/30';
  return 'bg-muted text-muted-foreground border-border';
}

function formatMs(ms: number | undefined | null): string {
  if (ms == null) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

/* ─── Canonical Table ─── */
function CanonicalSection({ canonical }: { canonical: HttpStatusData['canonical'] }) {
  if (!canonical?.variants?.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Domain Canonicalization</h3>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Variant</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Resolves To</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Result</th>
            </tr>
          </thead>
          <tbody>
            {canonical.variants.map((v, i) => {
              const isCanonical = v.finalUrl.replace(/\/$/, '') === canonical.canonicalUrl?.replace(/\/$/, '');
              const resolvesCorrectly = canonical.allResolveToSame && !v.error;
              return (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{v.url}</td>
                  <td className="px-3 py-2 text-center">
                    {v.error ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/30">Error</Badge>
                    ) : v.redirectCount > 0 ? (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadgeClass(v.finalStatusCode)}`}>
                        {v.finalStatusCode} · {v.redirectCount} redirect{v.redirectCount > 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadgeClass(v.finalStatusCode)}`}>
                        {v.finalStatusCode}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-foreground truncate max-w-[260px]">
                    {v.error ? <span className="text-destructive">{v.error}</span> : v.finalUrl}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {v.error ? (
                      <AlertTriangle className="h-4 w-4 text-destructive mx-auto" />
                    ) : resolvesCorrectly ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mx-auto" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-xs">
        {canonical.allResolveToSame ? (
          <>
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            <span className="text-green-600 font-medium">All variants resolve to</span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{canonical.canonicalUrl}</code>
          </>
        ) : (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
            <span className="text-yellow-600 font-medium">Variants resolve to different URLs — canonicalization issue</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Timing Waterfall ─── */
function TimingWaterfall({ timings }: { timings: TimingPhases }) {
  const phases = [
    { key: 'dns', label: 'DNS', color: 'bg-blue-500' },
    { key: 'tcp', label: 'TCP', color: 'bg-green-500' },
    { key: 'tls', label: 'TLS', color: 'bg-purple-500' },
    { key: 'firstByte', label: 'TTFB', color: 'bg-yellow-500' },
    { key: 'download', label: 'Download', color: 'bg-cyan-500' },
  ] as const;

  const total = timings.total || 1;
  const validPhases = phases.filter(p => (timings[p.key] ?? 0) > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Response Time</h3>
        <span className="text-xs text-muted-foreground ml-auto">{formatMs(timings.total)} total</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {validPhases.map(p => {
          const val = timings[p.key] ?? 0;
          const pct = Math.max((val / total) * 100, 3);
          return (
            <div
              key={p.key}
              className={`${p.color} h-full transition-all`}
              style={{ width: `${pct}%` }}
              title={`${p.label}: ${formatMs(val)}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {validPhases.map(p => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${p.color}`} />
            <span className="font-medium">{p.label}</span>
            <span>{formatMs(timings[p.key])}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Response Headers (collapsible) ─── */
function HeadersCollapsible({ headers }: { headers: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(headers);
  if (entries.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Response Headers ({entries.length})
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-muted/20 overflow-hidden">
          <table className="w-full text-[11px]">
            <tbody>
              {entries.map(([k, v]) => (
                <tr key={k} className="border-b border-border/30 last:border-0">
                  <td className="px-2.5 py-1.5 font-mono font-semibold text-muted-foreground whitespace-nowrap align-top">{k}</td>
                  <td className="px-2.5 py-1.5 font-mono text-foreground break-all">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Redirect Chain (compact) ─── */
function RedirectChain({ hops }: { hops: Hop[] }) {
  if (hops.length <= 1) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Redirect Chain</h3>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {hops.map((hop, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadgeClass(hop.statusCode)}`}>
              {hop.statusCode}
            </Badge>
            <span className="font-mono text-muted-foreground truncate max-w-[200px]">{hop.url}</span>
            {i < hops.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Card ─── */
export function HttpStatusCard({ data }: { data: HttpStatusData }) {
  const { hops, redirectCount, canonical } = data;

  // Get timings from new shape or legacy hops
  const timings: TimingPhases | null = data.timings || (hops.length > 0 ? hops[hops.length - 1]?.timings : null) || null;

  // Get response headers from new shape or legacy hops
  const responseHeaders = data.responseHeaders || (hops.length > 0 ? hops[hops.length - 1]?.responseHeaders : null) || null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className={`text-sm px-2.5 py-0.5 font-bold ${statusBadgeClass(data.finalStatusCode)}`}>
          {data.finalStatusCode} {data.finalStatusCode === 200 ? 'OK' : ''}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {redirectCount === 0 ? 'No redirects' : `${redirectCount} redirect${redirectCount > 1 ? 's' : ''}`}
        </span>
        {timings?.total != null && (
          <span className="text-sm text-muted-foreground">· {formatMs(timings.total)}</span>
        )}
        {redirectCount === 0 && data.finalStatusCode === 200 && (
          <Badge variant="outline" className="text-[11px] px-1.5 py-0 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-0.5" /> Clean
          </Badge>
        )}
        {redirectCount > 3 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            <AlertTriangle className="h-3 w-3 mr-0.5" /> Long chain
          </Badge>
        )}
      </div>

      {/* Canonical Section */}
      <CanonicalSection canonical={canonical} />

      {/* Redirect Chain (only if >1 hop) */}
      <RedirectChain hops={hops} />

      {/* Timing Waterfall */}
      {timings && <TimingWaterfall timings={timings} />}

      {/* Response Headers */}
      {responseHeaders && <HeadersCollapsible headers={responseHeaders} />}
    </div>
  );
}
