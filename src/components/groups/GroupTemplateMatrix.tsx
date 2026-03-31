import React, { useMemo, useState } from 'react';
import { Check, X, Minus, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FullBleedTable } from './FullBleedTable';

const MIN_VISIBLE_SITES = 3;

type SessionData = { id: string; domain: string; [key: string]: any };
type Props = { sessions: SessionData[]; minPct?: number; checkedItems?: Set<string>; onCheckedChange?: (items: Set<string>) => void };

type TemplateEntry = {
  template: string;
  baseType: string;
  sites: Map<string, number>;
};

const BASE_TYPE_ORDER = ['Page', 'Post', 'CPT', 'Archive', 'Search'];
const BASE_TYPE_LABELS: Record<string, string> = {
  CPT: 'Custom Post Types',
  Page: 'Custom Pages',
  Post: 'Posts',
  Archive: 'Archives',
  Search: 'Search',
};

export function GroupTemplateMatrix({ sessions, minPct = 0, checkedItems, onCheckedChange }: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [expandedBelowSections, setExpandedBelowSections] = useState<Set<string>>(new Set());

  const { entries, groups, sharedCount, uniqueCount, totalTemplates } = useMemo(() => {
    const map = new Map<string, TemplateEntry>();

    for (const session of sessions) {
      const tags = session.page_tags;
      if (!tags || typeof tags !== 'object') continue;

      const templateCounts = new Map<string, { count: number; baseType: string }>();
      for (const tag of Object.values(tags) as any[]) {
        const template = tag.template || 'Unknown';
        const existing = templateCounts.get(template) || { count: 0, baseType: tag.baseType || 'Page' };
        existing.count++;
        templateCounts.set(template, existing);
      }

      for (const [template, { count, baseType }] of templateCounts) {
        if (!map.has(template)) {
          map.set(template, { template, baseType, sites: new Map() });
        }
        map.get(template)!.sites.set(session.id, count);
      }
    }

    const groupMap = new Map<string, TemplateEntry[]>();
    for (const entry of map.values()) {
      const bt = entry.baseType;
      if (!groupMap.has(bt)) groupMap.set(bt, []);
      groupMap.get(bt)!.push(entry);
    }

    for (const entries of groupMap.values()) {
      entries.sort((a, b) => b.sites.size - a.sites.size);
    }

    const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) => {
      const ai = BASE_TYPE_ORDER.indexOf(a);
      const bi = BASE_TYPE_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const sessCount = sessions.filter(s => s.page_tags && Object.keys(s.page_tags).length > 0).length;
    const all = Array.from(map.values());
    const shared = all.filter(e => e.sites.size === sessCount && sessCount > 1);
    const unique = all.filter(e => e.sites.size === 1);

    return {
      entries: all,
      groups: sortedGroups,
      sharedCount: shared.length,
      uniqueCount: unique.length,
      totalTemplates: map.size,
    };
  }, [sessions]);

  const toggleCollapse = (bt: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(bt) ? next.delete(bt) : next.add(bt);
      return next;
    });
  };

  const toggleExpandBelow = (bt: string) => {
    setExpandedBelowSections(prev => {
      const next = new Set(prev);
      next.has(bt) ? next.delete(bt) : next.add(bt);
      return next;
    });
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No template data available yet.</p>
      </div>
    );
  }

  const sessionsWithData = sessions.filter(s => s.page_tags && Object.keys(s.page_tags).length > 0);
  const minSites = Math.max(1, Math.ceil(sessionsWithData.length * minPct / 100));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-4xl font-light tracking-tight text-foreground">Templates</h3>
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
            <span className="font-medium">{totalTemplates}</span>
            <span className="text-muted-foreground">unique templates</span>
          </div>
        </div>
      )}

      <FullBleedTable>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Template</th>
              <th className="text-center py-3 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Sites</th>
              {sessionsWithData.map(s => (
                <th key={s.id} className="text-center py-3 px-3 font-medium text-xs max-w-[100px]">
                  <span className="truncate block">{s.domain.replace('www.', '')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([baseType, groupEntries]) => {
              const isCollapsed = collapsedSections.has(baseType);
              const isExpandedBelow = expandedBelowSections.has(baseType);
              const label = BASE_TYPE_LABELS[baseType] || baseType + 's';

              const aboveThreshold = groupEntries.filter(e => e.sites.size >= MIN_VISIBLE_SITES);
              const belowThreshold = groupEntries.filter(e => e.sites.size < MIN_VISIBLE_SITES);
              const inScopeCount = checkedItems?.size
                ? groupEntries.filter(e => checkedItems.has(e.template)).length
                : groupEntries.filter(e => e.sites.size >= minSites).length;
              const hasBelowItems = belowThreshold.length > 0;

              return (
                <React.Fragment key={baseType}>
                  <tr
                    className="bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                    onClick={() => toggleCollapse(baseType)}
                  >
                    <td colSpan={sessionsWithData.length + 2} className="py-1.5 px-3">
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        }
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                          {inScopeCount}/{groupEntries.length}
                        </Badge>
                      </div>
                    </td>
                  </tr>

                  {!isCollapsed && aboveThreshold.map(entry => {
                    const isChecked = checkedItems?.size ? checkedItems.has(entry.template) : entry.sites.size >= minSites;
                    const toggleCheck = () => {
                      if (!onCheckedChange) return;
                      const next = new Set(checkedItems);
                      next.has(entry.template) ? next.delete(entry.template) : next.add(entry.template);
                      onCheckedChange(next);
                    };
                    return (
                      <tr key={entry.template} className="border-b border-border/30 transition-colors hover:bg-muted/20">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={isChecked} onCheckedChange={toggleCheck} className="h-3.5 w-3.5 shrink-0 cursor-pointer" />
                            <span className={`text-sm whitespace-nowrap ${isChecked ? '' : 'line-through text-muted-foreground'}`}>{entry.template}</span>
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
                              isChecked ? (
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
                  })}

                  {!isCollapsed && hasBelowItems && !isExpandedBelow && (
                    <tr className="border-b border-border/30">
                      <td colSpan={sessionsWithData.length + 2}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpandBelow(baseType); }}
                          className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronsUpDown className="h-3 w-3" />
                          Show {belowThreshold.length} more on fewer than {MIN_VISIBLE_SITES} sites
                        </button>
                      </td>
                    </tr>
                  )}

                  {!isCollapsed && isExpandedBelow && belowThreshold.map(entry => (
                    <tr key={entry.template} className="border-b border-border/30 transition-colors hover:bg-muted/20 opacity-30">
                      <td className="py-2 px-3 text-sm whitespace-nowrap line-through">{entry.template}</td>
                      <td className="text-center py-2 px-2">
                        <span className="text-xs font-medium text-muted-foreground/40">
                          {entry.sites.size}/{sessionsWithData.length}
                        </span>
                      </td>
                      {sessionsWithData.map(s => (
                        <td key={s.id} className="text-center py-2 px-3">
                          {entry.sites.has(s.id) ? (
                            <Check className="h-4 w-4 mx-auto text-muted-foreground/30" />
                          ) : (
                            <Minus className="h-3.5 w-3.5 mx-auto text-muted-foreground/20" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {!isCollapsed && isExpandedBelow && hasBelowItems && (
                    <tr className="border-b border-border/30">
                      <td colSpan={sessionsWithData.length + 2}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpandBelow(baseType); }}
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
