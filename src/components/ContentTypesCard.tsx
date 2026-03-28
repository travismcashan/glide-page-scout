import { useState, useMemo, useEffect } from 'react';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronDown, ChevronRight, Merge, ChevronsUpDown } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConfidenceBadge, SourceBadge } from '@/components/content-types/ConfidenceBadge';
import { ExpandableUrlRows, type NavTag } from '@/components/content-types/ExpandableUrlRows';
import type { ContentTypesData, ClassifiedUrl, BaseType } from '@/components/content-types/types';
import { rebuildSummary } from '@/components/content-types/types';
import { PageTemplateBadge } from '@/components/PageTemplateBadge';
import { getPageTag, normalizeTagKey, type PageTagsMap, type PageTag } from '@/lib/pageTags';

export { type ContentTypesData } from '@/components/content-types/types';

type NavItem = { label: string; url?: string | null; children?: NavItem[] };
type NavStructureData = { primary?: NavItem[]; secondary?: NavItem[]; footer?: NavItem[]; items?: NavItem[] } | null;

const baseTypeStyles: Record<BaseType, string> = {
  Page: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Post: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CPT: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Archive: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

function buildNavMap(nav: NavStructureData): Map<string, NavTag[]> {
  const map = new Map<string, NavTag[]>();
  if (!nav) return map;
  const walk = (items: NavItem[] | undefined, type: 'primary' | 'secondary' | 'footer') => {
    if (!items) return;
    for (const item of items) {
      if (item.url) {
        const key = item.url.toLowerCase().replace(/\/$/, '');
        const existing = map.get(key) || [];
        existing.push({ type, label: item.label });
        map.set(key, existing);
      }
      if (item.children) walk(item.children, type);
    }
  };
  walk(nav.primary, 'primary');
  walk(nav.secondary, 'secondary');
  walk(nav.footer, 'footer');
  return map;
}

type BulkTier = 'S' | 'M' | 'L';

export function ContentTypesCard({ data, onDataChange, navStructure, pageTags, onPageTagChange, globalInnerExpand = null, mode = 'analysis', onTierChange }: { data: ContentTypesData; onDataChange?: (data: ContentTypesData) => void; navStructure?: NavStructureData; pageTags?: PageTagsMap | null; onPageTagChange?: (url: string, template: string) => void; globalInnerExpand?: boolean | null; mode?: 'analysis' | 'estimate'; onTierChange?: (tier: BulkTier, includedTypes: number, totalUrls: number) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [activeTier, setActiveTier] = useState<BulkTier | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['not-included']));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const isEstimate = mode === 'estimate';

  const { summary: rawSummary, stats } = data || { summary: [], stats: { total: 0, bySource: {}, uniqueTypes: 0, ambiguousScanned: 0 } };
  const classified = data?.classified || [];
  const navMap = useMemo(() => buildNavMap(navStructure ?? null), [navStructure]);

  // Enrich summary with pageTags: URLs classified as "Uncategorized" Page in content_types
  // but tagged as Post/CPT in pageTags should be reassigned to their correct group.
  const allSummary = useMemo(() => {
    if (!pageTags || !rawSummary.length) return rawSummary;

    // Build a lookup of pageTags by normalized URL
    const tagLookup = new Map<string, PageTag>();
    for (const [url, tag] of Object.entries(pageTags)) {
      tagLookup.set(normalizeTagKey(url), tag);
    }

    // Find the "Uncategorized" group and any URLs in it that pageTags says are Post/CPT
    const uncatGroup = rawSummary.find(s => s.type === 'Uncategorized' && s.baseType === 'Page');
    if (!uncatGroup) return rawSummary;

    // Collect URLs that need to be reassigned
    const reassign: Record<string, { urls: string[]; baseType: BaseType; cptName?: string }> = {};
    const remainingUncatUrls: string[] = [];

    for (const url of uncatGroup.urls) {
      const key = normalizeTagKey(url);
      const tag = tagLookup.get(key);
      if (tag && (tag.baseType === 'Post' || tag.baseType === 'CPT')) {
        // Derive a content type name: prefer contentType, then cptName, then template-based fallback
        const ct = tag.contentType || tag.cptName || (tag.baseType === 'Post' ? 'Blog Post' : tag.template || 'Unknown');
        if (!reassign[ct]) reassign[ct] = { urls: [], baseType: tag.baseType, cptName: tag.cptName };
        reassign[ct].urls.push(url);
      } else {
        remainingUncatUrls.push(url);
      }
    }

    if (Object.keys(reassign).length === 0) return rawSummary;

    // Rebuild summary: merge reassigned URLs into existing groups.
    // First try exact type match, then fall back to matching by baseType (e.g. Post→Post).
    const newSummary = rawSummary
      .filter(s => s !== uncatGroup)
      .map(s => {
        // Exact name match
        const exactMatch = reassign[s.type];
        if (exactMatch) {
          const merged = {
            ...s,
            urls: [...s.urls, ...exactMatch.urls],
            count: s.count + exactMatch.urls.length,
            totalUrls: s.totalUrls + exactMatch.urls.length,
          };
          delete reassign[s.type];
          return merged;
        }
        // baseType match: merge Post-tagged URLs into existing Post group, etc.
        for (const [ct, info] of Object.entries(reassign)) {
          if (s.baseType === info.baseType && s.baseType !== 'Page') {
            const merged = {
              ...s,
              urls: [...s.urls, ...info.urls],
              count: s.count + info.urls.length,
              totalUrls: s.totalUrls + info.urls.length,
            };
            delete reassign[ct];
            return merged;
          }
        }
        return s;
      });

    // Add any remaining reassigned groups as new entries
    for (const [type, info] of Object.entries(reassign)) {
      newSummary.push({
        type,
        count: info.urls.length,
        urls: info.urls,
        totalUrls: info.urls.length,
        confidence: { high: 0, medium: info.urls.length, low: 0 },
        baseType: info.baseType,
        cptName: info.cptName,
      });
    }

    // Add back remaining uncategorized if any
    if (remainingUncatUrls.length > 0) {
      newSummary.push({
        ...uncatGroup,
        urls: remainingUncatUrls,
        count: remainingUncatUrls.length,
        totalUrls: remainingUncatUrls.length,
      });
    }

    return newSummary.sort((a, b) => b.count - a.count);
  }, [rawSummary, pageTags]);

  // Level 3 filter: only show Post + CPT (repeating content), Posts first
  const summary = useMemo(() => {
    return allSummary
      .filter(s => {
        if (s.baseType === 'Post' || s.baseType === 'CPT') return true;
        if (!s.baseType && s.type !== 'Uncategorized' && s.count >= 3) return true;
        return false;
      })
      .sort((a, b) => {
        // Posts before CPTs, then by count
        const order = { Post: 0, CPT: 1 };
        const oa = order[a.baseType as keyof typeof order] ?? 2;
        const ob = order[b.baseType as keyof typeof order] ?? 2;
        if (oa !== ob) return oa - ob;
        return b.count - a.count;
      });
  }, [allSummary]);

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() => new Set(summary.map(s => s.type)));

  // Keep all sections expanded when summary changes (new items added after pageTags load)
  useEffect(() => {
    if (globalInnerExpand === false) return; // respect explicit collapse
    setExpandedTypes(new Set(summary.map(s => s.type)));
  }, [summary]);

  useEffect(() => {
    if (globalInnerExpand === true) {
      setExpandedTypes(new Set(summary.map(s => s.type)));
    } else if (globalInnerExpand === false) {
      setExpandedTypes(new Set());
    }
  }, [globalInnerExpand]);

  const allTypes = useMemo(() => allSummary.map(s => s.type), [allSummary]);

  const urlsByType = useMemo(() => {
    const map: Record<string, ClassifiedUrl[]> = {};
    for (const c of classified) {
      if (!map[c.contentType]) map[c.contentType] = [];
      map[c.contentType].push(c);
    }
    return map;
  }, [classified]);

  const repeatingCount = summary.reduce((acc, s) => acc + s.count, 0);

  // Tier logic for estimate mode
  const postTypes = useMemo(() => summary.filter(s => s.baseType === 'Post'), [summary]);
  const cptTypes = useMemo(() => summary.filter(s => s.baseType === 'CPT'), [summary]);

  const tierIncluded = useMemo((): Set<string> => {
    if (!activeTier) return new Set(summary.map(s => s.type));
    if (activeTier === 'S') return new Set();
    if (activeTier === 'M') return new Set(postTypes.map(s => s.type));
    return new Set([...postTypes, ...cptTypes].map(s => s.type));
  }, [activeTier, postTypes, cptTypes, summary]);

  const tierCounts = useMemo(() => ({
    S: { types: 0, urls: 0 },
    M: { types: postTypes.length, urls: postTypes.reduce((a, s) => a + s.count, 0) },
    L: { types: postTypes.length + cptTypes.length, urls: [...postTypes, ...cptTypes].reduce((a, s) => a + s.count, 0) },
  }), [postTypes, cptTypes]);

  // Auto-select default tier in estimate mode
  useEffect(() => {
    if (isEstimate && !activeTier && summary.length > 0) {
      const defaultTier = cptTypes.length > 0 ? 'L' : postTypes.length > 0 ? 'M' : 'S';
      setActiveTier(defaultTier);
    }
  }, [isEstimate, summary]);

  // Notify parent when tier changes
  useEffect(() => {
    if (isEstimate && activeTier && onTierChange) {
      const tc = tierCounts[activeTier];
      onTierChange(activeTier, tc.types, tc.urls);
    }
  }, [activeTier, tierCounts, isEstimate]);

  const includedRows = useMemo(() => summary.filter(s => tierIncluded.has(s.type)), [summary, tierIncluded]);
  const excludedRows = useMemo(() => summary.filter(s => !tierIncluded.has(s.type)), [summary, tierIncluded]);

  if (!data?.summary?.length) {
    return <p className="text-sm text-muted-foreground">No content types detected.</p>;
  }

  if (summary.length === 0) {
    return <p className="text-sm text-muted-foreground">No bulk content (Posts or CPTs) detected. All URLs appear to be one-off pages.</p>;
  }

  const toggleSelect = (type: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const handleRename = (oldType: string) => {
    const newName = editValue.trim();
    if (!newName || newName === oldType || !onDataChange) { setEditingType(null); return; }
    const newClassified = classified.map(c => c.contentType === oldType ? { ...c, contentType: newName } : c);
    const newSummary = rebuildSummary(newClassified);
    onDataChange({ ...data, summary: newSummary, classified: newClassified, stats: { ...stats, uniqueTypes: newSummary.length } });
    setEditingType(null);
    if (expandedTypes.has(oldType)) {
      setExpandedTypes(prev => { const next = new Set(prev); next.delete(oldType); next.add(newName); return next; });
    }
  };

  const handleChangeUrlType = (url: string, newType: string) => {
    if (!onDataChange) return;
    const newClassified = classified.map(c => c.url === url ? { ...c, contentType: newType } : c);
    const newSummary = rebuildSummary(newClassified);
    onDataChange({ ...data, summary: newSummary, classified: newClassified, stats: { ...stats, uniqueTypes: newSummary.length } });
  };

  const handleMerge = () => {
    if (!mergeName.trim() || selected.size < 2 || !onDataChange) return;
    const selectedTypes = Array.from(selected);
    const newClassified = classified.map(c =>
      selectedTypes.includes(c.contentType) ? { ...c, contentType: mergeName.trim() } : c
    );
    const newSummary = rebuildSummary(newClassified);
    onDataChange({ ...data, summary: newSummary, classified: newClassified, stats: { ...stats, uniqueTypes: newSummary.length } });
    setSelected(new Set());
    setMergeName('');
    setMergeOpen(false);
    setMergeMode(false);
  };

  const openMergeDialog = () => {
    const selectedTypes = Array.from(selected);
    const largest = summary.filter(r => selectedTypes.includes(r.type)).sort((a, b) => b.count - a.count)[0];
    setMergeName(largest?.type || '');
    setMergeOpen(true);
  };

  const tierLabel = (tier: BulkTier) => {
    if (tier === 'S') return 'Small · 0 types';
    if (tier === 'M') return 'Medium · Posts';
    return 'Large · Posts + CPT';
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const renderContentRow = (row: typeof summary[number], isIncluded: boolean) => {
    const isExpanded = expandedTypes.has(row.type);
    const typeUrls = urlsByType[row.type] || [];
    const hasClassified = typeUrls.length > 0;
    const fallbackUrls: ClassifiedUrl[] = !hasClassified
      ? row.urls.map(u => ({ url: u, contentType: row.type, confidence: 'medium' as const, source: '', baseType: row.baseType }))
      : [];
    const displayUrls = hasClassified ? typeUrls : fallbackUrls;

    return (
      <div key={row.type} className={`${selected.has(row.type) ? 'bg-primary/5' : ''} ${!isIncluded && isEstimate ? 'opacity-50' : ''}`}>
        <button
          className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors text-left border-t border-border first:border-t-0"
          onClick={() => setExpandedTypes(prev => { const next = new Set(prev); if (isExpanded) next.delete(row.type); else next.add(row.type); return next; })}
        >
          {mergeMode && !isEstimate && (
            <Checkbox
              checked={selected.has(row.type)}
              onCheckedChange={() => toggleSelect(row.type)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          }
          <span
            className={`text-xs font-semibold text-foreground ${onDataChange ? 'hover:text-primary hover:underline' : ''}`}
            onClick={(e) => {
              if (!onDataChange) return;
              e.stopPropagation();
              setEditingType(row.type);
              setEditValue(row.type);
            }}
          >
            {editingType === row.type ? (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleRename(row.type)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(row.type);
                  if (e.key === 'Escape') setEditingType(null);
                }}
                className="h-6 text-xs px-1.5 py-0 w-40"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : `${row.type}${row.baseType ? ` (${row.baseType === 'Archive' ? 'Taxonomy' : row.baseType === 'Search' ? 'Search — i.e. query strings' : row.baseType})` : ''}`}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{row.count}</Badge>
        </button>

        {isExpanded && (
          <div>
            <ExpandableUrlRows
              urls={displayUrls}
              allTypes={allTypes}
              onChangeType={onDataChange ? handleChangeUrlType : undefined}
              readOnly={!onDataChange}
              navMap={navMap}
              pageTags={pageTags}
              onPageTagChange={onPageTagChange}
              showCheckbox={isEstimate}
              isIncluded={isIncluded}
            />
          </div>
        )}
      </div>
    );
  };

  const renderShowMore = (sectionKey: string, items: typeof summary) => {
    const LIMIT = 5;
    const isExpanded = expandedSections.has(sectionKey);
    const hasMore = items.length > LIMIT;
    const visible = isExpanded ? items : items.slice(0, LIMIT);
    const isIncluded = sectionKey === 'included';
    return (
      <>
        {visible.map(row => renderContentRow(row, isIncluded))}
        {hasMore && (
          <div className="relative">
            {!isExpanded && (
              <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
            )}
            <button
              onClick={() => setExpandedSections(prev => {
                const next = new Set(prev);
                if (next.has(sectionKey)) next.delete(sectionKey); else next.add(sectionKey);
                return next;
              })}
              className="w-full flex items-center justify-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronsUpDown className="h-3 w-3" />
              {isExpanded ? 'Show less' : `Show all ${items.length}`}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <MetaStat value={summary.length} label="Detected Types" />
          {isEstimate && activeTier && (
            <>
              <MetaStatDivider />
              <MetaStat value={tierCounts[activeTier].types} label="Selected Types" />
              <MetaStatDivider />
              <MetaStat value={tierCounts[activeTier].urls} label="Selected # of Pages" />
            </>
          )}
          {!isEstimate && (
            <>
              <MetaStatDivider />
              <MetaStat value={repeatingCount} label="Selected # of Pages" />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEstimate && (
            <ToggleGroup type="single" value={activeTier ?? ''} onValueChange={(v) => v && setActiveTier(v as BulkTier)} size="sm" variant="outline">
              {(['S', 'M', 'L'] as BulkTier[]).map(tier => (
                <ToggleGroupItem key={tier} value={tier} className="text-xs px-2.5 h-7">
                  {tierLabel(tier)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          {onDataChange && !isEstimate && (
            <Button
              variant={mergeMode ? 'secondary' : 'outline'}
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => { setMergeMode(!mergeMode); if (mergeMode) setSelected(new Set()); }}
            >
              <Merge className="h-3 w-3" />
              {mergeMode ? 'Cancel' : 'Merge Types'}
            </Button>
          )}
        </div>
      </div>

      {/* Merge action bar */}
      {mergeMode && selected.size >= 2 && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border text-xs">
          <span className="text-muted-foreground">{selected.size} types selected</span>
          <Button size="sm" className="text-xs h-6 gap-1" onClick={openMergeDialog}>
            <Merge className="h-3 w-3" /> Merge Selected
          </Button>
        </div>
      )}

      {/* Content rows */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          {isEstimate && <span className="w-6 shrink-0" />}
          <span className="flex-1 text-xs font-medium text-muted-foreground">URL</span>
          <span className="w-[70px] text-center text-xs font-medium text-muted-foreground">Type</span>
          <span className="w-[120px] text-center text-xs font-medium text-muted-foreground">Template</span>
        </div>

        {summary.map(row => renderContentRow(row, tierIncluded.has(row.type)))}
      </div>

      {/* Tier reasoning */}
      {isEstimate && activeTier && (
        <div className="space-y-1 border-l-2 border-primary/30 pl-3">
          <p className="text-xs text-muted-foreground">
            {activeTier === 'S' && 'No bulk content migration — all posts and custom post types will be excluded from the estimate.'}
            {activeTier === 'M' && `Blog posts included for migration (${tierCounts.M.urls} URLs across ${tierCounts.M.types} type${tierCounts.M.types !== 1 ? 's' : ''}). Custom post types are excluded.`}
            {activeTier === 'L' && `All bulk content included — blog posts and custom post types (${tierCounts.L.urls} URLs across ${tierCounts.L.types} type${tierCounts.L.types !== 1 ? 's' : ''}).`}
          </p>
        </div>
      )}

      {/* How content types were identified */}
      {!isEstimate && Object.values(stats.bySource).some(c => c > 0) && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span>How content types were identified:</span>
          {Object.entries(stats.bySource)
            .filter(([, count]) => count > 0)
            .map(([source, count]) => (
              <span key={source} className="flex items-center gap-1">
                <SourceBadge source={source} />
                <span className="text-[10px] text-muted-foreground">{count}</span>
              </span>
            ))}
        </div>
      )}

      {/* Merge dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Content Types</DialogTitle>
            <DialogDescription>
              Combine {selected.size} types into one. Choose a name for the merged type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selected).map(t => (
                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
            <Input
              placeholder="Merged type name"
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMerge()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button onClick={handleMerge} disabled={!mergeName.trim()}>Merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
