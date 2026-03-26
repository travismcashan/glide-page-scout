import { useState } from 'react';
import { FileText, X, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { KnowledgeDocument, SortField, SortDir, STATUS_CONFIG, SOURCE_ICONS, getDocumentIcon, formatDate } from './types';

type Props = {
  documents: KnowledgeDocument[];
  onDelete: (id: string, name: string) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  groupBy?: string;
};

export function TableView({ documents, onDelete, sortField, sortDir, onSort, groupBy }: Props) {
  if (groupBy === 'source' || groupBy === 'status') {
    const groups = groupBy === 'source' ? groupBySource(documents) : groupByStatus(documents);
    return (
      <div className="space-y-4 px-1">
        {groups.map(([label, docs]) => (
          <div key={label}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</h4>
            <DocTable documents={docs} onDelete={onDelete} sortField={sortField} sortDir={sortDir} onSort={onSort} />
          </div>
        ))}
      </div>
    );
  }

  return <div className="px-1"><DocTable documents={documents} onDelete={onDelete} sortField={sortField} sortDir={sortDir} onSort={onSort} /></div>;
}

function SortIndicator({ field, activeField, dir }: { field: SortField; activeField: SortField; dir: SortDir }) {
  if (field !== activeField) return null;
  return dir === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-0.5" /> : <ArrowDown className="h-3 w-3 inline ml-0.5" />;
}

function DocTable({ documents, onDelete, sortField, sortDir, onSort }: Omit<Props, 'groupBy'>) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const togglePreview = async (docId: string) => {
    if (expandedId === docId) {
      setExpandedId(null);
      setPreviewContent(null);
      return;
    }
    setExpandedId(docId);
    setPreviewContent(null);
    setLoadingPreview(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_chunks')
        .select('chunk_text, chunk_index')
        .eq('document_id', docId)
        .order('chunk_index', { ascending: true })
        .limit(50);
      if (error || !data || data.length === 0) {
        setPreviewContent('No content available.');
      } else {
        setPreviewContent(data.map((c: any) => c.chunk_text).join('\n\n'));
      }
    } catch {
      setPreviewContent('Failed to load preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const sortable = (field: SortField, label: string, className?: string) => (
    <TableHead
      className={`h-9 text-sm cursor-pointer select-none hover:text-foreground transition-colors ${className || ''}`}
      onClick={() => onSort(field)}
    >
      {label}<SortIndicator field={field} activeField={sortField} dir={sortDir} />
    </TableHead>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {sortable('name', 'Name', 'min-w-[200px]')}
          {sortable('created_at', 'Date Added', 'w-36 whitespace-nowrap')}
          {sortable('char_count', 'Size', 'w-28 text-right whitespace-nowrap')}
          {sortable('chunk_count', 'Chunks', 'w-24 text-right whitespace-nowrap')}
          {sortable('source_type', 'Source', 'w-32 whitespace-nowrap')}
          <TableHead className="h-9 text-sm w-24 whitespace-nowrap">Status</TableHead>
          <TableHead className="h-9 text-sm w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map(doc => {
          const statusConf = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
          const StatusIcon = statusConf.icon;
          const SourceIcon = SOURCE_ICONS[doc.source_type] || FileText;
          const FileIcon = getDocumentIcon(doc.name, doc.source_type);
          const isExpanded = expandedId === doc.id;
          const canPreview = doc.status === 'ready' && doc.chunk_count > 0;

          return (
            <>
              <TableRow
                key={doc.id}
                className={`group ${canPreview ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-accent/30' : ''}`}
                onClick={() => canPreview && togglePreview(doc.id)}
              >
                <TableCell className="py-2.5 px-4">
                  <div className="flex items-center gap-2">
                    {canPreview ? (
                      isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate max-w-[400px]">{doc.name}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2.5 px-4 text-sm text-muted-foreground">{formatDate(doc.created_at)}</TableCell>
                <TableCell className="py-2.5 px-4 text-sm text-muted-foreground text-right">{doc.status === 'uploading' ? '—' : `${(doc.char_count / 1000).toFixed(0)}K chars`}</TableCell>
                <TableCell className="py-2.5 px-4 text-sm text-muted-foreground text-right">{doc.status === 'uploading' ? '—' : doc.chunk_count}</TableCell>
                <TableCell className="py-2.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5">{doc.source_type}</Badge>
                  </div>
                </TableCell>
                <TableCell className="py-2.5 px-4">
                  <div className="flex items-center gap-1" title={statusConf.label}>
                    <StatusIcon className={`h-3.5 w-3.5 ${statusConf.color} ${(doc.status === 'processing' || doc.status === 'uploading') ? 'animate-spin' : ''}`} />
                    <span className={`text-xs ${statusConf.color}`}>{statusConf.label}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2.5 px-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(doc.id, doc.name); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow key={`${doc.id}-preview`}>
                  <TableCell colSpan={7} className="p-0">
                    <div className="border-t border-b border-accent/50 bg-muted/30">
                      {loadingPreview ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-xs text-muted-foreground ml-2">Loading preview…</span>
                        </div>
                      ) : (
                        <ScrollArea className="max-h-64">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap p-4 font-mono leading-relaxed">
                            {previewContent}
                          </pre>
                        </ScrollArea>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}

function groupBySource(docs: KnowledgeDocument[]): [string, KnowledgeDocument[]][] {
  const map = new Map<string, KnowledgeDocument[]>();
  for (const d of docs) {
    if (!map.has(d.source_type)) map.set(d.source_type, []);
    map.get(d.source_type)!.push(d);
  }
  return Array.from(map.entries());
}

function groupByStatus(docs: KnowledgeDocument[]): [string, KnowledgeDocument[]][] {
  const order = ['ready', 'processing', 'pending', 'error'];
  const map = new Map<string, KnowledgeDocument[]>();
  for (const d of docs) {
    const key = STATUS_CONFIG[d.status]?.label || d.status;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }
  return Array.from(map.entries()).sort(([a], [b]) => {
    const ai = order.indexOf(Object.keys(STATUS_CONFIG).find(k => STATUS_CONFIG[k].label === a) || '');
    const bi = order.indexOf(Object.keys(STATUS_CONFIG).find(k => STATUS_CONFIG[k].label === b) || '');
    return ai - bi;
  });
}