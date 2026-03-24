import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, PauseCircle, ChevronDown, ChevronUp } from 'lucide-react';

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
  /** External collapse control — when provided, overrides internal state */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Unique section identifier for persisting collapse state */
  sectionId?: string;
  /** Callback when collapse state changes (for persistence) */
  onCollapseChange?: (sectionId: string, collapsed: boolean) => void;
  /** Persisted collapse state from localStorage */
  persistedCollapsed?: boolean | undefined;
};

export function SectionCard({ title, icon, children, loading, loadingText, error, errorText, paused, headerExtra, collapsed: controlledCollapsed, onToggleCollapse, sectionId, onCollapseChange, persistedCollapsed }: SectionCardProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    // Initialize from persisted state if available
    if (persistedCollapsed !== undefined) return persistedCollapsed;
    return false;
  });
  const [hasOverride, setHasOverride] = useState(() => {
    // If we have persisted state, start with override so global toggle doesn't stomp it
    return persistedCollapsed !== undefined;
  });

  // When the global toggle changes, reset any local override
  useEffect(() => {
    if (controlledCollapsed !== undefined) {
      setHasOverride(false);
    }
  }, [controlledCollapsed]);

  const isCollapsed = hasOverride ? internalCollapsed : (controlledCollapsed ?? internalCollapsed);

  const handleToggle = () => {
    const newCollapsed = !isCollapsed;
    if (onToggleCollapse) {
      onToggleCollapse();
    } else if (controlledCollapsed !== undefined) {
      setHasOverride(true);
      setInternalCollapsed(newCollapsed);
    } else {
      setInternalCollapsed(newCollapsed);
    }
    // Persist the change
    if (sectionId && onCollapseChange) {
      onCollapseChange(sectionId, newCollapsed);
    }
  };

  return (
    <Card className={`overflow-hidden ${error ? 'border-destructive/40' : ''} ${paused ? 'opacity-60' : ''}`}>
      <div
        className="px-6 py-4 border-b border-border flex items-center gap-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
        onClick={handleToggle}
      >
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {headerExtra && !paused && <div className="ml-auto" onClick={e => e.stopPropagation()}>{headerExtra}</div>}
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
        <div className={`shrink-0 ${headerExtra || paused || error ? '' : 'ml-auto'}`}>
          {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>
      {!isCollapsed && (
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
      )}
    </Card>
  );
}
