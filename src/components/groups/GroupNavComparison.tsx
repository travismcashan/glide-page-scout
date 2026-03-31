import { useMemo, useState } from 'react';
import { Check, X, Minus, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FullBleedTable } from './FullBleedTable';

const MIN_VISIBLE_SITES = 3;

type SessionData = { id: string; domain: string; [key: string]: any };
type Props = { sessions: SessionData[]; minPct?: number; checkedItems?: Set<string>; onCheckedChange?: (items: Set<string>) => void };

type NavEntry = {
  label: string;
  sites: Set<string>;
};

export function GroupNavComparison({ sessions, minPct = 0, checkedItems, onCheckedChange }: Props) {
  const [expandedBelow, setExpandedBelow] = useState(false);

  const { aboveThreshold, belowThreshold, sharedCount, uniqueCount, totalItems } = useMemo(() => {
    const map = new Map<string, NavEntry>();

    for (const session of sessions) {
      const nav = session.nav_structure;
      if (!nav?.primary) continue;

      const labels = new Set<string>();
      for (const item of nav.primary) {
        if (item.label) labels.add(item.label.trim());
      }

      for (const label of labels) {
        const key = label.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { label, sites: new Set() });
        }
        map.get(key)!.sites.add(session.id);
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.sites.size - a.sites.size);

    const sessCount = sessions.filter(s => s.nav_structure?.primary).length;
    const shared = sorted.filter(e => e.sites.size === sessCount && sessCount > 1);
    const unique = sorted.filter(e => e.sites.size === 1);

    return {
      aboveThreshold: sorted.filter(e => e.sites.size >= MIN_VISIBLE_SITES),
      belowThreshold: sorted.filter(e => e.sites.size < MIN_VISIBLE_SITES),
      sharedCount: shared.length,
      uniqueCount: unique.length,
      totalItems: map.size,
    };
  }, [sessions]);

  if (aboveThreshold.length === 0 && belowThreshold.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No navigation data available yet.</p>
      </div>
    );
  }

  const sessionsWithData = sessions.filter(s => s.nav_structure?.primary);
  const minSites = Math.max(1, Math.ceil(sessionsWithData.length * minPct / 100));

  const renderRow = (entry: NavEntry, dimmed = false) => {
    const key = entry.label.toLowerCase();
    const isChecked = dimmed ? false : (checkedItems?.size ? checkedItems.has(key) : entry.sites.size >= minSites);
    const toggleCheck = () => {
      if (!onCheckedChange || dimmed) return;
      const next = new Set(checkedItems);
      next.has(key) ? next.delete(key) : next.add(key);
      onCheckedChange(next);
    };
    return (
      <tr key={entry.label} className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${dimmed ? 'opacity-30' : ''}`}>
        <td className="py-2 px-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={isChecked} onCheckedChange={dimmed ? undefined : toggleCheck} className={`h-3.5 w-3.5 shrink-0 ${dimmed ? '' : 'cursor-pointer'}`} />
            <span className={`text-sm font-medium whitespace-nowrap ${isChecked ? '' : 'line-through text-muted-foreground'}`}>{entry.label}</span>
          </div>
        </td>
        <td className="text-center py-2 px-2">
          <span className={`text-xs font-medium ${dimmed ? 'text-muted-foreground/40' : isChecked ? (entry.sites.size === sessionsWithData.length ? 'text-emerald-600' : 'text-foreground') : 'text-destructive'}`}>
            {entry.sites.size}/{sessionsWithData.length}
          </span>
        </td>
        {sessionsWithData.map(s => (
          <td key={s.id} className="text-center py-2 px-3">
            {entry.sites.has(s.id) ? (
              dimmed ? (
                <Check className="h-4 w-4 mx-auto text-muted-foreground/30" />
              ) : isChecked ? (
                <Check className="h-4 w-4 mx-auto text-emerald-500" />
              ) : (
                <X className="h-4 w-4 mx-auto text-destructive" />
              )
            ) : (
              <Minus className="h-3.5 w-3.5 mx-auto text-muted-foreground/20" />
            )}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-4xl font-light tracking-tight text-foreground">Navigation</h3>
      </div>

      {sessionsWithData.length > 1 && (
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="font-medium">{sharedCount}</span>
            <span className="text-muted-foreground">shared nav items</span>
          </div>
          {uniqueCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="font-medium">{uniqueCount}</span>
              <span className="text-muted-foreground">unique to one site</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="font-medium">{totalItems}</span>
            <span className="text-muted-foreground">total nav items</span>
          </div>
        </div>
      )}

      <FullBleedTable>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Nav Item</th>
              <th className="text-center py-3 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Sites</th>
              {sessionsWithData.map(s => (
                <th key={s.id} className="text-center py-3 px-3 font-medium text-xs max-w-[100px]">
                  <span className="truncate block">{s.domain.replace('www.', '')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* All above-threshold rows shown */}
            {aboveThreshold.map(entry => renderRow(entry))}

            {/* Below threshold: show-all toggle */}
            {belowThreshold.length > 0 && !expandedBelow && (
              <tr className="border-b border-border/30">
                <td colSpan={sessionsWithData.length + 2}>
                  <button
                    onClick={() => setExpandedBelow(true)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronsUpDown className="h-3 w-3" />
                    Show {belowThreshold.length} more on fewer than {MIN_VISIBLE_SITES} sites
                  </button>
                </td>
              </tr>
            )}

            {expandedBelow && belowThreshold.map(entry => renderRow(entry, true))}

            {expandedBelow && belowThreshold.length > 0 && (
              <tr className="border-b border-border/30">
                <td colSpan={sessionsWithData.length + 2}>
                  <button
                    onClick={() => setExpandedBelow(false)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronsUpDown className="h-3 w-3" />
                    Hide items on fewer than {MIN_VISIBLE_SITES} sites
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </FullBleedTable>
    </div>
  );
}
