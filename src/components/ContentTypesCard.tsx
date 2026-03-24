import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronUp, Merge } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type ContentTypeSummary = {
  type: string;
  count: number;
  urls: string[];
  totalUrls: number;
  confidence: { high: number; medium: number; low: number };
};

type ContentTypesData = {
  summary: ContentTypeSummary[];
  stats: {
    total: number;
    bySource: Record<string, number>;
    uniqueTypes: number;
    ambiguousScanned: number;
  };
};

function confidenceBadge(conf: { high: number; medium: number; low: number }) {
  const total = conf.high + conf.medium + conf.low;
  if (total === 0) return null;
  const pct = Math.round((conf.high / total) * 100);
  if (pct >= 80) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30">High</Badge>;
  if (pct >= 40) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Medium</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-600 border-orange-500/30">Low</Badge>;
}

function sourceBadge(source: string) {
  const styles: Record<string, string> = {
    'url-pattern': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    'schema-org': 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    'meta-tags': 'bg-teal-500/10 text-teal-600 border-teal-500/30',
    'css-classes': 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    'ai': 'bg-pink-500/10 text-pink-600 border-pink-500/30',
  };
  const labels: Record<string, string> = {
    'url-pattern': 'URL Pattern',
    'schema-org': 'Schema.org',
    'meta-tags': 'Meta Tags',
    'css-classes': 'CSS Classes',
    'ai': 'AI',
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles[source] || ''}`}>
      {labels[source] || source}
    </Badge>
  );
}

function ExpandableUrls({ urls, totalUrls }: { urls: string[]; totalUrls: number }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? urls : urls.slice(0, 2);
  const hasMore = urls.length > 2 || totalUrls > 2;
  const hiddenInArray = urls.length - 2;
  const hiddenTotal = totalUrls - urls.length;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-0.5 max-w-[400px]">
        {visible.map((url) => (
          <Tooltip key={url}>
            <TooltipTrigger asChild>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-muted-foreground truncate block cursor-pointer hover:text-primary hover:underline">
                {(() => { try { return new URL(url).pathname; } catch { return url; } })()}
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-md">
              <p className="text-xs font-mono break-all">{url}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {hasMore && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5 cursor-pointer bg-transparent border-none p-0"
          >
            +{hiddenInArray > 0 ? hiddenInArray : totalUrls - 2} more <ChevronDown className="h-3 w-3" />
          </button>
        )}
        {expanded && (
          <>
            {hiddenTotal > 0 && (
              <span className="text-[10px] text-muted-foreground mt-0.5">
                Showing {urls.length} of {totalUrls} URLs
              </span>
            )}
            <button
              onClick={() => setExpanded(false)}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5 cursor-pointer bg-transparent border-none p-0"
            >
              Show less <ChevronUp className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

export function ContentTypesCard({ data, onDataChange }: { data: ContentTypesData; onDataChange?: (data: ContentTypesData) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!data?.summary?.length) {
    return <p className="text-sm text-muted-foreground">No content types detected.</p>;
  }

  const { summary, stats } = data;

  const toggleSelect = (type: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleRename = (oldType: string) => {
    const newName = editValue.trim();
    if (!newName || newName === oldType || !onDataChange) {
      setEditingType(null);
      return;
    }
    const newSummary = summary.map(r => r.type === oldType ? { ...r, type: newName } : r);
    onDataChange({ ...data, summary: newSummary });
    setEditingType(null);
  };

  const handleMerge = () => {
    if (!mergeName.trim() || selected.size < 2 || !onDataChange) return;

    const selectedTypes = Array.from(selected);
    const mergedRows = summary.filter(r => selectedTypes.includes(r.type));
    const keptRows = summary.filter(r => !selectedTypes.includes(r.type));

    const merged: ContentTypeSummary = {
      type: mergeName.trim(),
      count: mergedRows.reduce((s, r) => s + r.count, 0),
      urls: mergedRows.flatMap(r => r.urls).slice(0, 10),
      totalUrls: mergedRows.reduce((s, r) => s + r.totalUrls, 0),
      confidence: {
        high: mergedRows.reduce((s, r) => s + r.confidence.high, 0),
        medium: mergedRows.reduce((s, r) => s + r.confidence.medium, 0),
        low: mergedRows.reduce((s, r) => s + r.confidence.low, 0),
      },
    };

    const newSummary = [...keptRows, merged].sort((a, b) => b.count - a.count);
    onDataChange({
      ...data,
      summary: newSummary,
      stats: { ...stats, uniqueTypes: newSummary.length },
    });

    setSelected(new Set());
    setMergeName('');
    setMergeOpen(false);
    setMergeMode(false);
  };

  const openMergeDialog = () => {
    // Pre-fill with the largest selected type's name
    const selectedTypes = Array.from(selected);
    const largest = summary
      .filter(r => selectedTypes.includes(r.type))
      .sort((a, b) => b.count - a.count)[0];
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
            onClick={() => {
              setMergeMode(!mergeMode);
              if (mergeMode) setSelected(new Set());
            }}
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
              {sourceBadge(source)}
              <span className="text-[10px] text-muted-foreground">{count}</span>
            </span>
          ))}
      </div>

      {/* Summary table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {mergeMode && <TableHead className="w-[40px]" />}
              <TableHead className="text-xs">Content Type</TableHead>
              <TableHead className="text-xs text-right w-[60px]">Count</TableHead>
              <TableHead className="text-xs w-[80px]">Confidence</TableHead>
              <TableHead className="text-xs">Example URLs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((row) => (
              <TableRow key={row.type} className={selected.has(row.type) ? 'bg-primary/5' : ''}>
                {mergeMode && (
                  <TableCell className="pr-0">
                    <Checkbox
                      checked={selected.has(row.type)}
                      onCheckedChange={() => toggleSelect(row.type)}
                    />
                  </TableCell>
                )}
                <TableCell className="text-sm font-medium">
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
                    />
                  ) : (
                    <span
                      className={onDataChange ? 'cursor-pointer hover:text-primary hover:underline' : ''}
                      onClick={() => {
                        if (!onDataChange) return;
                        setEditingType(row.type);
                        setEditValue(row.type);
                      }}
                    >
                      {row.type}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-right font-mono">{row.count}</TableCell>
                <TableCell>{confidenceBadge(row.confidence)}</TableCell>
                <TableCell>
                  <ExpandableUrls urls={row.urls} totalUrls={row.totalUrls} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
