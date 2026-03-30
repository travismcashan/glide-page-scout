import { useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type SessionData = { id: string; domain: string; [key: string]: any };
type Props = { sessions: SessionData[] };

type TemplateEntry = {
  template: string;
  baseType: string;
  sites: Map<string, number>; // sessionId → page count
};

// Group templates by their base type for organized display
const BASE_TYPE_ORDER = ['Page', 'Post', 'CPT', 'Archive', 'Search'];

export function GroupTemplateMatrix({ sessions }: Props) {
  const { entries, groups, sharedCount, uniqueCount, totalTemplates } = useMemo(() => {
    const map = new Map<string, TemplateEntry>();

    for (const session of sessions) {
      const tags = session.page_tags;
      if (!tags || typeof tags !== 'object') continue;

      // Count pages per template
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

    // Group by baseType
    const groupMap = new Map<string, TemplateEntry[]>();
    for (const entry of map.values()) {
      const bt = entry.baseType;
      if (!groupMap.has(bt)) groupMap.set(bt, []);
      groupMap.get(bt)!.push(entry);
    }

    // Sort within groups by adoption count
    for (const entries of groupMap.values()) {
      entries.sort((a, b) => b.sites.size - a.sites.size);
    }

    // Sort groups by BASE_TYPE_ORDER
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

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No template data available yet.</p>
      </div>
    );
  }

  const sessionsWithData = sessions.filter(s => s.page_tags && Object.keys(s.page_tags).length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Templates</h3>
        <p className="text-sm text-muted-foreground">Which page templates are needed for each site</p>
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Template</th>
              <th className="text-center py-3 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sites</th>
              {sessionsWithData.map(s => (
                <th key={s.id} className="text-center py-3 px-3 font-medium text-xs max-w-[100px]">
                  <span className="truncate block">{s.domain.replace('www.', '')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([baseType, groupEntries]) => (
              <>
                <tr key={`bt-${baseType}`} className="bg-muted/40">
                  <td colSpan={sessionsWithData.length + 2} className="py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {baseType === 'CPT' ? 'Custom Post Types' : baseType === 'Page' ? 'Custom Pages' : baseType + 's'}
                  </td>
                </tr>
                {groupEntries.map(entry => (
                  <tr key={entry.template} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 text-sm">{entry.template}</td>
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
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
