import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

type SectionCardProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  error?: boolean;
  errorText?: string;
  paused?: boolean;
  /** Called when the user toggles the pause switch on the results page */
  onTogglePause?: () => void;
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

export function SectionCard({ title, icon, children, loading, loadingText, error, errorText, paused, onTogglePause, headerExtra, collapsed: controlledCollapsed, onToggleCollapse, sectionId, onCollapseChange, persistedCollapsed }: SectionCardProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    if (persistedCollapsed !== undefined) return persistedCollapsed;
    if (paused) return true;
    return false;
  });
  const [hasOverride, setHasOverride] = useState(() => {
    return persistedCollapsed !== undefined;
  });

  useEffect(() => {
    if (controlledCollapsed !== undefined) {
      setHasOverride(false);
    }
  }, [controlledCollapsed]);

  const isCollapsed = hasOverride ? internalCollapsed : (controlledCollapsed ?? internalCollapsed);

  const handleToggle = () => {
    if (paused) return;
    const newCollapsed = !isCollapsed;
    if (onToggleCollapse) {
      onToggleCollapse();
    } else if (controlledCollapsed !== undefined) {
      setHasOverride(true);
      setInternalCollapsed(newCollapsed);
    } else {
      setInternalCollapsed(newCollapsed);
    }
    if (sectionId && onCollapseChange) {
      onCollapseChange(sectionId, newCollapsed);
    }
  };

  return (
    <Card className={`overflow-hidden ${error ? 'border-destructive/40' : ''} ${paused ? 'opacity-50' : ''}`}>
      <div
        className={`px-4 py-2.5 border-b border-border flex items-center gap-2.5 select-none transition-colors ${paused ? 'cursor-default' : 'cursor-pointer hover:bg-muted/30'}`}
        onClick={handleToggle}
      >
        <div className="p-1.5 rounded-md bg-muted">{icon}</div>
        <h2 className="text-base font-semibold">{title}</h2>
        {headerExtra && !paused && <div className="ml-auto" onClick={e => e.stopPropagation()}>{headerExtra}</div>}
        {paused && onTogglePause && (
          <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <span className="text-xs text-muted-foreground">Off</span>
            <Switch
              checked={false}
              onCheckedChange={() => onTogglePause()}
              className="data-[state=unchecked]:bg-destructive"
            />
          </div>
        )}
        {paused && !onTogglePause && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto gap-0.5">
            Paused
          </Badge>
        )}
        {error && !paused && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-auto">
            <AlertTriangle className="h-3 w-3 mr-0.5" /> Error
          </Badge>
        )}
        {!paused && (
          <div className={`shrink-0 ${headerExtra || error ? '' : 'ml-auto'}`}>
            {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          </div>
        )}
      </div>
      {!isCollapsed && !paused && (
        <div className="p-6">
          {loading ? (
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
