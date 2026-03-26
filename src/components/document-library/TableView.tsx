import { useState } from 'react';
import { FileText, X, ArrowUp, ArrowDown, Loader2, Eye } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { KnowledgeDocument, SortField, SortDir, STATUS_CONFIG, SOURCE_ICONS, SOURCE_LABELS, getDocumentIcon, formatDate } from './types';

type Props = {
  documents: KnowledgeDocument[];
  onDelete: (id: string, name: string) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  groupBy?: string;
};

function toTitleCase(str: string): string {
  return str.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function TableView({ documents, onDelete, sortField, sortDir, onSort, groupBy }: Props) {
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const openPreview = async (doc: KnowledgeDocument) => {
    setPreviewDoc(doc);
    setPreviewContent(null);
    setLoadingPreview(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_chunks')
        .select('chunk_text, chunk_index')
        .eq('document_id', doc.id)
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

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewContent(null);
  };

  if (groupBy === 'source' || groupBy === 'status') {
    const groups = groupBy === 'source' ? groupBySource(documents) : groupByStatus(documents);
    return (
      <>
        <div className="space-y-4 px-1">
          {groups.map(([label, docs]) => (
            <div key={label}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</h4>
              <DocTable documents={docs} onDelete={onDelete} sortField={sortField} sortDir={sortDir} onSort={onSort} onPreview={openPreview} />
            </div>
          ))}
        </div>
        <PreviewDialog doc={previewDoc} content={previewContent} loading={loadingPreview} onClose={closePreview} />
      </>
    );
  }

  return (
    <>
      <div className="px-1">
        <DocTable documents={documents} onDelete={onDelete} sortField={sortField} sortDir={sortDir} onSort={onSort} onPreview={openPreview} />
      </div>
      <PreviewDialog doc={previewDoc} content={previewContent} loading={loadingPreview} onClose={closePreview} />
    </>
  );
}

function PreviewDialog({ doc, content, loading, onClose }: {
  doc: KnowledgeDocument | null;
  content: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!doc) return null;

  const FileIcon = getDocumentIcon(doc.name, doc.source_type);
  const statusConf = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden [&>button:last-child]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0 bg-background">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{doc.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{SOURCE_LABELS[doc.source_type] || toTitleCase(doc.source_type)}</span>
                <span>·</span>
                <span>{formatDate(doc.created_at)}</span>
                <span>·</span>
                <span>{(doc.char_count / 1000).toFixed(0)}K chars</span>
                <span>·</span>
                <span>{doc.chunk_count} chunks</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading preview…</span>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap p-6 font-mono leading-relaxed">
                {content}
              </pre>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/30 flex-shrink-0">
          <p className="text-xs text-muted-foreground">Press Esc to close</p>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SortIndicator({ field, activeField, dir }: { field: SortField; activeField: SortField; dir: SortDir }) {
  if (field !== activeField) return null;
  return dir === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-0.5" /> : <ArrowDown className="h-3 w-3 inline ml-0.5" />;
}

function DocTable({ documents, onDelete, sortField, sortDir, onSort, onPreview }: Omit<Props, 'groupBy'> & { onPreview: (doc: KnowledgeDocument) => void }) {
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
          {sortable('source_type', 'Source', 'w-40 whitespace-nowrap')}
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
          const canPreview = doc.status === 'ready' && doc.chunk_count > 0;

          return (
            <TableRow
              key={doc.id}
              className={`group ${canPreview ? 'cursor-pointer hover:bg-accent/50' : ''}`}
              onClick={() => canPreview && onPreview(doc)}
            >
              <TableCell className="py-2.5 px-4">
                <div className="flex items-center gap-2">
                  <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate max-w-[400px]">{doc.name}</span>
                  {canPreview && (
                    <Eye className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </div>
              </TableCell>
              <TableCell className="py-2.5 px-4 text-sm text-muted-foreground">{formatDate(doc.created_at)}</TableCell>
              <TableCell className="py-2.5 px-4 text-sm text-muted-foreground text-right">{doc.status === 'uploading' ? '—' : `${(doc.char_count / 1000).toFixed(0)}K chars`}</TableCell>
              <TableCell className="py-2.5 px-4 text-sm text-muted-foreground text-right">{doc.status === 'uploading' ? '—' : doc.chunk_count}</TableCell>
              <TableCell className="py-2.5 px-4">
                <div className="flex items-center gap-1.5">
                  <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{SOURCE_LABELS[doc.source_type] || toTitleCase(doc.source_type)}</span>
                </div>
              </TableCell>
              <TableCell className="py-2.5 px-4">
                <div className="flex items-center gap-1" title={statusConf.label}>
                  <StatusIcon className={`h-3.5 w-3.5 ${statusConf.color} ${(doc.status === 'processing' || doc.status === 'uploading') ? 'animate-spin' : ''}`} />
                  <span className={`text-sm ${statusConf.color}`}>{statusConf.label}</span>
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
