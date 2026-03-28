import { useMemo, useState, useEffect, useCallback } from 'react';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import type { PageTagsMap } from '@/lib/pageTags';
import type { ContentTypesData } from '@/components/content-types/types';

type NavItem = { label: string; url?: string | null; children?: NavItem[] };
type NavStructure = { primary?: NavItem[]; secondary?: NavItem[]; footer?: NavItem[] } | null;

type TierKey = 'S' | 'M' | 'L';

interface Props {
  pageTags: PageTagsMap | null;
  contentTypesData: ContentTypesData | null;
  navStructure?: NavStructure;
  globalInnerExpand?: boolean | null;
  mode?: 'analysis' | 'estimate';
  onSelectionChange?: (count: number) => void;
}

/** Collect unique normalised URLs from top-level nav items */
function collectPrimaryUrls(items: NavItem[] | undefined): string[] {
  if (!items) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (item.url) {
      const norm = item.url.replace(/\/$/, '');
      if (!seen.has(norm)) { seen.add(norm); result.push(norm); }
    }
  }
  return result;
}

/** Collect unique normalised URLs from children of nav items */
function collectSecondaryUrls(items: NavItem[] | undefined): string[] {
  if (!items) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (item.children) {
      for (const child of item.children) {
        if (child.url) {
          const norm = child.url.replace(/\/$/, '');
          if (!seen.has(norm)) { seen.add(norm); result.push(norm); }
        }
      }
    }
  }
  return result;
}

function tierLabel(t: TierKey): string {
  return t === 'S' ? 'Small' : t === 'M' ? 'Medium' : 'Large';
}

/** Extract URL path from a full or relative URL */
function urlPath(url: string): string {
  try {
    const u = new URL(url, 'https://x.com');
    return u.pathname;
  } catch {
    return url;
  }
}

/* ── Analysis-mode sub-components ── */

function AnalysisView({
  totalPages,
  primaryPages,
  secondaryPages,
  tertiaryPages,
  baseTypeCounts,
  collapsedSections,
  toggleSection,
}: {
  totalPages: number;
  primaryPages: number;
  secondaryPages: number;
  tertiaryPages: number;
  baseTypeCounts: [string, number][];
  collapsedSections: Set<string>;
  toggleSection: (key: string) => void;
}) {
  const pageTypes = [
    { label: 'Primary', count: primaryPages, desc: 'Custom designed, top-level nav pages' },
    { label: 'Secondary', count: secondaryPages, desc: 'Sub-navigation pages off primary nav' },
    { label: 'Tertiary', count: tertiaryPages, desc: 'Supporting & footer-only pages' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <MetaStat value={totalPages} label="Detected Pages" />
        <MetaStatDivider />
        <MetaStat value={primaryPages} label="Primary" />
        <MetaStatDivider />
        <MetaStat value={secondaryPages} label="Secondary" />
        <MetaStatDivider />
        <MetaStat value={tertiaryPages} label="Tertiary" />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          <span className="flex-1 text-xs font-medium text-muted-foreground">Type</span>
          <span className="text-xs font-medium text-muted-foreground">Count</span>
        </div>

        {/* Page Types */}
        <button onClick={() => toggleSection('page-types')} className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left">
          {collapsedSections.has('page-types') ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="text-xs font-semibold text-foreground">Page Types</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{totalPages}</Badge>
        </button>
        {!collapsedSections.has('page-types') && (
          <div>
            {pageTypes.map((pt) => (
              <div key={pt.label} className="flex items-center px-3 py-1 border-t border-border/50 hover:bg-muted/20 transition-colors">
                <span className="text-xs font-mono leading-5 text-muted-foreground flex-1" title={pt.desc}>{pt.label}</span>
                <span className="text-xs text-muted-foreground font-mono">{pt.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Base Types */}
        <button onClick={() => toggleSection('base-types')} className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border">
          {collapsedSections.has('base-types') ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="text-xs font-semibold text-foreground">Base Types</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{totalPages}</Badge>
        </button>
        {!collapsedSections.has('base-types') && (
          <div>
            {baseTypeCounts.map(([type, count]) => (
              <div key={type} className="flex items-center px-3 py-1 border-t border-border/50 hover:bg-muted/20 transition-colors">
                <span className="text-xs font-mono leading-5 text-muted-foreground flex-1">{type === 'Archive' ? 'Taxonomy' : type}</span>
                <span className="text-xs text-muted-foreground font-mono">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Estimate-mode sub-components ── */

function PageGroupSection({
  label,
  urls,
  selectedUrls,
  collapsed,
  onToggleCollapse,
  onToggleUrl,
  onToggleAll,
}: {
  label: string;
  urls: string[];
  selectedUrls: Set<string>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleUrl: (url: string) => void;
  onToggleAll: (urls: string[], checked: boolean) => void;
}) {
  const checkedCount = urls.filter(u => selectedUrls.has(u)).length;

  return (
    <>
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border first:border-t-0"
      >
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        }
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
          {checkedCount}/{urls.length}
        </Badge>
      </button>
      {!collapsed && urls.length > 0 && (
        <div className="max-h-[140px] overflow-y-auto">
          {urls.map((url) => (
            <label
              key={url}
              className="flex items-center gap-2 px-3 py-1 border-t border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
            >
              <Checkbox
                checked={selectedUrls.has(url)}
                onCheckedChange={() => onToggleUrl(url)}
                className="h-3.5 w-3.5 shrink-0"
              />
              <span className="text-xs font-mono leading-5 text-muted-foreground truncate" title={url}>
                {urlPath(url)}
              </span>
            </label>
          ))}
        </div>
      )}
    </>
  );
}

/* ── Main component ── */

export function RedesignEstimateCard({ pageTags, contentTypesData, navStructure, globalInnerExpand = null, mode = 'analysis', onSelectionChange }: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [activeTier, setActiveTier] = useState<TierKey>('M');
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (globalInnerExpand === true) {
      setCollapsedSections(new Set());
    } else if (globalInnerExpand === false) {
      setCollapsedSections(new Set(['base-types', 'page-types', 'primary', 'secondary', 'tertiary']));
    }
  }, [globalInnerExpand]);

  const { baseTypeCounts, totalPages, integrablePages, primaryUrls, secondaryUrls, tertiaryUrls } = useMemo(() => {
    const counts: Record<string, number> = { Page: 0, Post: 0, CPT: 0, Archive: 0, Search: 0 };

    if (pageTags) {
      for (const [, tag] of Object.entries(pageTags)) {
        const bt = tag.baseType || 'Page';
        counts[bt] = (counts[bt] || 0) + 1;
      }
    }

    const total = pageTags ? Object.keys(pageTags).length : 0;
    const pUrls = collectPrimaryUrls(navStructure?.primary);
    const sUrls = collectSecondaryUrls(navStructure?.primary);

    // Tertiary = all pageTags URLs not in primary or secondary
    const primarySet = new Set(pUrls);
    const secondarySet = new Set(sUrls);
    const tUrls: string[] = [];
    if (pageTags) {
      for (const url of Object.keys(pageTags)) {
        const norm = url.replace(/\/$/, '');
        const tag = pageTags[url];
        if (!primarySet.has(norm) && !secondarySet.has(norm) && tag.baseType !== 'Post') {
          tUrls.push(norm);
        }
      }
    }

    const integrable = pUrls.length + sUrls.length + tUrls.length;

    return {
      baseTypeCounts: Object.entries(counts).filter(([, c]) => c > 0) as [string, number][],
      totalPages: total,
      integrablePages: integrable,
      primaryUrls: pUrls,
      secondaryUrls: sUrls,
      tertiaryUrls: tUrls,
    };
  }, [pageTags, navStructure]);

  // Initialize selected URLs based on default tier (M) on first data load
  useEffect(() => {
    if (mode !== 'estimate') return;
    const initial = new Set<string>([...primaryUrls, ...secondaryUrls]);
    setSelectedUrls(initial);
  }, [primaryUrls, secondaryUrls, mode]);

  // Apply tier preset when tier toggle changes
  const applyTier = useCallback((tier: TierKey) => {
    setActiveTier(tier);
    const next = new Set<string>();
    if (tier === 'S' || tier === 'M' || tier === 'L') {
      primaryUrls.forEach(u => next.add(u));
    }
    if (tier === 'M' || tier === 'L') {
      secondaryUrls.forEach(u => next.add(u));
    }
    if (tier === 'L') {
      tertiaryUrls.forEach(u => next.add(u));
    }
    setSelectedUrls(next);
  }, [primaryUrls, secondaryUrls, tertiaryUrls]);

  // Fire onSelectionChange when selection changes
  useEffect(() => {
    if (mode === 'estimate' && onSelectionChange) {
      onSelectionChange(selectedUrls.size);
    }
  }, [mode, selectedUrls, onSelectionChange]);

  if (!pageTags || Object.keys(pageTags).length === 0) {
    return <p className="text-sm text-muted-foreground">No page classification data available yet.</p>;
  }

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleUrl = (url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };

  const toggleAllInGroup = (urls: string[], checked: boolean) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      for (const u of urls) {
        if (checked) next.add(u); else next.delete(u);
      }
      return next;
    });
  };

  // Analysis mode — original view
  if (mode === 'analysis') {
    return (
      <AnalysisView
        totalPages={totalPages}
        primaryPages={primaryUrls.length}
        secondaryPages={secondaryUrls.length}
        tertiaryPages={tertiaryUrls.length}
        baseTypeCounts={baseTypeCounts}
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
      />
    );
  }

  // Estimate mode — checkboxes + tier toggles
  return (
    <div className="space-y-4">
      {/* Summary + Tier selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <MetaStat value={integrablePages} label="Detected Pages" />
        <MetaStatDivider />
        <MetaStat value={selectedUrls.size} label="Selected Pages" />
        <div className="ml-auto">
          <ToggleGroup
            type="single"
            value={activeTier}
            onValueChange={(v) => v && applyTier(v as TierKey)}
            size="sm"
            variant="outline"
          >
            {(['S', 'M', 'L'] as TierKey[]).map(tier => {
              const count = tier === 'S' ? primaryUrls.length
                : tier === 'M' ? primaryUrls.length + secondaryUrls.length
                : primaryUrls.length + secondaryUrls.length + tertiaryUrls.length;
              return (
                <ToggleGroupItem key={tier} value={tier} className="text-xs px-2.5 h-7">
                  {tierLabel(tier)} · {count}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
      </div>

      {/* Page groups with checkboxes */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <PageGroupSection
          label="Primary"
          urls={primaryUrls}
          selectedUrls={selectedUrls}
          collapsed={collapsedSections.has('primary')}
          onToggleCollapse={() => toggleSection('primary')}
          onToggleUrl={toggleUrl}
          onToggleAll={toggleAllInGroup}
        />
        <PageGroupSection
          label="Secondary"
          urls={secondaryUrls}
          selectedUrls={selectedUrls}
          collapsed={collapsedSections.has('secondary')}
          onToggleCollapse={() => toggleSection('secondary')}
          onToggleUrl={toggleUrl}
          onToggleAll={toggleAllInGroup}
        />
        <PageGroupSection
          label="Tertiary"
          urls={tertiaryUrls}
          selectedUrls={selectedUrls}
          collapsed={collapsedSections.has('tertiary')}
          onToggleCollapse={() => toggleSection('tertiary')}
          onToggleUrl={toggleUrl}
          onToggleAll={toggleAllInGroup}
        />
      </div>
    </div>
  );
}
