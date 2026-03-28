import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  BookOpen, Loader2, Check, Search, X, ArrowUpDown, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  KnowledgeDocument, getDocumentIcon, getSourceLabel, formatDate, sortDocuments,
  SortField, SortDir, SOURCE_LABELS,
} from '@/components/document-library/types';

type SortOption = 'name' | 'date' | 'size';
type SortDirection = 'asc' | 'desc';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onDocumentsSelected: (docs: { id: string; name: string }[]) => void;
  alreadySelectedIds?: Set<string>;
}

function formatCharCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M chars`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K chars`;
  return `${n} chars`;
}

export function KnowledgeBasePickerDialog({ open, onOpenChange, sessionId, onDocumentsSelected, alreadySelectedIds }: Props) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterBy, setFilterBy] = useState('all');
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedIds(new Set());
    setSearchQuery('');
    setFocusedId(null);
    (async () => {
      const { data } = await supabase
        .from('knowledge_documents')
        .select('id, name, source_type, source_key, chunk_count, char_count, status, error_message, created_at')
        .eq('session_id', sessionId)
        .eq('status', 'ready')
        .order('created_at', { ascending: false });
      setDocuments((data || []) as unknown as KnowledgeDocument[]);
      setLoading(false);
    })();
  }, [open, sessionId]);

  const sourceTypes = useMemo(() => {
    const types = new Set(documents.map(d => d.source_type));
    return Array.from(types).sort();
  }, [documents]);

  const sortField: SortField = sortOption === 'name' ? 'name' : sortOption === 'size' ? 'char_count' : 'created_at';
  const sortDir: SortDir = sortDirection === 'asc' ? 'asc' : 'desc';

  const processedDocs = useMemo(() => {
    let filtered = documents;
    if (filterBy !== 'all') filtered = filtered.filter(d => d.source_type === filterBy);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d => d.name.toLowerCase().includes(q));
    }
    return sortDocuments(filtered, sortField, sortDir);
  }, [documents, filterBy, searchQuery, sortField, sortDir]);

  const toggleDoc = useCallback((id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const handleConfirm = () => {
    const selected = documents.filter(d => selectedIds.has(d.id));
    onDocumentsSelected(selected.map(d => ({ id: d.id, name: d.name })));
    onOpenChange(false);
  };

  const getFilterLabel = () => {
    if (filterBy === 'all') return 'All sources';
    return SOURCE_LABELS[filterBy] || filterBy;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[75vh] flex flex-col p-0 gap-0 overflow-hidden [&>button:last-child]:hidden">
        {/* Header — matches Drive picker */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">Select documents</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search + Sort + Filter — matches Drive picker toolbar */}
        <div className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search knowledge base"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 pr-8 bg-muted/50 border-0 focus-visible:ring-1"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 px-2.5">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Sort by</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSortOption('name')} className="gap-2">
                  {sortOption === 'name' ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} Name
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption('date')} className="gap-2">
                  {sortOption === 'date' ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} Date added
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption('size')} className="gap-2">
                  {sortOption === 'size' ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} Size
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Direction</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSortDirection('asc')} className="gap-2">
                  {sortDirection === 'asc' ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} A → Z / Oldest
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortDirection('desc')} className="gap-2">
                  {sortDirection === 'desc' ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} Z → A / Newest
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={filterBy !== 'all' ? 'default' : 'outline'} size="sm" className="gap-1.5 text-xs h-9 px-2.5">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{getFilterLabel()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by source</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={filterBy === 'all'} onCheckedChange={() => setFilterBy('all')}>
                  All sources
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {sourceTypes.map(st => {
                  const Icon = getDocumentIcon('', st, null);
                  return (
                    <DropdownMenuCheckboxItem key={st} checked={filterBy === st} onCheckedChange={() => setFilterBy(st)}>
                      <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                      {SOURCE_LABELS[st] || st}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Document list — matches Drive picker file list layout */}
        <div className="flex-1 overflow-hidden min-h-0">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : processedDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <BookOpen className="w-16 h-16 mb-3 opacity-50" />
                <p className="font-medium">{searchQuery || filterBy !== 'all' ? 'No matching documents' : 'No documents in knowledge base'}</p>
                <p className="text-sm">{searchQuery || filterBy !== 'all' ? 'Try a different search or filter' : 'Add documents from the Knowledge tab'}</p>
              </div>
            ) : (
              <div>
                {/* Column headers */}
                <div className="grid grid-cols-[2rem_1.5rem_1fr_6rem_5.5rem] items-center gap-2 px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground sticky top-0 z-10 border-b">
                  <div />
                  <div />
                  <div>Name</div>
                  <div>Source</div>
                  <div>Date Added</div>
                </div>
                {processedDocs.map(doc => {
                  const Icon = getDocumentIcon(doc.name, doc.source_type, doc.source_key);
                  const isAlreadyPicked = alreadySelectedIds?.has(doc.id);
                  const isSelected = selectedIds.has(doc.id);
                  const isFocused = focusedId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      onClick={() => !isAlreadyPicked && toggleDoc(doc.id)}
                      onFocus={() => setFocusedId(doc.id)}
                      tabIndex={isAlreadyPicked ? -1 : 0}
                      className={cn(
                        'grid grid-cols-[2rem_1.5rem_1fr_6rem_5.5rem] items-center gap-2 px-4 py-2.5 transition-colors group outline-none border-b border-border/40',
                        isAlreadyPicked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50',
                        isSelected && 'bg-primary/10',
                        isFocused && !isSelected && 'ring-1 ring-inset ring-primary/50'
                      )}
                    >
                      {/* Checkbox */}
                      <div className="flex items-center justify-center">
                        <div className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                          isSelected || isAlreadyPicked
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/40 group-hover:border-muted-foreground'
                        )}>
                          {(isSelected || isAlreadyPicked) && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                        </div>
                      </div>

                      {/* Icon */}
                      <Icon className="w-5 h-5 text-muted-foreground" />

                      {/* Name */}
                      <p className="text-sm truncate min-w-0">{doc.name}</p>

                      {/* Source */}
                      <p className="text-xs text-muted-foreground truncate">
                        {getSourceLabel(doc.source_type, doc.source_key)}
                      </p>

                      {/* Date */}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer — matches Drive picker footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${processedDocs.length} document${processedDocs.length !== 1 ? 's' : ''} available`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
              Include {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}document{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
