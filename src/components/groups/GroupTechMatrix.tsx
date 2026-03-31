import { useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import { FullBleedTable } from './FullBleedTable';

type SessionData = { id: string; domain: string; [key: string]: any };

type Props = {
  sessions: SessionData[];
};

type TechEntry = {
  name: string;
  category: string;
  sites: Set<string>;
};

function extractTechs(session: any): { name: string; category: string }[] {
  const techs: { name: string; category: string }[] = [];

  const bw = session.builtwith_data;
  // BuiltWith grouped format: { grouped: { "CMS": [...], "Analytics": [...] } }
  if (bw?.grouped) {
    for (const [category, items] of Object.entries(bw.grouped)) {
      if (Array.isArray(items)) {
        for (const t of items as any[]) {
          if (t.name) techs.push({ name: t.name, category });
        }
      }
    }
  } else if (bw?.technologies) {
    for (const t of bw.technologies) {
      if (t.name) techs.push({ name: t.name, category: t.categories?.[0] || t.tag || 'Other' });
    }
  }

  return techs;
}

const CATEGORY_ORDER_HINTS = ['CMS', 'JavaScript frameworks', 'Web frameworks', 'Analytics', 'Marketing', 'CDN', 'Hosting', 'Security', 'Font scripts', 'Tag managers', 'Other'];

export function GroupTechMatrix({ sessions }: Props) {
  const { techMap, categories, sharedTechs, uniqueTechs } = useMemo(() => {
    const map = new Map<string, TechEntry>();

    for (const session of sessions) {
      const techs = extractTechs(session);
      for (const t of techs) {
        const key = t.name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name: t.name, category: t.category, sites: new Set() });
        }
        map.get(key)!.sites.add(session.id);
      }
    }

    // Group by category
    const catMap = new Map<string, TechEntry[]>();
    for (const entry of map.values()) {
      const cat = entry.category;
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(entry);
    }

    // Sort categories
    const sortedCats = Array.from(catMap.keys()).sort((a, b) => {
      const ai = CATEGORY_ORDER_HINTS.findIndex(h => a.toLowerCase().includes(h.toLowerCase()));
      const bi = CATEGORY_ORDER_HINTS.findIndex(h => b.toLowerCase().includes(h.toLowerCase()));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    // Shared vs unique
    const shared = Array.from(map.values()).filter(t => t.sites.size === sessions.length);
    const unique = Array.from(map.values()).filter(t => t.sites.size === 1);

    return { techMap: map, categories: sortedCats.map(c => ({ name: c, techs: catMap.get(c)! })), sharedTechs: shared, uniqueTechs: unique };
  }, [sessions]);

  if (techMap.size === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No technology data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary badges */}
      {sessions.length > 1 && (
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="font-medium">{sharedTechs.length}</span>
            <span className="text-muted-foreground">shared across all sites</span>
          </div>
          {uniqueTechs.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="font-medium">{uniqueTechs.length}</span>
              <span className="text-muted-foreground">unique to one site</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="font-medium">{techMap.size}</span>
            <span className="text-muted-foreground">technologies detected</span>
          </div>
        </div>
      )}

      {/* Matrix table */}
      <FullBleedTable>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Technology</th>
              {sessions.map(s => (
                <th key={s.id} className="text-center py-3 px-3 font-medium text-xs max-w-[120px]">
                  <span className="truncate block">{s.domain}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <>
                <tr key={`cat-${cat.name}`} className="bg-muted/40">
                  <td colSpan={sessions.length + 1} className="py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.name}
                  </td>
                </tr>
                {cat.techs.sort((a, b) => b.sites.size - a.sites.size).map(tech => (
                  <tr key={tech.name} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 text-sm">{tech.name}</td>
                    {sessions.map(s => (
                      <td key={s.id} className="text-center py-2 px-3">
                        {tech.sites.has(s.id) ? (
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
      </FullBleedTable>
    </div>
  );
}
