import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { PageTagsMap } from '@/lib/pageTags';
import { normalizeTagKey, getTemplateCategory } from '@/lib/pageTags';
import type { ContentTypesData } from '@/components/content-types/types';

const TIER_SIZES = { S: 5, M: 10, L: 15, All: Infinity } as const;
type TierKey = keyof typeof TIER_SIZES;

const baseTypeColors: Record<string, string> = {
  Page: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Post: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CPT: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Archive: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

// Priority order for sorting templates: Page first (custom pages are most important for redesign),
// then Archive (list pages), then Post/CPT (repeating), then Search/toolkit last.
const baseTypePriority: Record<string, number> = {
  Page: 0,
  Archive: 1,
  CPT: 2,
  Post: 3,
  Search: 4,
};

interface NavItem {
  label: string;
  url?: string | null;
  children?: NavItem[];
}

interface Props {
  pageTags: PageTagsMap | null;
  contentTypesData: ContentTypesData | null;
  navStructure: { primary?: NavItem[]; secondary?: NavItem[]; footer?: NavItem[] } | null;
}

/** Collect all URLs from a nav tree */
function collectNavUrls(items: NavItem[] | undefined): Set<string> {
  const urls = new Set<string>();
  if (!items) return urls;
  for (const item of items) {
    if (item.url) urls.add(normalizeTagKey(item.url));
    if (item.children) {
      for (const u of collectNavUrls(item.children)) urls.add(u);
    }
  }
  return urls;
}

function TableSection({ title, columns, colAligns, rows }: {
  title: string;
  columns: string[];
  colAligns?: ('left' | 'center' | 'right')[];
  rows: { cells: React.ReactNode[] }[];
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-muted/50 text-left">
              {columns.map((col, i) => {
                const align = colAligns?.[i] || (i > 0 ? 'right' : 'left');
                return (
                  <th key={col} className={`px-3 py-2 font-medium text-muted-foreground ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>{col}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                {row.cells.map((cell, j) => {
                  const align = colAligns?.[j] || (j > 0 ? 'right' : 'left');
                  return (
                    <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>{cell}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RedesignEstimateCard({ pageTags, contentTypesData, navStructure }: Props) {
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [seeded, setSeeded] = useState(false);
  const [activeTier, setActiveTier] = useState<TierKey | null>(null);

  const { baseTypeCounts, templates, contentTypes, totalTemplates } = useMemo(() => {
    const counts: Record<string, number> = { Page: 0, Post: 0, CPT: 0, Archive: 0, Search: 0 };
    const templateMap: Record<string, { count: number; baseType?: string; urls: string[] }> = {};

    if (pageTags) {
      for (const [url, tag] of Object.entries(pageTags)) {
        const bt = tag.baseType || 'Page';
        counts[bt] = (counts[bt] || 0) + 1;
        const tmpl = tag.template || 'Unknown';
        if (!templateMap[tmpl]) {
          templateMap[tmpl] = { count: 0, baseType: bt, urls: [] };
        }
        templateMap[tmpl].count++;
        templateMap[tmpl].urls.push(url);
      }
    }

    // Collect nav URLs by section
    const primaryNavUrls = collectNavUrls(navStructure?.primary);
    const secondaryNavUrls = collectNavUrls(navStructure?.secondary);
    const footerNavUrls = collectNavUrls(navStructure?.footer);

    const getNavSection = (urls: string[]): 'Primary' | 'Secondary' | 'Footer' | null => {
      for (const u of urls) {
        const key = normalizeTagKey(u);
        if (primaryNavUrls.has(key)) return 'Primary';
      }
      for (const u of urls) {
        const key = normalizeTagKey(u);
        if (secondaryNavUrls.has(key)) return 'Secondary';
      }
      for (const u of urls) {
        const key = normalizeTagKey(u);
        if (footerNavUrls.has(key)) return 'Footer';
      }
      return null;
    };

    const navPriority: Record<string, number> = { Primary: 0, Secondary: 1, Footer: 2 };

    // Sort by base type first (Page → Archive → CPT → Post → Search), then nav section, then count
    const sortedTemplates = Object.entries(templateMap)
      .map(([name, data]) => {
        const navSection = getNavSection(data.urls);
        return { name, ...data, navSection };
      })
      .sort((a, b) => {
        // Homepage always first
        if (a.name === 'Homepage') return -1;
        if (b.name === 'Homepage') return 1;
        // Base type priority first
        const pa = baseTypePriority[a.baseType || 'Page'] ?? 5;
        const pb = baseTypePriority[b.baseType || 'Page'] ?? 5;
        if (pa !== pb) return pa - pb;
        // Then by nav section
        const na = a.navSection ? navPriority[a.navSection] ?? 3 : 4;
        const nb = b.navSection ? navPriority[b.navSection] ?? 3 : 4;
        if (na !== nb) return na - nb;
        // Then by count desc
        return b.count - a.count;
      });

    // Content types: only Post and CPT
    const ctList: { type: string; count: number; baseType?: string }[] = [];
    if (contentTypesData?.summary) {
      for (const s of contentTypesData.summary) {
        if (s.baseType === 'Post' || s.baseType === 'CPT') {
          ctList.push({ type: s.type, count: s.count, baseType: s.baseType });
        }
      }
    }

    return {
      baseTypeCounts: Object.entries(counts).filter(([, c]) => c > 0),
      templates: sortedTemplates,
      contentTypes: ctList,
      totalTemplates: sortedTemplates.length,
    };
  }, [pageTags, contentTypesData, navStructure]);

  // Auto-seed excluded set from toolkit templates on first data load
  if (!seeded && templates.length > 0) {
    const toolkitNames = new Set(
      templates.filter(t => getTemplateCategory(t.name) === 'toolkit').map(t => t.name)
    );
    if (toolkitNames.size > 0) setExcluded(toolkitNames);
    setSeeded(true);
  }

  const toggleExcluded = (name: string) => {
    setActiveTier(null); // manual override clears tier
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const applyTier = (tier: TierKey) => {
    if (activeTier === tier) {
      setActiveTier(null);
      return;
    }
    setActiveTier(tier);
    const limit = TIER_SIZES[tier];
    const newExcluded = new Set<string>();
    templates.forEach((t, i) => {
      if (i >= limit) newExcluded.add(t.name);
    });
    setExcluded(newExcluded);
  };

  if (!pageTags || Object.keys(pageTags).length === 0) {
    return <p className="text-sm text-muted-foreground">No page classification data available yet. Run URL Discovery and Content Types first.</p>;
  }

  const totalPages = Object.keys(pageTags).length;
  const designCount = templates.filter(t => !excluded.has(t.name)).length;
  const blockBuiltCount = totalTemplates - designCount;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl font-bold text-foreground">{totalTemplates}</span>
        <span className="text-sm text-muted-foreground">unique templates</span>
        <span className="text-sm text-muted-foreground">·</span>
        <span className="text-2xl font-bold text-foreground">{designCount}</span>
        <span className="text-sm text-muted-foreground">custom design</span>
        <span className="text-sm text-muted-foreground">·</span>
        <span className="text-lg font-semibold text-muted-foreground">{blockBuiltCount}</span>
        <span className="text-sm text-muted-foreground">block-built</span>
        <span className="text-sm text-muted-foreground">·</span>
        <span className="text-2xl font-bold text-foreground">{totalPages}</span>
        <span className="text-sm text-muted-foreground">URLs</span>
      </div>

      {/* Level 1 — Base Types */}
      <TableSection
        title="Level 1 — Base Types"
        columns={['Type', 'In Nav', 'URLs']}
        colAligns={['left', 'center', 'right']}
        rows={baseTypeCounts.map(([type, count]) => ({
          cells: [type, '', count],
        }))}
      />

      {/* Level 2 — Unique Templates */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {`Level 2 — Unique Templates (${totalTemplates})`}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Preset:</span>
            <ToggleGroup type="single" value={activeTier ?? ''} onValueChange={(v) => v && applyTier(v as TierKey)} size="sm" variant="outline">
              {(Object.keys(TIER_SIZES) as TierKey[]).map(tier => (
                <ToggleGroupItem key={tier} value={tier} className="text-xs px-2.5 h-7">
                  {tier === 'All' ? 'All' : `${tier} (${TIER_SIZES[tier]})`}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground w-10 text-center">Design</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-left">Template</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-center">Type</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-center">Nav</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">URLs</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t, i) => {
                const isExcluded = excluded.has(t.name);
                return (
                  <tr key={i} className={`border-t border-border transition-colors ${isExcluded ? 'opacity-50' : 'hover:bg-muted/30'}`}>
                    <td className="px-3 py-1.5 text-center">
                      <Checkbox
                        checked={!isExcluded}
                        onCheckedChange={() => toggleExcluded(t.name)}
                        className="mx-auto"
                      />
                    </td>
                    <td className={`px-3 py-1.5 font-medium text-foreground ${isExcluded ? 'line-through' : ''}`}>{t.name}</td>
                    <td className="px-3 py-1.5 text-center text-muted-foreground">
                      {t.baseType ? <Badge variant="outline" className={`${baseTypeColors[t.baseType] || ''} text-[10px] px-1.5 py-0`}>{t.baseType}</Badge> : null}
                    </td>
                    <td className="px-3 py-1.5 text-center text-muted-foreground">
                      {t.navSection ? <span className="text-xs">{t.navSection}</span> : null}
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{t.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Level 3 — Repeating Content Types (Post & CPT only) */}
      {contentTypes.length > 0 && (
        <TableSection
          title={`Level 3 — Repeating Content (${contentTypes.length})`}
          columns={['Content Type', 'Type', 'In Nav', 'URLs']}
          colAligns={['left', 'center', 'center', 'right']}
          rows={contentTypes.map((ct) => ({
            cells: [
              ct.type,
              ct.baseType ? <Badge variant="outline" className={`${baseTypeColors[ct.baseType] || ''} text-[10px] px-1.5 py-0`}>{ct.baseType}</Badge> : null,
              '',
              ct.count,
            ],
          }))}
        />
      )}
    </div>
  );
}
