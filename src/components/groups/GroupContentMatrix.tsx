import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FullBleedTable } from './FullBleedTable';

const MIN_VISIBLE_SITES = 3; // Hide items appearing on fewer than 3 sites

type SessionData = { id: string; domain: string; [key: string]: any };
type Props = { sessions: SessionData[]; minSites?: number };

type ContentEntry = {
  type: string;
  baseType: string;
  sites: Map<string, number>; // sessionId → page count
};

export function GroupContentMatrix({ sessions, minSites = 1 }: Props) {
  const [showHidden, setShowHidden] = useState(false);
  const { entries, sharedCount, uniqueCount, totalTypes } = useMemo(() => {
    const map = new Map<string, ContentEntry>();

    for (const session of sessions) {
      const ct = session.content_types_data;
      if (!ct?.classified) continue;

      // Count pages per content type
      const typeCounts = new Map<string, { count: number; baseType: string }>();
      for (const page of ct.classified) {
        const type = page.contentType || page.template || 'Unknown';
        const existing = typeCounts.get(type) || { count: 0, baseType: page.baseType || 'Page' };
        existing.count++;
        typeCounts.set(type, existing);
      }

      for (const [type, { count, baseType }] of typeCounts) {
        if (!map.has(type)) {
          map.set(type, { type, baseType, sites: new Map() });
        }
        map.get(type)!.sites.set(session.id, count);
      }
    }

    // Sort by adoption (most sites first), then by total pages
    const sorted = Array.from(map.values()).sort((a, b) => {
      const diff = b.sites.size - a.sites.size;
      if (diff !== 0) return diff;
      const aTotal = Array.from(a.sites.values()).reduce((s, v) => s + v, 0);
      const bTotal = Array.from(b.sites.values()).reduce((s, v) => s + v, 0);
      return bTotal - aTotal;
    });

    const sessCount = sessions.filter(s => s.content_types_data?.classified).length;
    const shared = sorted.filter(e => e.sites.size === sessCount && sessCount > 1);
    const unique = sorted.filter(e => e.sites.size === 1);

    return { entries: sorted, sharedCount: shared.length, uniqueCount: unique.length, totalTypes: map.size };
  }, [sessions]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No content type data available yet.</p>
      </div>
    );
  }

  const sessionsWithData = sessions.filter(s => s.content_types_data?.classified);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Content Types</h3>
        <p className="text-sm text-muted-foreground">Which types of content appear on each site</p>
      </div>

      {sessionsWithData.length > 1 && (
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="font-medium">{sharedCount}</span>
            <span className="text-muted-foreground">shared across all sites</span>
          </div>
          {uniqueCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="font-medium">{uniqueCount}</span>
              <span className="text-muted-foreground">unique to one site</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="font-medium">{totalTypes}</span>
            <span className="text-muted-foreground">content types detected</span>
          </div>
        </div>
      )}

      <FullBleedTable>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Content Type</th>
              <th className="text-center py-3 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sites</th>
              {sessionsWithData.map(s => (
                <th key={s.id} className="text-center py-3 px-3 font-medium text-xs max-w-[100px]">
                  <span className="truncate block">{s.domain.replace('www.', '')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.filter(e => e.sites.size >= MIN_VISIBLE_SITES).map(entry => {
              const inScope = entry.sites.size >= minSites;
              return (
                <tr key={entry.type} className={`border-b border-border/30 transition-colors ${inScope ? 'hover:bg-muted/20' : 'opacity-40'}`}>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${inScope ? '' : 'line-through'}`}>{entry.type}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.baseType}</Badge>
                    </div>
                  </td>
                  <td className="text-center py-2 px-2">
                    <span className={`text-xs font-medium ${inScope ? (entry.sites.size === sessionsWithData.length ? 'text-emerald-600' : 'text-foreground') : 'text-destructive'}`}>
                      {entry.sites.size}/{sessionsWithData.length}
                    </span>
                  </td>
                  {sessionsWithData.map(s => (
                    <td key={s.id} className="text-center py-2 px-3">
                      {entry.sites.has(s.id) ? (
                        <span className={`text-xs font-medium ${inScope ? 'text-emerald-600' : 'text-destructive/60'}`}>{entry.sites.get(s.id)}</span>
                      ) : (
                        <span className="text-muted-foreground/20">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {showHidden && entries.filter(e => e.sites.size < MIN_VISIBLE_SITES).map(entry => (
              <tr key={entry.type} className="border-b border-border/30 opacity-30">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm line-through">{entry.type}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.baseType}</Badge>
                  </div>
                </td>
                <td className="text-center py-2 px-2">
                  <span className="text-xs font-medium text-muted-foreground/40">{entry.sites.size}/{sessionsWithData.length}</span>
                </td>
                {sessionsWithData.map(s => (
                  <td key={s.id} className="text-center py-2 px-3">
                    {entry.sites.has(s.id) ? (
                      <span className="text-xs font-medium text-muted-foreground/40">{entry.sites.get(s.id)}</span>
                    ) : (
                      <span className="text-muted-foreground/20">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
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
