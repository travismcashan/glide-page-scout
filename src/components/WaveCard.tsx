import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { ChevronDown, AlertCircle, AlertTriangle, CheckCircle2, Eye, Contrast, LayoutList } from 'lucide-react';

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
            <span className={`font-medium ${variant === 'error' ? 'text-destructive' : variant === 'alert' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
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

function WaveCard({ data, isLoading }: { data: WaveData | null; isLoading: boolean }) {
  if (isLoading || !data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">WAVE Accessibility Report</span>
        {data.waveUrl && (
          <a href={data.waveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-auto">
            Full Report →
          </a>
        )}
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={data.summary.errors > 0 ? 'destructive' : 'default'} className="text-xs">
          {data.summary.errors} Errors
        </Badge>
        <Badge variant={data.summary.contrast > 0 ? 'destructive' : 'default'} className="text-xs">
          {data.summary.contrast} Contrast
        </Badge>
        <Badge variant={data.summary.alerts > 0 ? 'secondary' : 'default'} className="text-xs">
          {data.summary.alerts} Alerts
        </Badge>
        <Badge variant="outline" className="text-xs">{data.summary.features} Features</Badge>
        <Badge variant="outline" className="text-xs">{data.summary.aria} ARIA</Badge>
        <Badge variant="outline" className="text-xs">{data.summary.structure} Structure</Badge>
      </div>

      {data.creditsRemaining != null && (
        <p className="text-[10px] text-muted-foreground">WAVE credits remaining: {data.creditsRemaining}</p>
      )}

      {data.summary.errors > 0 && (
        <CollapsibleSection title="Errors" icon={<AlertCircle className="h-4 w-4 text-destructive" />} count={data.summary.errors} defaultOpen={true}>
          <WaveItemList items={data.items.errors} variant="error" />
        </CollapsibleSection>
      )}

      {data.summary.contrast > 0 && (
        <CollapsibleSection title="Contrast Issues" icon={<Contrast className="h-4 w-4 text-destructive" />} count={data.summary.contrast} defaultOpen={true}>
          <WaveItemList items={data.items.contrast} variant="error" />
        </CollapsibleSection>
      )}

      {data.summary.alerts > 0 && (
        <CollapsibleSection title="Alerts" icon={<AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />} count={data.summary.alerts}>
          <WaveItemList items={data.items.alerts} variant="alert" />
        </CollapsibleSection>
      )}

      {data.summary.aria > 0 && (
        <CollapsibleSection title="ARIA" icon={<LayoutList className="h-4 w-4 text-primary" />} count={data.summary.aria}>
          <WaveItemList items={data.items.aria} variant="feature" />
        </CollapsibleSection>
      )}

      {data.summary.features > 0 && (
        <CollapsibleSection title="Accessibility Features" icon={<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />} count={data.summary.features}>
          <WaveItemList items={data.items.features} variant="feature" />
        </CollapsibleSection>
      )}
    </div>
  );
}

export { WaveCard };
export type { WaveData };
