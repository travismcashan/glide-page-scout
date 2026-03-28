import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, Search, X, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { KnowledgeDocument, getDocumentIcon, getSourceLabel, formatDate, sortDocuments, SortField, SortDir } from '@/components/document-library/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onDocumentsSelected: (docs: { id: string; name: string }[]) => void;
  alreadySelectedIds?: Set<string>;
}

function formatCharCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function KnowledgeBasePickerDialog({ open, onOpenChange, sessionId, onDocumentsSelected, alreadySelectedIds }: Props) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterSource, setFilterSource] = useState('all');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedIds(new Set());
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

  const processedDocs = useMemo(() => {
    let filtered = documents;
    if (filterSource !== 'all') filtered = filtered.filter(d => d.source_type === filterSource);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d => d.name.toLowerCase().includes(q));
    }
    return sortDocuments(filtered, sortField, sortDir);
  }, [documents, filterSource, searchQuery, sortField, sortDir]);

  const toggleDoc = useCallback((id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === processedDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedDocs.map(d => d.id)));
    }
  }, [selectedIds.size, processedDocs]);

  const handleConfirm = () => {
    const selected = documents.filter(d => selectedIds.has(d.id));
    onDocumentsSelected(selected.map(d => ({ id: d.id, name: d.name })));
    onOpenChange(false);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Select Knowledge Documents
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search documents…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All sources</SelectItem>
              {sourceTypes.map(st => (
                <SelectItem key={st} value={st} className="text-xs">{getSourceLabel(st, null)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : processedDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Database className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">No documents found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b z-10">
                <tr className="text-xs text-muted-foreground">
                  <th className="w-10 px-4 py-2 text-left">
                    <Checkbox
                      checked={selectedIds.size === processedDocs.length && processedDocs.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="px-2 py-2 text-left">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left hidden sm:table-cell">
                    <button onClick={() => handleSort('source_type')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Source <SortIcon field="source_type" />
                    </button>
                  </th>
                  <th className="px-2 py-2 text-right">
                    <button onClick={() => handleSort('char_count')} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">
                      Size <SortIcon field="char_count" />
                    </button>
                  </th>
                  <th className="px-2 py-2 text-right hidden sm:table-cell">
                    <button onClick={() => handleSort('chunk_count')} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">
                      Chunks <SortIcon field="chunk_count" />
                    </button>
                  </th>
                  <th className="px-2 py-2 text-right pr-4">
                    <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">
                      Date <SortIcon field="created_at" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {processedDocs.map(doc => {
                  const Icon = getDocumentIcon(doc.name, doc.source_type, doc.source_key);
                  const isAlreadyPicked = alreadySelectedIds?.has(doc.id);
                  const isSelected = selectedIds.has(doc.id);
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => !isAlreadyPicked && toggleDoc(doc.id)}
                      className={cn(
                        'border-b cursor-pointer transition-colors',
                        isSelected ? 'bg-primary/5' : 'hover:bg-muted/50',
                        isAlreadyPicked && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <td className="px-4 py-2">
                        <Checkbox
                          checked={isSelected || !!isAlreadyPicked}
                          disabled={isAlreadyPicked}
                          onCheckedChange={() => !isAlreadyPicked && toggleDoc(doc.id)}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground hidden sm:table-cell">
                        {getSourceLabel(doc.source_type, doc.source_key)}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                        {formatCharCount(doc.char_count)}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                        {doc.chunk_count}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground pr-4">
                        {formatDate(doc.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t flex-shrink-0 bg-background">
          <p className="text-xs text-muted-foreground">
            {selectedIds.size > 0
              ? `${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''} selected`
              : `${processedDocs.length} document${processedDocs.length !== 1 ? 's' : ''} available`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={selectedIds.size === 0}>
              <Database className="h-3.5 w-3.5 mr-1.5" />
              Include {selectedIds.size > 0 ? selectedIds.size : ''} Document{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
