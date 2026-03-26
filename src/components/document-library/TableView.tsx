import { FileText, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  const sortable = (field: SortField, label: string, className?: string) => (
    <TableHead
      className={`h-8 text-xs cursor-pointer select-none hover:text-foreground transition-colors ${className || ''}`}
      onClick={() => onSort(field)}
    >
      {label}<SortIndicator field={field} activeField={sortField} dir={sortDir} />
    </TableHead>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {sortable('name', 'Name')}
          {sortable('created_at', 'Date Added', 'w-24')}
          {sortable('char_count', 'Size', 'w-20 text-right')}
          {sortable('chunk_count', 'Chunks', 'w-16 text-right')}
          {sortable('source_type', 'Source', 'w-24')}
          <TableHead className="h-8 text-xs w-16">Status</TableHead>
          <TableHead className="h-8 text-xs w-8"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map(doc => {
          const statusConf = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
          const StatusIcon = statusConf.icon;
          const SourceIcon = SOURCE_ICONS[doc.source_type] || FileText;
          const FileIcon = getDocumentIcon(doc.name, doc.source_type);

          return (
            <TableRow key={doc.id} className="group">
              <TableCell className="py-2 px-4">
                <div className="flex items-center gap-2">
                  <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate max-w-[200px]">{doc.name}</span>
                </div>
              </TableCell>
              <TableCell className="py-2 px-4 text-xs text-muted-foreground">{formatDate(doc.created_at)}</TableCell>
              <TableCell className="py-2 px-4 text-xs text-muted-foreground text-right">{(doc.char_count / 1000).toFixed(0)}K chars</TableCell>
              <TableCell className="py-2 px-4 text-xs text-muted-foreground text-right">{doc.chunk_count}</TableCell>
              <TableCell className="py-2 px-4">
                <div className="flex items-center gap-1.5">
                  <SourceIcon className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{doc.source_type}</Badge>
                </div>
              </TableCell>
              <TableCell className="py-2 px-4">
                <div className="flex items-center gap-1" title={statusConf.label}>
                  <StatusIcon className={`h-3 w-3 ${statusConf.color} ${doc.status === 'processing' ? 'animate-spin' : ''}`} />
                  <span className={`text-[10px] ${statusConf.color}`}>{statusConf.label}</span>
                </div>
              </TableCell>
              <TableCell className="py-2 px-4">
                <button
                  onClick={() => onDelete(doc.id, doc.name)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
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
