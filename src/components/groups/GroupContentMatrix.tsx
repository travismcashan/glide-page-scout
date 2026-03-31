import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { FullBleedTable } from './FullBleedTable';

const MIN_VISIBLE_SITES = 3;

type SessionData = { id: string; domain: string; [key: string]: any };
type Props = { sessions: SessionData[]; minPct?: number; checkedItems?: Set<string>; onCheckedChange?: (items: Set<string>) => void };

type ContentEntry = {
  type: string;
  baseType: string;
  sites: Map<string, number>;
};

type SectionGroup = { key: string; label: string; entries: ContentEntry[] };

export function GroupContentMatrix({ sessions, minPct = 0, checkedItems, onCheckedChange }: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [expandedBelowSections, setExpandedBelowSections] = useState<Set<string>>(new Set());

  const { sections, sharedCount, uniqueCount, totalTypes } = useMemo(() => {
    const map = new Map<string, ContentEntry>();

    for (const session of sessions) {
      const ct = session.content_types_data;
      if (!ct?.classified) continue;

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

    const all = Array.from(map.values());

    // Split into Pages vs Bulk Content (Posts, CPTs, Archives, Search)
    const pages = all.filter(e => e.baseType === 'Page').sort((a, b) => b.sites.size - a.sites.size);
    const bulk = all.filter(e => e.baseType !== 'Page').sort((a, b) => b.sites.size - a.sites.size);

    const groups: SectionGroup[] = [];
    if (pages.length > 0) groups.push({ key: 'pages', label: 'Pages', entries: pages });
    if (bulk.length > 0) groups.push({ key: 'bulk', label: 'Bulk Content (Posts & CPTs)', entries: bulk });

    const sessCount = sessions.filter(s => s.content_types_data?.classified).length;
    const shared = all.filter(e => e.sites.size === sessCount && sessCount > 1);
    const unique = all.filter(e => e.sites.size === 1);

    return {
      sections: groups,
      sharedCount: shared.length,
      uniqueCount: unique.length,
      totalTypes: map.size,
    };
  }, [sessions]);

  const toggleCollapse = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleExpandBelow = (key: string) => {
    setExpandedBelowSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (sections.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No content type data available yet.</p>
      </div>
    );
  }

  const sessionsWithData = sessions.filter(s => s.content_types_data?.classified);
  const minSites = Math.max(1, Math.ceil(sessionsWithData.length * minPct / 100));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-4xl font-light tracking-tight text-foreground">Content Types</h3>
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
              <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Content Type</th>
              <th className="text-center py-3 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Sites</th>
              {sessionsWithData.map(s => (
                <th key={s.id} className="text-center py-3 px-3 font-medium text-xs max-w-[100px]">
                  <span className="truncate block">{s.domain.replace('www.', '')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map(({ key, label, entries: sectionEntries }) => {
              const isCollapsed = collapsedSections.has(key);
              const isExpandedBelow = expandedBelowSections.has(key);

              const aboveThreshold = sectionEntries.filter(e => e.sites.size >= MIN_VISIBLE_SITES);
              const belowThreshold = sectionEntries.filter(e => e.sites.size < MIN_VISIBLE_SITES);
              const inScopeCount = checkedItems?.size
                ? sectionEntries.filter(e => checkedItems.has(e.type)).length
                : sectionEntries.filter(e => e.sites.size >= minSites).length;
              const hasBelowItems = belowThreshold.length > 0;

              return (
                <React.Fragment key={key}>
                  {/* Section header */}
                  <tr
                    className="bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                    onClick={() => toggleCollapse(key)}
                  >
                    <td colSpan={sessionsWithData.length + 2} className="py-1.5 px-3">
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        }
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                          {inScopeCount}/{sectionEntries.length}
                        </Badge>
                      </div>
                    </td>
                  </tr>

                  {/* Above-threshold rows */}
                  {!isCollapsed && aboveThreshold.map(entry => {
                    const isChecked = checkedItems?.size ? checkedItems.has(entry.type) : entry.sites.size >= minSites;
                    const toggleCheck = () => {
                      if (!onCheckedChange) return;
                      const next = new Set(checkedItems);
                      next.has(entry.type) ? next.delete(entry.type) : next.add(entry.type);
                      onCheckedChange(next);
                    };
                    return (
                      <tr key={entry.type} className="border-b border-border/30 transition-colors hover:bg-muted/20">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={isChecked} onCheckedChange={toggleCheck} className="h-3.5 w-3.5 shrink-0 cursor-pointer" />
                            <span className={`text-sm whitespace-nowrap ${isChecked ? '' : 'line-through text-muted-foreground'}`}>{entry.type}</span>
                            {key === 'bulk' && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.baseType}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="text-center py-2 px-2">
                          <span className={`text-xs font-medium ${isChecked ? (entry.sites.size === sessionsWithData.length ? 'text-emerald-600' : 'text-foreground') : 'text-destructive'}`}>
                            {entry.sites.size}/{sessionsWithData.length}
                          </span>
                        </td>
                        {sessionsWithData.map(s => (
                          <td key={s.id} className="text-center py-2 px-3">
                            {entry.sites.has(s.id) ? (
                              <span className={`text-xs font-medium ${isChecked ? 'text-emerald-600' : 'text-destructive'}`}>{entry.sites.get(s.id)}</span>
                            ) : (
                              <span className="text-muted-foreground/20">&mdash;</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {/* Below-threshold toggle */}
                  {!isCollapsed && hasBelowItems && !isExpandedBelow && (
                    <tr className="border-b border-border/30">
                      <td colSpan={sessionsWithData.length + 2}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpandBelow(key); }}
                          className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronsUpDown className="h-3 w-3" />
                          Show {belowThreshold.length} more on fewer than {MIN_VISIBLE_SITES} sites
                        </button>
                      </td>
                    </tr>
                  )}

                  {!isCollapsed && isExpandedBelow && belowThreshold.map(entry => (
                    <tr key={entry.type} className="border-b border-border/30 transition-colors hover:bg-muted/20 opacity-30">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm whitespace-nowrap line-through">{entry.type}</span>
                          {key === 'bulk' && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.baseType}</Badge>
                          )}
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
                            <span className="text-muted-foreground/20">&mdash;</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {!isCollapsed && isExpandedBelow && hasBelowItems && (
                    <tr className="border-b border-border/30">
                      <td colSpan={sessionsWithData.length + 2}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpandBelow(key); }}
                          className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronsUpDown className="h-3 w-3" />
                          Hide items on fewer than {MIN_VISIBLE_SITES} sites
                        </button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </FullBleedTable>
    </div>
  );
}
