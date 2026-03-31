import { useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import { FullBleedTable } from './FullBleedTable';

type SessionData = { id: string; domain: string; [key: string]: any };
type Props = { sessions: SessionData[] };

type NavEntry = {
  label: string;
  sites: Set<string>;
};

export function GroupNavComparison({ sessions }: Props) {
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
            {entries.map(entry => (
              <tr key={entry.label} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                <td className="py-2 px-3 text-sm font-medium">{entry.label}</td>
                <td className="text-center py-2 px-2">
                  <span className={`text-xs font-medium ${entry.sites.size === sessionsWithData.length ? 'text-emerald-600' : entry.sites.size === 1 ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                    {entry.sites.size}/{sessionsWithData.length}
                  </span>
                </td>
                {sessionsWithData.map(s => (
                  <td key={s.id} className="text-center py-2 px-3">
                    {entry.sites.has(s.id) ? (
                      <Check className="h-4 w-4 mx-auto text-emerald-500" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 mx-auto text-muted-foreground/20" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </FullBleedTable>
    </div>
  );
}
