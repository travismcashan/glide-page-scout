import { useMemo } from 'react';
import { Layers, Navigation, FileText, BarChart3 } from 'lucide-react';

type SessionData = { id: string; domain: string; [key: string]: any };
type Props = { sessions: SessionData[] };

function computeOverlap(
  sessions: SessionData[],
  extractor: (session: any) => string[],
): { shared: number; unique: number; total: number; percent: number } {
  const sessionsWithData = sessions.filter(s => {
    try { return extractor(s).length > 0; } catch { return false; }
  });
  if (sessionsWithData.length < 2) return { shared: 0, unique: 0, total: 0, percent: 0 };

  const itemSites = new Map<string, Set<string>>();
  for (const s of sessionsWithData) {
    for (const item of extractor(s)) {
      const key = item.toLowerCase().trim();
      if (!key) continue;
      if (!itemSites.has(key)) itemSites.set(key, new Set());
      itemSites.get(key)!.add(s.id);
    }
  }

  const total = itemSites.size;
  const shared = Array.from(itemSites.values()).filter(s => s.size === sessionsWithData.length).length;
  const unique = Array.from(itemSites.values()).filter(s => s.size === 1).length;

  // Weighted reusability: items used by more sites contribute more
  let totalWeight = 0;
  let sharedWeight = 0;
  for (const sites of itemSites.values()) {
    totalWeight += sessionsWithData.length;
    sharedWeight += sites.size;
  }
  const percent = totalWeight > 0 ? Math.round((sharedWeight / totalWeight) * 100) : 0;

  return { shared, unique, total, percent };
}

export function GroupReusabilitySummary({ sessions }: Props) {
  const analysis = useMemo(() => {
    const templates = computeOverlap(sessions, s => {
      const tags = s.page_tags;
      if (!tags || typeof tags !== 'object') return [];
      return [...new Set(Object.values(tags).map((t: any) => t.template).filter(Boolean))];
    });

    const contentTypes = computeOverlap(sessions, s => {
      const ct = s.content_types_data;
      if (!ct?.classified) return [];
      return [...new Set(ct.classified.map((c: any) => c.contentType).filter(Boolean))];
    });

    const navItems = computeOverlap(sessions, s => {
      const nav = s.nav_structure;
      if (!nav?.primary) return [];
      return nav.primary.map((item: any) => item.label).filter(Boolean);
    });

    // Overall reusability = weighted average of the three dimensions
    const overallPercent = Math.round(
      (templates.percent * 0.4 + contentTypes.percent * 0.35 + navItems.percent * 0.25)
    );

    // Page count stats
    const pageCounts = sessions
      .map(s => {
        const urls = s.discovered_urls;
        if (Array.isArray(urls)) return urls.length;
        if (urls?.links) return urls.links.length;
        if (urls?.urls) return urls.urls.length;
        return 0;
      })
      .filter(c => c > 0);

    const avgPages = pageCounts.length > 0 ? Math.round(pageCounts.reduce((a, b) => a + b, 0) / pageCounts.length) : 0;
    const minPages = pageCounts.length > 0 ? Math.min(...pageCounts) : 0;
    const maxPages = pageCounts.length > 0 ? Math.max(...pageCounts) : 0;

    return { templates, contentTypes, navItems, overallPercent, avgPages, minPages, maxPages, pageCounts };
  }, [sessions]);

  const hasData = analysis.templates.total > 0 || analysis.contentTypes.total > 0 || analysis.navItems.total > 0;
  if (!hasData) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">Not enough data to compute reusability yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero stat */}
      <div className="text-center py-8 rounded-xl border border-border bg-muted/20">
        <div className="text-6xl font-bold tracking-tight">{analysis.overallPercent}%</div>
        <div className="text-lg text-muted-foreground mt-2">Structural Similarity</div>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Based on shared templates, content types, and navigation patterns across {sessions.length} sites
        </p>
      </div>

      {/* Dimension breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DimensionCard
          icon={<Layers className="h-5 w-5" />}
          label="Templates"
          percent={analysis.templates.percent}
          shared={analysis.templates.shared}
          unique={analysis.templates.unique}
          total={analysis.templates.total}
        />
        <DimensionCard
          icon={<FileText className="h-5 w-5" />}
          label="Content Types"
          percent={analysis.contentTypes.percent}
          shared={analysis.contentTypes.shared}
          unique={analysis.contentTypes.unique}
          total={analysis.contentTypes.total}
        />
        <DimensionCard
          icon={<Navigation className="h-5 w-5" />}
          label="Navigation"
          percent={analysis.navItems.percent}
          shared={analysis.navItems.shared}
          unique={analysis.navItems.unique}
          total={analysis.navItems.total}
        />
      </div>

      {/* Page count stats */}
      {analysis.pageCounts.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-semibold">Page Volume</h4>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{analysis.avgPages}</div>
              <div className="text-xs text-muted-foreground">avg pages/site</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{analysis.minPages}</div>
              <div className="text-xs text-muted-foreground">smallest site</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{analysis.maxPages}</div>
              <div className="text-xs text-muted-foreground">largest site</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DimensionCard({ icon, label, percent, shared, unique, total }: {
  icon: React.ReactNode;
  label: string;
  percent: number;
  shared: number;
  unique: number;
  total: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium text-sm">{label}</span>
        </div>
        <span className="text-2xl font-bold">{percent}%</span>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{shared} shared</span>
        <span>{unique} unique</span>
        <span>{total} total</span>
      </div>
    </div>
  );
}
