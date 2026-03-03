import { Badge } from '@/components/ui/badge';
import { Loader2, Gauge, ChevronDown, AlertTriangle, CheckCircle2, Zap, HardDrive } from 'lucide-react';
import { useState } from 'react';

type PsiScores = {
  categories: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  vitals: {
    fcp: number | null;
    lcp: number | null;
    tbt: number | null;
    cls: number | null;
    si: number | null;
    tti: number | null;
  };
  opportunities?: any[];
  diagnostics?: any[];
  passed?: any[];
  failed?: any[];
  resourceSummary?: any[];
  mainThreadWork?: any[];
  totalAudits?: number;
};

// Legacy format support
type LegacyScores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: number | null;
  lcp: number | null;
  tbt: number | null;
  cls: number | null;
  si: number | null;
  tti: number | null;
};

type PsiCardProps = {
  data: { mobile?: PsiScores | LegacyScores; desktop?: PsiScores | LegacyScores } | null;
  isLoading: boolean;
};

function isNewFormat(d: any): d is PsiScores {
  return d && typeof d.categories === 'object';
}

function getCategories(d: PsiScores | LegacyScores) {
  if (isNewFormat(d)) return d.categories;
  return { performance: d.performance, accessibility: d.accessibility, bestPractices: d.bestPractices, seo: d.seo };
}

function getVitals(d: PsiScores | LegacyScores) {
  if (isNewFormat(d)) return d.vitals;
  return { fcp: d.fcp, lcp: d.lcp, tbt: d.tbt, cls: d.cls, si: d.si, tti: d.tti };
}

function formatMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 90) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  if (score >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
}

function scoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 90) return 'default';
  if (score >= 50) return 'secondary';
  return 'destructive';
}

function ScoreRow({ label, mobile, desktop }: { label: string; mobile: number; desktop: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <Badge variant={scoreBadgeVariant(mobile)} className="min-w-[3rem] justify-center">{mobile}</Badge>
        <Badge variant={scoreBadgeVariant(desktop)} className="min-w-[3rem] justify-center">{desktop}</Badge>
      </div>
    </div>
  );
}

function ScoreCircle({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${scoreBg(score)}`}>
        {score}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function CollapsibleSection({ title, icon, count, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
          {count !== undefined && <Badge variant="secondary" className="text-[10px] px-1.5">{count}</Badge>}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

export function PageSpeedCard({ data, isLoading }: PsiCardProps) {
  const [activeStrategy, setActiveStrategy] = useState<'mobile' | 'desktop'>('mobile');

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">PageSpeed Insights</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground min-h-[2.5rem]">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span className="text-sm">Running PageSpeed Insights (mobile + desktop)...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.mobile || !data.desktop) return null;

  const mCats = getCategories(data.mobile);
  const dCats = getCategories(data.desktop);
  const mVitals = getVitals(data.mobile);
  const dVitals = getVitals(data.desktop);

  const active = activeStrategy === 'mobile' ? data.mobile : data.desktop;
  const activeCats = activeStrategy === 'mobile' ? mCats : dCats;
  const activeVitals = activeStrategy === 'mobile' ? mVitals : dVitals;

  const opportunities = isNewFormat(active) ? (active.opportunities || []) : [];
  const diagnostics = isNewFormat(active) ? (active.diagnostics || []) : [];
  const passed = isNewFormat(active) ? (active.passed || []) : [];
  const resourceSummary = isNewFormat(active) ? (active.resourceSummary || []) : [];
  const mainThreadWork = isNewFormat(active) ? (active.mainThreadWork || []) : [];
  const totalAudits = isNewFormat(active) ? (active.totalAudits || 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">PageSpeed Insights</span>
          {totalAudits > 0 && <span className="text-xs text-muted-foreground">({totalAudits} audits)</span>}
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setActiveStrategy('mobile')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeStrategy === 'mobile' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Mobile
          </button>
          <button
            onClick={() => setActiveStrategy('desktop')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeStrategy === 'desktop' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Desktop
          </button>
        </div>
      </div>

      {/* Category score circles */}
      <div className="flex justify-around py-2">
        <ScoreCircle score={activeCats.performance} label="Performance" />
        <ScoreCircle score={activeCats.accessibility} label="Accessibility" />
        <ScoreCircle score={activeCats.bestPractices} label="Best Practices" />
        <ScoreCircle score={activeCats.seo} label="SEO" />
      </div>

      {/* Core Web Vitals */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'FCP', value: formatMs(activeVitals.fcp), good: activeVitals.fcp != null && activeVitals.fcp <= 1800 },
          { label: 'LCP', value: formatMs(activeVitals.lcp), good: activeVitals.lcp != null && activeVitals.lcp <= 2500 },
          { label: 'TBT', value: formatMs(activeVitals.tbt), good: activeVitals.tbt != null && activeVitals.tbt <= 200 },
          { label: 'CLS', value: activeVitals.cls?.toFixed(3) ?? '—', good: activeVitals.cls != null && activeVitals.cls <= 0.1 },
          { label: 'SI', value: formatMs(activeVitals.si), good: activeVitals.si != null && activeVitals.si <= 3400 },
          { label: 'TTI', value: formatMs(activeVitals.tti), good: activeVitals.tti != null && activeVitals.tti <= 3800 },
        ].map(({ label, value, good }) => (
          <div key={label} className="bg-muted rounded-lg p-2 text-center">
            <div className={`text-sm font-bold ${good ? 'text-green-600' : 'text-red-600'}`}>{value}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Opportunities */}
      {opportunities.length > 0 && (
        <CollapsibleSection
          title="Opportunities"
          icon={<Zap className="h-4 w-4 text-yellow-500" />}
          count={opportunities.length}
          defaultOpen={true}
        >
          <div className="space-y-1.5">
            {opportunities.map((opp: any, i: number) => (
              <div key={i} className="text-sm border-b border-border pb-1.5 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-xs">{opp.title}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {opp.overallSavingsMs > 0 && (
                      <Badge variant="secondary" className="text-[10px]">{formatMs(opp.overallSavingsMs)}</Badge>
                    )}
                    {opp.overallSavingsBytes > 0 && (
                      <Badge variant="outline" className="text-[10px]">{formatBytes(opp.overallSavingsBytes)}</Badge>
                    )}
                  </div>
                </div>
                {opp.displayValue && <p className="text-[11px] text-muted-foreground">{opp.displayValue}</p>}
                {opp.items && opp.items.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {opp.items.slice(0, 5).map((item: any, j: number) => (
                      <div key={j} className="text-[10px] text-muted-foreground flex items-center gap-2 font-mono truncate">
                        <span className="truncate max-w-[250px]">{item.url?.split('/').pop() || item.url}</span>
                        {item.wastedBytes != null && <span className="shrink-0">-{formatBytes(item.wastedBytes)}</span>}
                        {item.wastedMs != null && <span className="shrink-0">-{formatMs(item.wastedMs)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Diagnostics */}
      {diagnostics.length > 0 && (
        <CollapsibleSection
          title="Diagnostics"
          icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
          count={diagnostics.length}
        >
          <div className="space-y-1.5">
            {diagnostics.map((diag: any, i: number) => (
              <div key={i} className="text-xs border-b border-border pb-1.5 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{diag.title}</span>
                  {diag.displayValue && <span className="text-muted-foreground shrink-0">{diag.displayValue}</span>}
                </div>
                {diag.items && diag.items.length > 0 && diag.headings && (
                  <div className="mt-1 overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr>
                          {diag.headings.slice(0, 4).map((h: any, j: number) => (
                            <th key={j} className="text-left px-1.5 py-0.5 text-muted-foreground font-medium">{h.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {diag.items.slice(0, 5).map((item: any, j: number) => (
                          <tr key={j} className="border-t border-border/50">
                            {diag.headings.slice(0, 4).map((h: any, k: number) => {
                              const val = item[h.key];
                              let display = val;
                              if (typeof val === 'number') {
                                if (h.valueType === 'bytes') display = formatBytes(val);
                                else if (h.valueType === 'timespanMs' || h.valueType === 'ms') display = formatMs(val);
                                else display = val.toLocaleString();
                              }
                              if (typeof val === 'object' && val !== null) display = val.text || val.url || JSON.stringify(val);
                              return <td key={k} className="px-1.5 py-0.5 truncate max-w-[150px]">{String(display ?? '—')}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Resource Summary */}
      {resourceSummary.length > 0 && (
        <CollapsibleSection
          title="Resource Summary"
          icon={<HardDrive className="h-4 w-4 text-blue-500" />}
          count={resourceSummary.length}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-2 py-1 text-muted-foreground font-medium">Type</th>
                  <th className="text-right px-2 py-1 text-muted-foreground font-medium">Count</th>
                  <th className="text-right px-2 py-1 text-muted-foreground font-medium">Size</th>
                </tr>
              </thead>
              <tbody>
                {resourceSummary.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="px-2 py-1">{typeof r.label === 'object' ? r.label?.text || r.resourceType : r.label || r.resourceType}</td>
                    <td className="px-2 py-1 text-right">{r.requestCount}</td>
                    <td className="px-2 py-1 text-right">{formatBytes(r.transferSize || r.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Main Thread Work */}
      {mainThreadWork.length > 0 && (
        <CollapsibleSection
          title="Main Thread Work"
          icon={<Zap className="h-4 w-4 text-purple-500" />}
          count={mainThreadWork.length}
        >
          <div className="space-y-1">
            {mainThreadWork.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{item.groupLabel || item.group}</span>
                <span className="font-medium">{formatMs(item.duration)}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Passed Audits */}
      {passed.length > 0 && (
        <CollapsibleSection
          title="Passed Audits"
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          count={passed.length}
        >
          <div className="space-y-0.5">
            {passed.map((a: any, i: number) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                <span>{a.title}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
