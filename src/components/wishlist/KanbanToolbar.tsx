import { Search, X, ArrowUpDown, Filter, Layers, Plus, Wand2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'priority', label: 'Priority' },
] as const;

export type SortMode = typeof SORT_OPTIONS[number]['value'];

type KanbanToolbarProps = {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  priority: string;
  onPriorityChange: (v: string) => void;
  sort: SortMode;
  onSortChange: (v: SortMode) => void;
  totalCount: number;
  filteredCount: number;
  onAddClick: () => void;
  onPrioritize: () => void;
  prioritizing: boolean;
};

export function KanbanToolbar({
  search, onSearchChange,
  category, onCategoryChange,
  priority, onPriorityChange,
  sort, onSortChange,
  totalCount, filteredCount,
  onAddClick,
  onPrioritize, prioritizing,
}: KanbanToolbarProps) {
  const isFiltered = search || category !== 'all' || priority !== 'all';

  return (
    <div className="flex items-center gap-3 mb-5">
      {/* Left: Add button */}
      <button
        onClick={onAddClick}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        Add idea
      </button>

      {/* AI Prioritize */}
      <Button
        variant="outline"
        size="sm"
        onClick={onPrioritize}
        disabled={prioritizing || totalCount === 0}
        className="shrink-0"
      >
        {prioritizing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
        {prioritizing ? 'Analyzing...' : 'AI Prioritize'}
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: search + filters + sort + count */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="pl-8 pr-8 h-9 w-44 text-sm"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-fit h-9">
            <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="feature">Features</SelectItem>
            <SelectItem value="bug">Bugs</SelectItem>
            <SelectItem value="idea">Ideas</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority filter */}
        <Select value={priority} onValueChange={onPriorityChange}>
          <SelectTrigger className="w-fit h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortMode)}>
          <SelectTrigger className="w-fit h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtered count */}
        {isFiltered && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filteredCount} of {totalCount}
          </span>
        )}
      </div>
    </div>
  );
}
