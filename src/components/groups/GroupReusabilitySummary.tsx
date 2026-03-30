import { useMemo, useState } from 'react';
import { Layers, Navigation, FileText, BarChart3 } from 'lucide-react';

type SessionData = { id: string; domain: string; [key: string]: any };
type Props = { sessions: SessionData[] };

function computeOverlap(
  sessions: SessionData[],
  extractor: (session: any) => string[],
  minSites: number = 1,
): { shared: number; unique: number; total: number; included: number; percent: number } {
  const sessionsWithData = sessions.filter(s => {
    try { return extractor(s).length > 0; } catch { return false; }
  });
  if (sessionsWithData.length < 2) return { shared: 0, unique: 0, total: 0, included: 0, percent: 0 };

  const itemSites = new Map<string, Set<string>>();
  for (const s of sessionsWithData) {
    for (const item of extractor(s)) {
      const key = item.toLowerCase().trim();
      if (!key) continue;
      if (!itemSites.has(key)) itemSites.set(key, new Set());
      itemSites.get(key)!.add(s.id);
    }
  }

  // Filter to items appearing on at least minSites
  const filtered = Array.from(itemSites.entries()).filter(([, sites]) => sites.size >= minSites);
  const total = itemSites.size;
  const included = filtered.length;
  const shared = filtered.filter(([, s]) => s.size === sessionsWithData.length).length;
  const unique = Array.from(itemSites.values()).filter(s => s.size === 1).length;

  // Weighted reusability based on filtered items only
  let totalWeight = 0;
  let sharedWeight = 0;
  for (const [, sites] of filtered) {
    totalWeight += sessionsWithData.length;
    sharedWeight += sites.size;
  }
  const percent = totalWeight > 0 ? Math.round((sharedWeight / totalWeight) * 100) : 0;

  return { shared, unique, total, included, percent };
}

export function GroupReusabilitySummary({ sessions }: Props) {
  const [minSites, setMinSites] = useState(2); // Default: exclude unique items
  const siteCount = sessions.filter(s => s.page_tags || s.content_types_data || s.nav_structure).length;

  const templateExtractor = (s: any) => {
    const tags = s.page_tags;
    if (!tags || typeof tags !== 'object') return [];
    return [...new Set(Object.values(tags).map((t: any) => t.template).filter(Boolean))];
  };
  const contentExtractor = (s: any) => {
    const ct = s.content_types_data;
    if (!ct?.classified) return [];
    return [...new Set(ct.classified.map((c: any) => c.contentType).filter(Boolean))];
  };
  const navExtractor = (s: any) => {
    const nav = s.nav_structure;
    if (!nav?.primary) return [];
    return nav.primary.map((item: any) => item.label).filter(Boolean);
  };

  const analysis = useMemo(() => {
    const templates = computeOverlap(sessions, templateExtractor, minSites);
    const contentTypes = computeOverlap(sessions, contentExtractor, minSites);
    const navItems = computeOverlap(sessions, navExtractor, minSites);

    const overallPercent = Math.round(
      (templates.percent * 0.4 + contentTypes.percent * 0.35 + navItems.percent * 0.25)
    );

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
  }, [sessions, minSites]);

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
          Items appearing on {minSites}+ of {siteCount} sites
        </p>
        {/* Threshold control */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <span className="text-xs text-muted-foreground">Min sites:</span>
          {[1, 2, 3, 5, Math.ceil(siteCount / 2), siteCount].filter((v, i, a) => v > 0 && v <= siteCount && a.indexOf(v) === i).map(n => (
            <button
              key={n}
              onClick={() => setMinSites(n)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                minSites === n
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {n === siteCount ? 'All' : `${n}+`}
            </button>
          ))}
        </div>
      </div>

      {/* Dimension breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DimensionCard
          icon={<Layers className="h-5 w-5" />}
          label="Templates"
          percent={analysis.templates.percent}
          shared={analysis.templates.shared}
          included={analysis.templates.included}
          total={analysis.templates.total}
        />
        <DimensionCard
          icon={<FileText className="h-5 w-5" />}
          label="Content Types"
          percent={analysis.contentTypes.percent}
          shared={analysis.contentTypes.shared}
          included={analysis.contentTypes.included}
          total={analysis.contentTypes.total}
        />
        <DimensionCard
          icon={<Navigation className="h-5 w-5" />}
          label="Navigation"
          percent={analysis.navItems.percent}
          shared={analysis.navItems.shared}
          included={analysis.navItems.included}
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

function DimensionCard({ icon, label, percent, shared, included, total }: {
  icon: React.ReactNode;
  label: string;
  percent: number;
  shared: number;
  included: number;
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
        <span>{shared} universal</span>
        <span>{included} included</span>
        <span>{total} total</span>
      </div>
    </div>
  );
}
