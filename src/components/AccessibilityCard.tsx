import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { ChevronDown, AlertTriangle, AlertCircle, CheckCircle2, Eye, Contrast, LayoutList, Accessibility } from 'lucide-react';

type WaveData = {
  pageTitle?: string;
  waveUrl?: string;
  creditsRemaining?: number | null;
  summary: {
    errors: number;
    alerts: number;
    features: number;
    structure: number;
    aria: number;
    contrast: number;
  };
  items: {
    errors: Record<string, { id: string; description: string; count: number }>;
    alerts: Record<string, { id: string; description: string; count: number }>;
    features: Record<string, { id: string; description: string; count: number }>;
    structure: Record<string, { id: string; description: string; count: number }>;
    aria: Record<string, { id: string; description: string; count: number }>;
    contrast: Record<string, { id: string; description: string; count: number }>;
  };
};

type PsiAccessibility = {
  score: number;
  audits: { id: string; title: string; description?: string; score: number | null; displayValue?: string }[];
};

type AccessibilityCardProps = {
  waveData: WaveData | null;
  psiAccessibility: PsiAccessibility | null;
  isLoading: boolean;
};

function extractPsiAccessibility(psiData: any): PsiAccessibility | null {
  if (!psiData) return null;
  // Try mobile first, then desktop
  const strategy = psiData.mobile || psiData.desktop;
  if (!strategy) return null;

  const cats = strategy.categories || strategy;
  const score = Math.round((cats.accessibility ?? 0) * (cats.accessibility <= 1 ? 100 : 1));

  // Extract accessibility audits from the full data
  // PSI stores failed/passed audits — look for accessibility-tagged ones
  const allAudits: any[] = [];
  const failed = strategy.failed || [];
  const passed = strategy.passed || [];
  const diagnostics = strategy.diagnostics || [];

  // Accessibility audit IDs from Lighthouse
  const a11yAuditIds = new Set([
    'aria-allowed-attr', 'aria-hidden-body', 'aria-hidden-focus', 'aria-required-attr',
    'aria-roles', 'aria-valid-attr-value', 'aria-valid-attr', 'button-name',
    'bypass', 'color-contrast', 'document-title', 'duplicate-id-active', 'duplicate-id-aria',
    'form-field-multiple-labels', 'frame-title', 'heading-order', 'html-has-lang',
    'html-lang-valid', 'image-alt', 'input-image-alt', 'label', 'link-name',
    'list', 'listitem', 'meta-viewport', 'object-alt', 'tabindex', 'td-headers-attr',
    'th-has-data-cells', 'valid-lang', 'video-caption', 'definition-list', 'dlitem',
  ]);

  for (const audit of [...failed, ...diagnostics]) {
    if (a11yAuditIds.has(audit.id) || audit.title?.toLowerCase().includes('aria') || audit.title?.toLowerCase().includes('accessibility')) {
      allAudits.push({ ...audit, score: audit.score ?? 0 });
    }
  }
  for (const audit of passed) {
    if (a11yAuditIds.has(audit.id) || audit.title?.toLowerCase().includes('aria') || audit.title?.toLowerCase().includes('accessibility')) {
      allAudits.push({ ...audit, score: 1 });
    }
  }

  if (score === 0 && allAudits.length === 0) return null;

  return { score, audits: allAudits };
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

function WaveItemList({ items, variant }: { items: Record<string, any>; variant: 'error' | 'alert' | 'feature' }) {
  const entries = Object.entries(items);
  if (entries.length === 0) return <p className="text-xs text-muted-foreground">None detected</p>;

  return (
    <div className="space-y-1">
      {entries.map(([key, item]) => (
        <div key={key} className="flex items-start justify-between gap-2 text-xs border-b border-border/50 pb-1 last:border-0">
          <div className="min-w-0">
            <span className={`font-medium ${variant === 'error' ? 'text-red-600' : variant === 'alert' ? 'text-yellow-600' : 'text-green-600'}`}>
              {item.id || key}
            </span>
            {item.description && <p className="text-muted-foreground text-[11px] mt-0.5">{item.description}</p>}
          </div>
          <Badge variant={variant === 'error' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
            ×{item.count}
          </Badge>
        </div>
      ))}
    </div>
  );
}

export function AccessibilityCard({ waveData, psiAccessibility, isLoading }: AccessibilityCardProps) {
  if (isLoading) return null;
  if (!waveData && !psiAccessibility) return null;

  return (
    <div className="space-y-4">
      {/* ── Lighthouse Accessibility Score ── */}
      {psiAccessibility && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Accessibility className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Lighthouse Accessibility</span>
            <Badge
              variant={psiAccessibility.score >= 90 ? 'default' : psiAccessibility.score >= 50 ? 'secondary' : 'destructive'}
              className="ml-auto"
            >
              {psiAccessibility.score}/100
            </Badge>
          </div>

          {psiAccessibility.audits.length > 0 && (
            <>
              {/* Failed audits */}
              {(() => {
                const failedAudits = psiAccessibility.audits.filter(a => a.score !== null && a.score < 1);
                if (failedAudits.length === 0) return null;
                return (
                  <CollapsibleSection
                    title="Failed Audits"
                    icon={<AlertCircle className="h-4 w-4 text-red-500" />}
                    count={failedAudits.length}
                    defaultOpen={true}
                  >
                    <div className="space-y-1">
                      {failedAudits.map((a, i) => (
                        <div key={i} className="text-xs flex items-start gap-1.5 border-b border-border/50 pb-1 last:border-0">
                          <AlertCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                          <span>{a.title}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                );
              })()}

              {/* Passed audits */}
              {(() => {
                const passedAudits = psiAccessibility.audits.filter(a => a.score === 1);
                if (passedAudits.length === 0) return null;
                return (
                  <CollapsibleSection
                    title="Passed Audits"
                    icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
                    count={passedAudits.length}
                  >
                    <div className="space-y-0.5">
                      {passedAudits.map((a, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                          <span>{a.title}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ── Divider ── */}
      {psiAccessibility && waveData && (
        <div className="border-t border-border" />
      )}

      {/* ── WAVE Results ── */}
      {waveData && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">WAVE Accessibility Report</span>
            {waveData.waveUrl && (
              <a href={waveData.waveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-auto">
                Full Report →
              </a>
            )}
          </div>

          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={waveData.summary.errors > 0 ? 'destructive' : 'default'} className="text-xs">
              {waveData.summary.errors} Errors
            </Badge>
            <Badge variant={waveData.summary.contrast > 0 ? 'destructive' : 'default'} className="text-xs">
              {waveData.summary.contrast} Contrast
            </Badge>
            <Badge variant={waveData.summary.alerts > 0 ? 'secondary' : 'default'} className="text-xs">
              {waveData.summary.alerts} Alerts
            </Badge>
            <Badge variant="outline" className="text-xs">{waveData.summary.features} Features</Badge>
            <Badge variant="outline" className="text-xs">{waveData.summary.aria} ARIA</Badge>
            <Badge variant="outline" className="text-xs">{waveData.summary.structure} Structure</Badge>
          </div>

          {waveData.creditsRemaining != null && (
            <p className="text-[10px] text-muted-foreground">WAVE credits remaining: {waveData.creditsRemaining}</p>
          )}

          {/* Errors */}
          {waveData.summary.errors > 0 && (
            <CollapsibleSection
              title="Errors"
              icon={<AlertCircle className="h-4 w-4 text-red-500" />}
              count={waveData.summary.errors}
              defaultOpen={true}
            >
              <WaveItemList items={waveData.items.errors} variant="error" />
            </CollapsibleSection>
          )}

          {/* Contrast */}
          {waveData.summary.contrast > 0 && (
            <CollapsibleSection
              title="Contrast Issues"
              icon={<Contrast className="h-4 w-4 text-red-500" />}
              count={waveData.summary.contrast}
              defaultOpen={true}
            >
              <WaveItemList items={waveData.items.contrast} variant="error" />
            </CollapsibleSection>
          )}

          {/* Alerts */}
          {waveData.summary.alerts > 0 && (
            <CollapsibleSection
              title="Alerts"
              icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
              count={waveData.summary.alerts}
            >
              <WaveItemList items={waveData.items.alerts} variant="alert" />
            </CollapsibleSection>
          )}

          {/* ARIA */}
          {waveData.summary.aria > 0 && (
            <CollapsibleSection
              title="ARIA"
              icon={<LayoutList className="h-4 w-4 text-blue-500" />}
              count={waveData.summary.aria}
            >
              <WaveItemList items={waveData.items.aria} variant="feature" />
            </CollapsibleSection>
          )}

          {/* Features */}
          {waveData.summary.features > 0 && (
            <CollapsibleSection
              title="Accessibility Features"
              icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
              count={waveData.summary.features}
            >
              <WaveItemList items={waveData.items.features} variant="feature" />
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

export { extractPsiAccessibility };
export type { WaveData, PsiAccessibility };
