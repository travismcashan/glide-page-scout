import { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, Merge } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConfidenceBadge, SourceBadge } from '@/components/content-types/ConfidenceBadge';
import { ExpandableUrlRows, type NavTag } from '@/components/content-types/ExpandableUrlRows';
import type { ContentTypesData, ClassifiedUrl, BaseType } from '@/components/content-types/types';
import { rebuildSummary } from '@/components/content-types/types';
import { PageTemplateBadge } from '@/components/PageTemplateBadge';
import { getPageTag, type PageTagsMap } from '@/lib/pageTags';

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

export function ContentTypesCard({ data, onDataChange, navStructure, pageTags, onPageTagChange, globalInnerExpand = null }: { data: ContentTypesData; onDataChange?: (data: ContentTypesData) => void; navStructure?: NavStructureData; pageTags?: PageTagsMap | null; onPageTagChange?: (url: string, template: string) => void; globalInnerExpand?: boolean | null }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { summary: allSummary, stats } = data || { summary: [], stats: { total: 0, bySource: {}, uniqueTypes: 0, ambiguousScanned: 0 } };
  const classified = data?.classified || [];
  const navMap = useMemo(() => buildNavMap(navStructure ?? null), [navStructure]);

  // Level 3 filter: only show Post + CPT (repeating content)
  const summary = useMemo(() => {
    return allSummary.filter(s => {
      if (s.baseType === 'Post' || s.baseType === 'CPT') return true;
      // Fallback for legacy data without baseType — keep non-Uncategorized items that have 3+ URLs
      if (!s.baseType && s.type !== 'Uncategorized' && s.count >= 3) return true;
      return false;
    });
  }, [allSummary]);

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() => new Set(summary.slice(0, 5).map(s => s.type) || []));

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

  if (!data?.summary?.length) {
    return <p className="text-sm text-muted-foreground">No content types detected.</p>;
  }

  if (summary.length === 0) {
    return <p className="text-sm text-muted-foreground">No repeating content (Posts or CPTs) detected. All URLs appear to be one-off pages.</p>;
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

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <MetaStat value={repeatingCount} label="Repeating URLs" />
          <MetaStatDivider />
          <MetaStat value={summary.length} label="Content Types" />
          <MetaStatDivider />
          <MetaStat value={stats.total} label="Total URLs Analyzed" />
        </div>
        {onDataChange && (
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

      {/* Merge action bar */}
      {mergeMode && selected.size >= 2 && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border text-xs">
          <span className="text-muted-foreground">{selected.size} types selected</span>
          <Button size="sm" className="text-xs h-6 gap-1" onClick={openMergeDialog}>
            <Merge className="h-3 w-3" /> Merge Selected
          </Button>
        </div>
      )}


      {/* Expandable rows */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Sticky header — matches other tables */}
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          <span className="flex-1 text-xs font-medium text-muted-foreground">URL</span>
          <span className="w-[70px] text-center text-xs font-medium text-muted-foreground">Type</span>
          <span className="w-[120px] text-center text-xs font-medium text-muted-foreground">Template</span>
        </div>
        {summary.map((row) => {
          const isExpanded = expandedTypes.has(row.type);
          const typeUrls = urlsByType[row.type] || [];
          const hasClassified = typeUrls.length > 0;
          const fallbackUrls: ClassifiedUrl[] = !hasClassified
            ? row.urls.map(u => ({ url: u, contentType: row.type, confidence: 'medium' as const, source: '', baseType: row.baseType }))
            : [];
          const displayUrls = hasClassified ? typeUrls : fallbackUrls;

          return (
            <div key={row.type} className={selected.has(row.type) ? 'bg-primary/5' : ''}>
              {/* Collapsible header — unified style */}
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors text-left border-t border-border first:border-t-0"
                onClick={() => setExpandedTypes(prev => { const next = new Set(prev); if (isExpanded) next.delete(row.type); else next.add(row.type); return next; })}
              >
                {mergeMode && (
                  <Checkbox
                    checked={selected.has(row.type)}
                    onCheckedChange={(e) => { e; toggleSelect(row.type); }}
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
                  ) : `${row.type}${row.baseType ? ` (${row.baseType})` : ''}`}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{row.count}</Badge>
              </button>

              {/* Expanded content */}
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
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* How content types were identified */}
      {Object.values(stats.bySource).some(c => c > 0) && (
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
