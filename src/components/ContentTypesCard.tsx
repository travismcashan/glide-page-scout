import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, Merge } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConfidenceBadge, SourceBadge } from '@/components/content-types/ConfidenceBadge';
import { ExpandableUrlRows } from '@/components/content-types/ExpandableUrlRows';
import type { ContentTypesData, ClassifiedUrl } from '@/components/content-types/types';
import { rebuildSummary } from '@/components/content-types/types';

export { type ContentTypesData } from '@/components/content-types/types';

export function ContentTypesCard({ data, onDataChange }: { data: ContentTypesData; onDataChange?: (data: ContentTypesData) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const { summary, stats } = data || { summary: [], stats: { total: 0, bySource: {}, uniqueTypes: 0, ambiguousScanned: 0 } };
  const classified = data?.classified || [];
  const allTypes = useMemo(() => summary.map(s => s.type), [summary]);

  const urlsByType = useMemo(() => {
    const map: Record<string, ClassifiedUrl[]> = {};
    for (const c of classified) {
      if (!map[c.contentType]) map[c.contentType] = [];
      map[c.contentType].push(c);
    }
    return map;
  }, [classified]);

  if (!data?.summary?.length) {
    return <p className="text-sm text-muted-foreground">No content types detected.</p>;
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
    if (expandedType === oldType) setExpandedType(newName);
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
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span><strong className="text-foreground">{stats.total}</strong> URLs analyzed</span>
          <span>·</span>
          <span><strong className="text-foreground">{stats.uniqueTypes}</strong> content types found</span>
          {stats.ambiguousScanned > 0 && (
            <>
              <span>·</span>
              <span><strong className="text-foreground">{stats.ambiguousScanned}</strong> pages scanned for HTML signals</span>
            </>
          )}
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

      {/* Detection source badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(stats.bySource)
          .filter(([, count]) => count > 0)
          .map(([source, count]) => (
            <span key={source} className="flex items-center gap-1">
              <SourceBadge source={source} />
              <span className="text-[10px] text-muted-foreground">{count}</span>
            </span>
          ))}
      </div>

      {/* Summary table with expandable rows */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_60px_80px] text-xs font-medium text-muted-foreground border-b border-border">
          {mergeMode && <div className="px-3 py-2.5 w-[40px]" />}
          <div className="px-3 py-2.5">Content Type</div>
          <div className="px-3 py-2.5 text-right">Count</div>
          <div className="px-3 py-2.5">Confidence</div>
        </div>
        {summary.map((row) => {
          const isExpanded = expandedType === row.type;
          const typeUrls = urlsByType[row.type] || [];
          const hasClassified = typeUrls.length > 0;
          // Fallback: if no classified data, build from summary urls
          const fallbackUrls: ClassifiedUrl[] = !hasClassified
            ? row.urls.map(u => ({ url: u, contentType: row.type, confidence: 'medium' as const, source: '' }))
            : [];
          const displayUrls = hasClassified ? typeUrls : fallbackUrls;

          return (
            <div key={row.type} className={selected.has(row.type) ? 'bg-primary/5' : ''}>
              <div
                className="grid grid-cols-[auto_1fr_60px_80px] items-center border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setExpandedType(isExpanded ? null : row.type)}
              >
                <div className="flex items-center gap-1 px-3 py-2.5">
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
                </div>
                <div className="px-1 py-2.5 text-sm font-medium">
                  {editingType === row.type ? (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleRename(row.type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(row.type);
                        if (e.key === 'Escape') setEditingType(null);
                      }}
                      className="h-6 text-sm px-1.5 py-0 w-40"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={onDataChange ? 'hover:text-primary hover:underline' : ''}
                      onClick={(e) => {
                        if (!onDataChange) return;
                        e.stopPropagation();
                        setEditingType(row.type);
                        setEditValue(row.type);
                      }}
                    >
                      {row.type}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5 text-sm text-right font-mono">{row.count}</div>
                <div className="px-3 py-2.5"><ConfidenceBadge conf={row.confidence} /></div>
              </div>
              {isExpanded && (
                <div className="border-b border-border bg-muted/10 py-2">
                  <ExpandableUrlRows
                    urls={displayUrls}
                    allTypes={allTypes}
                    onChangeType={onDataChange ? handleChangeUrlType : undefined}
                    readOnly={!onDataChange}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

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
