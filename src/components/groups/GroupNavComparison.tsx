import { useMemo, useState } from 'react';
import { Check, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { FullBleedTable } from './FullBleedTable';

const MIN_VISIBLE_SITES = 3;

type SessionData = { id: string; domain: string; [key: string]: any };
type Props = { sessions: SessionData[]; minSites?: number };

type NavEntry = {
  label: string;
  sites: Set<string>;
};

export function GroupNavComparison({ sessions, minSites = 1 }: Props) {
  const [showHidden, setShowHidden] = useState(false);
  const { entries, sharedCount, uniqueCount, totalItems } = useMemo(() => {
    const map = new Map<string, NavEntry>();

    for (const session of sessions) {
      const nav = session.nav_structure;
      if (!nav?.primary) continue;

      // Extract top-level nav labels
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

    // Sort by adoption (most common first)
    const sorted = Array.from(map.values()).sort((a, b) => b.sites.size - a.sites.size);

    const sessCount = sessions.filter(s => s.nav_structure?.primary).length;
    const shared = sorted.filter(e => e.sites.size === sessCount && sessCount > 1);
    const unique = sorted.filter(e => e.sites.size === 1);

    return { entries: sorted, sharedCount: shared.length, uniqueCount: unique.length, totalItems: map.size };
  }, [sessions]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No navigation data available yet.</p>
      </div>
    );
  }

  const sessionsWithData = sessions.filter(s => s.nav_structure?.primary);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Navigation Structure</h3>
        <p className="text-sm text-muted-foreground">Primary navigation items across sites</p>
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
              <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nav Item</th>
              <th className="text-center py-3 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sites</th>
              {sessionsWithData.map(s => (
                <th key={s.id} className="text-center py-3 px-3 font-medium text-xs max-w-[100px]">
                  <span className="truncate block">{s.domain.replace('www.', '')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.filter(e => e.sites.size >= MIN_VISIBLE_SITES || showHidden).map(entry => {
              const inScope = entry.sites.size >= minSites;
              const belowMin = entry.sites.size < MIN_VISIBLE_SITES;
              return (
                <tr key={entry.label} className={`border-b border-border/30 transition-colors ${belowMin ? 'opacity-30' : inScope ? 'hover:bg-muted/20' : 'opacity-40'}`}>
                  <td className={`py-2 px-3 text-sm font-medium ${inScope && !belowMin ? '' : 'line-through'}`}>{entry.label}</td>
                  <td className="text-center py-2 px-2">
                    <span className={`text-xs font-medium ${belowMin ? 'text-muted-foreground/40' : inScope ? (entry.sites.size === sessionsWithData.length ? 'text-emerald-600' : 'text-foreground') : 'text-destructive'}`}>
                      {entry.sites.size}/{sessionsWithData.length}
                    </span>
                  </td>
                  {sessionsWithData.map(s => (
                    <td key={s.id} className="text-center py-2 px-3">
                      {entry.sites.has(s.id) ? (
                        <Check className={`h-4 w-4 mx-auto ${belowMin ? 'text-muted-foreground/30' : inScope ? 'text-emerald-500' : 'text-destructive/40'}`} />
                      ) : (
                        <Minus className="h-3.5 w-3.5 mx-auto text-muted-foreground/20" />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {(() => {
          const hiddenCount = entries.filter(e => e.sites.size < MIN_VISIBLE_SITES).length;
          if (hiddenCount === 0) return null;
          return (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
              {showHidden ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showHidden ? 'Hide' : `Show ${hiddenCount} more`} items on fewer than {MIN_VISIBLE_SITES} sites
            </button>
          );
        })()}
      </FullBleedTable>
    </div>
  );
}
