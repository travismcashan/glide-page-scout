import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Search, ArrowRight, Sparkles, CheckSquare, Square,
  ArrowUpDown, X, ExternalLink, Loader2,
} from 'lucide-react';

export type UrlEntry = {
  url: string;
  reason?: string;
  isRecommended: boolean;
};

type SortMode = 'selected-first' | 'alpha' | 'recommended-first';

type Props = {
  entries: UrlEntry[];
  selectedUrls: Set<string>;
  setSelectedUrls: React.Dispatch<React.SetStateAction<Set<string>>>;
  existingUrls: Set<string>;
  existingLabel: string;
  onSubmit: () => void;
  submitLabel: string;
  isSubmitting: boolean;
  isAnalyzing: boolean;
  analysisDone: boolean;
};

export function UrlSelectionList({
  entries, selectedUrls, setSelectedUrls, existingUrls, existingLabel,
  onSubmit, submitLabel, isSubmitting, isAnalyzing, analysisDone,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('selected-first');

  const filteredAndSorted = useMemo(() => {
    let result = entries;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => e.url.toLowerCase().includes(q) || (e.reason && e.reason.toLowerCase().includes(q)));
    }
    return [...result].sort((a, b) => {
      if (sortMode === 'selected-first') {
        const aS = selectedUrls.has(a.url) ? 0 : 1;
        const bS = selectedUrls.has(b.url) ? 0 : 1;
        if (aS !== bS) return aS - bS;
        const aR = a.isRecommended ? 0 : 1;
        const bR = b.isRecommended ? 0 : 1;
        if (aR !== bR) return aR - bR;
        return a.url.localeCompare(b.url);
      }
      if (sortMode === 'recommended-first') {
        const aR = a.isRecommended ? 0 : 1;
        const bR = b.isRecommended ? 0 : 1;
        if (aR !== bR) return aR - bR;
        return a.url.localeCompare(b.url);
      }
      return a.url.localeCompare(b.url);
    });
  }, [entries, searchQuery, sortMode, selectedUrls]);

  const toggleUrl = (pageUrl: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(pageUrl)) next.delete(pageUrl); else next.add(pageUrl);
      return next;
    });
  };

  const selectAll = () => {
    const visible = filteredAndSorted.map(e => e.url);
    setSelectedUrls(prev => { const next = new Set(prev); visible.forEach(u => next.add(u)); return next; });
  };

  const deselectAll = () => {
    const visible = new Set(filteredAndSorted.map(e => e.url));
    setSelectedUrls(prev => { const next = new Set(prev); visible.forEach(u => next.delete(u)); return next; });
  };

  const selectRecommended = () => {
    setSelectedUrls(new Set(entries.filter(e => e.isRecommended).map(e => e.url)));
  };

  const visibleSelected = filteredAndSorted.filter(e => selectedUrls.has(e.url)).length;
  const allVisibleSelected = visibleSelected === filteredAndSorted.length && filteredAndSorted.length > 0;

  const cycleSortMode = () => {
    const modes: SortMode[] = ['selected-first', 'recommended-first', 'alpha'];
    const idx = modes.indexOf(sortMode);
    setSortMode(modes[(idx + 1) % modes.length]);
  };

  const sortLabel: Record<SortMode, string> = {
    'selected-first': 'Selected first',
    'recommended-first': 'Recommended first',
    'alpha': 'A → Z',
  };

  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search URLs..." className="pl-10 pr-10" />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={allVisibleSelected ? deselectAll : selectAll} className="text-xs h-7">
            {allVisibleSelected ? <><Square className="h-3 w-3 mr-1" />Deselect All</> : <><CheckSquare className="h-3 w-3 mr-1" />Select All</>}
          </Button>
          {analysisDone && entries.some(e => e.isRecommended) && (
            <Button variant="outline" size="sm" onClick={selectRecommended} className="text-xs h-7">
              <Sparkles className="h-3 w-3 mr-1" />AI Picks
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={deselectAll} className="text-xs h-7">
            <X className="h-3 w-3 mr-1" />Clear
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cycleSortMode} className="text-xs h-7">
            <ArrowUpDown className="h-3 w-3 mr-1" />{sortLabel[sortMode]}
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={isSubmitting || selectedUrls.size === 0}>
            {isSubmitting ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing...</> : <><ArrowRight className="h-3 w-3 mr-1" />{submitLabel} ({selectedUrls.size})</>}
          </Button>
        </div>
      </div>
      {searchQuery && <p className="text-xs text-muted-foreground">Showing {filteredAndSorted.length} of {entries.length} URLs</p>}
      <div className="space-y-1 max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card p-2">
        {filteredAndSorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No URLs match "{searchQuery}"</p>
        ) : filteredAndSorted.map((entry) => {
          const isSelected = selectedUrls.has(entry.url);
          const alreadyAdded = existingUrls.has(entry.url);
          return (
            <label
              key={entry.url}
              className={`flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                alreadyAdded ? 'bg-muted/50 opacity-60' : isSelected ? 'bg-primary/5 border border-primary/10' : 'hover:bg-muted border border-transparent'
              }`}
            >
              <Checkbox checked={isSelected} onCheckedChange={() => toggleUrl(entry.url)} className="mt-0.5" disabled={alreadyAdded} />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-mono truncate block">{entry.url}</span>
                {entry.isRecommended && entry.reason && (
                  <span className="text-xs text-primary flex items-center gap-1 mt-0.5">
                    <Sparkles className="h-3 w-3" />{entry.reason}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {alreadyAdded && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{existingLabel}</Badge>}
                {entry.isRecommended && !alreadyAdded && <Badge variant="default" className="text-[10px] px-1.5 py-0">AI pick</Badge>}
                <a href={entry.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </a>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
