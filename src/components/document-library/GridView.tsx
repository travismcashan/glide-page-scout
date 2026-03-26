import { useState } from 'react';
import { FileText, X, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { KnowledgeDocument, STATUS_CONFIG, SOURCE_ICONS, getDocumentIcon } from './types';

type Props = {
  documents: KnowledgeDocument[];
  onDelete: (id: string, name: string) => void;
  groupBy?: string;
};

export function GridView({ documents, onDelete, groupBy }: Props) {
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

  const renderPreview = () => {
    if (!expandedId) return null;
    return (
      <div className="col-span-full border rounded-lg bg-muted/30 mt-1 mb-2">
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
    );
  };

  const renderGrid = (docs: KnowledgeDocument[]) => {
    const items: React.ReactNode[] = [];
    for (const doc of docs) {
      items.push(
        <GridItem key={doc.id} doc={doc} onDelete={onDelete} isExpanded={expandedId === doc.id} onToggle={togglePreview} />
      );
      if (expandedId === doc.id) {
        items.push(<React.Fragment key={`${doc.id}-preview`}>{renderPreview()}</React.Fragment>);
      }
    }
    return items;
  };

  if (groupBy === 'source') {
    const groups = groupBySource(documents);
    return (
      <div className="space-y-4 px-1">
        {groups.map(([label, docs]) => (
          <div key={label}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {renderGrid(docs)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groupBy === 'status') {
    const groups = groupByStatus(documents);
    return (
      <div className="space-y-4 px-1">
        {groups.map(([label, docs]) => (
          <div key={label}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {renderGrid(docs)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 px-1">
      {renderGrid(documents)}
    </div>
  );
}

import React from 'react';

function GridItem({ doc, onDelete, isExpanded, onToggle }: { doc: KnowledgeDocument; onDelete: (id: string, name: string) => void; isExpanded: boolean; onToggle: (id: string) => void }) {
  const statusConf = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConf.icon;
  const FileIcon = getDocumentIcon(doc.name, doc.source_type);
  const SourceIcon = SOURCE_ICONS[doc.source_type] || FileText;
  const canPreview = doc.status === 'ready' && doc.chunk_count > 0;

  return (
    <div
      className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-accent/50 transition-colors text-center ${canPreview ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-accent/30 ring-1 ring-accent' : ''}`}
      onClick={() => canPreview && onToggle(doc.id)}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(doc.id, doc.name); }}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
        title="Remove"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="relative">
        <FileIcon className="h-8 w-8 text-muted-foreground" />
        <SourceIcon className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-muted-foreground bg-background rounded-full p-0.5" />
      </div>
      <StatusIcon className={`h-3 w-3 ${statusConf.color} ${(doc.status === 'processing' || doc.status === 'uploading') ? 'animate-spin' : ''}`} />
      <span className="text-[10px] leading-tight font-medium text-foreground line-clamp-2 w-full break-all">
        {doc.name}
      </span>
      <span className="text-[9px] text-muted-foreground">{doc.status === 'uploading' ? 'Uploading…' : `${doc.chunk_count} chunks`}</span>
    </div>
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