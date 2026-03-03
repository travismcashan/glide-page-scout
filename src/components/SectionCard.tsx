import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, PauseCircle } from 'lucide-react';

type SectionCardProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  error?: boolean;
  errorText?: string;
  paused?: boolean;
  /** Extra content shown in the header bar (right side) */
  headerExtra?: React.ReactNode;
};

export function SectionCard({ title, icon, children, loading, loadingText, error, errorText, paused, headerExtra }: SectionCardProps) {
  return (
    <Card className={`overflow-hidden ${error ? 'border-destructive/40' : ''} ${paused ? 'opacity-60' : ''}`}>
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {headerExtra && !paused && <div className="ml-auto">{headerExtra}</div>}
        {paused && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto gap-0.5">
            <PauseCircle className="h-3 w-3" /> Paused
          </Badge>
        )}
        {error && !paused && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-auto">
            <AlertTriangle className="h-3 w-3 mr-0.5" /> Error
          </Badge>
        )}
      </div>
      <div className="p-6">
        {paused ? (
          <p className="text-sm text-muted-foreground py-2">This integration is paused. Enable it on the Integrations page to run it.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span className="text-sm">{loadingText || 'Loading...'}</span>
          </div>
        ) : error && !children ? (
          <div className="flex items-center gap-2 text-destructive py-4">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{errorText || 'This integration encountered an error. Check backend logs for details.'}</span>
          </div>
        ) : (
          <>
            {error && errorText && (
              <div className="flex items-center gap-2 text-destructive mb-4 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-xs">{errorText}</span>
              </div>
            )}
            {children}
          </>
        )}
      </div>
    </Card>
  );
}
