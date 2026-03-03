import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { ChevronDown, AlertCircle, CheckCircle2, Accessibility } from 'lucide-react';

type PsiAccessibility = {
  score: number;
  audits: { id: string; title: string; description?: string; score: number | null; displayValue?: string }[];
};

function extractPsiAccessibility(psiData: any): PsiAccessibility | null {
  if (!psiData) return null;
  const strategy = psiData.mobile || psiData.desktop;
  if (!strategy) return null;

  const cats = strategy.categories || strategy;
  const score = Math.round((cats.accessibility ?? 0) * (cats.accessibility <= 1 ? 100 : 1));

  const allAudits: any[] = [];
  const failed = strategy.failed || [];
  const passed = strategy.passed || [];
  const diagnostics = strategy.diagnostics || [];

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

function LighthouseAccessibilityCard({ data, isLoading }: { data: PsiAccessibility | null; isLoading: boolean }) {
  if (isLoading || !data) return null;

  const failedAudits = data.audits.filter(a => a.score !== null && a.score < 1);
  const passedAudits = data.audits.filter(a => a.score === 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Accessibility className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Lighthouse Accessibility Score</span>
        <Badge
          variant={data.score >= 90 ? 'default' : data.score >= 50 ? 'secondary' : 'destructive'}
          className="ml-auto"
        >
          {data.score}/100
        </Badge>
      </div>

      {failedAudits.length > 0 && (
        <CollapsibleSection
          title="Failed Audits"
          icon={<AlertCircle className="h-4 w-4 text-destructive" />}
          count={failedAudits.length}
          defaultOpen={true}
        >
          <div className="space-y-1">
            {failedAudits.map((a, i) => (
              <div key={i} className="text-xs flex items-start gap-1.5 border-b border-border/50 pb-1 last:border-0">
                <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                <span>{a.title}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {passedAudits.length > 0 && (
        <CollapsibleSection
          title="Passed Audits"
          icon={<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
          count={passedAudits.length}
        >
          <div className="space-y-0.5">
            {passedAudits.map((a, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                <span>{a.title}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

export { LighthouseAccessibilityCard, extractPsiAccessibility };
export type { PsiAccessibility };
