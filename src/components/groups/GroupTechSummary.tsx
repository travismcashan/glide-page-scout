import { useMemo } from 'react';

type SessionData = { id: string; domain: string; [key: string]: any };

type Props = {
  sessions: SessionData[];
  minPct: number;
  onMinPctChange: (n: number) => void;
};

function extractTechs(session: any): string[] {
  const techs: string[] = [];
  const bw = session.builtwith_data;
  if (bw?.grouped) {
    for (const items of Object.values(bw.grouped)) {
      if (Array.isArray(items)) {
        for (const t of items as any[]) {
          if (t.name) techs.push(t.name);
        }
      }
    }
  } else if (bw?.technologies) {
    for (const t of bw.technologies) {
      if (t.name) techs.push(t.name);
    }
  }
  return techs;
}

export function GroupTechSummary({ sessions, minPct, onMinPctChange }: Props) {
  const sessionsWithData = sessions.filter(s => {
    const bw = s.builtwith_data;
    return bw?.grouped || bw?.technologies;
  });
  const siteCount = sessionsWithData.length;
  const minSites = Math.max(1, Math.ceil(siteCount * minPct / 100));

  const analysis = useMemo(() => {
    if (siteCount < 2) return { percent: 0, shared: 0, included: 0, total: 0, categories: 0 };

    const techSites = new Map<string, Set<string>>();
    const categories = new Set<string>();

    for (const session of sessionsWithData) {
      const bw = session.builtwith_data;
      if (bw?.grouped) {
        for (const [category, items] of Object.entries(bw.grouped)) {
          categories.add(category);
          if (Array.isArray(items)) {
            for (const t of items as any[]) {
              if (t.name) {
                const key = t.name.toLowerCase();
                if (!techSites.has(key)) techSites.set(key, new Set());
                techSites.get(key)!.add(session.id);
              }
            }
          }
        }
      } else if (bw?.technologies) {
        for (const t of bw.technologies) {
          if (t.name) {
            const key = t.name.toLowerCase();
            if (!techSites.has(key)) techSites.set(key, new Set());
            techSites.get(key)!.add(session.id);
            if (t.categories?.[0] || t.tag) categories.add(t.categories?.[0] || t.tag);
          }
        }
      }
    }

    const filtered = Array.from(techSites.entries()).filter(([, sites]) => sites.size >= minSites);
    const shared = filtered.filter(([, s]) => s.size === siteCount).length;

    let totalWeight = 0;
    let sharedWeight = 0;
    for (const [, sites] of filtered) {
      totalWeight += siteCount;
      sharedWeight += sites.size;
    }
    const percent = totalWeight > 0 ? Math.round((sharedWeight / totalWeight) * 100) : 0;

    return {
      percent,
      shared,
      included: filtered.length,
      total: techSites.size,
      categories: categories.size,
    };
  }, [sessions, minSites, siteCount]);

  if (siteCount < 2) return null;

  return (
    <div className="space-y-6">
      <div className="text-center py-8 rounded-xl border border-border bg-muted/20">
        <div className="text-6xl font-bold tracking-tight">{analysis.percent}%</div>
        <div className="text-lg text-muted-foreground mt-2">Technical Similarity</div>

        {/* Scope slider */}
        <div className="flex items-center justify-center gap-4 mt-5 max-w-sm mx-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap">More scope</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minPct}
            onChange={e => onMinPctChange(Number(e.target.value))}
            className="flex-1 accent-primary h-2 cursor-pointer"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Less scope</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {minPct === 0
            ? 'Including all technologies'
            : minPct >= 100
              ? 'Only technologies on every site'
              : `Technologies on ${minPct}%+ of sites (${minSites}+ of ${siteCount})`
          }
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard value={analysis.shared} label="shared across all sites" />
        <StatCard value={analysis.included} label="in scope" />
        <StatCard value={analysis.total} label="total detected" />
        <StatCard value={analysis.categories} label="categories" />
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
