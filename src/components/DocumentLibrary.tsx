import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { FileText, Upload, Loader2, Database, BookOpen, X, RefreshCw, LayoutGrid, List, Search, FolderOpen, ArrowDownAZ, ArrowUpAZ, Clock, Hash, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { GridView } from './document-library/GridView';
import { TableView } from './document-library/TableView';
import { KnowledgeDocument, SortField, SortDir, sortDocuments, SOURCE_LABELS } from './document-library/types';

const PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-upload`;
const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ingest`;

const BINARY_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword': 'application/msword',
  'image/png': 'image/png', 'image/jpeg': 'image/jpeg', 'image/webp': 'image/webp', 'image/gif': 'image/gif',
};

function isBinaryFile(file: File): boolean {
  if (BINARY_MIME_TYPES[file.type]) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
}

function getMimeType(file: File): string {
  if (file.type && BINARY_MIME_TYPES[file.type]) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  };
  return map[ext] || 'application/octet-stream';
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve((reader.result as string).split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type Props = {
  sessionId: string;
  onDocumentCountChange?: (count: number) => void;
  refreshKey?: number;
  onIngestIntegrations?: () => void;
  ingesting?: boolean;
};

type ViewMode = 'grid' | 'table';

export function DocumentLibrary({ sessionId, onDocumentCountChange, refreshKey, onIngestIntegrations, ingesting }: Props) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [groupBy, setGroupBy] = useState<string>('none');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to fetch documents:', error);
    } else {
      setDocuments((data || []) as unknown as KnowledgeDocument[]);
      onDocumentCountChange?.((data || []).length);
    }
    setLoading(false);
  }, [sessionId, onDocumentCountChange]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments, refreshKey]);

  useEffect(() => {
    const processing = documents.some(d => d.status === 'processing' || d.status === 'pending');
    if (!processing) return;
    const interval = setInterval(fetchDocuments, 3000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  // Derive unique source types for filter
  const sourceTypes = useMemo(() => {
    const types = new Set(documents.map(d => d.source_type));
    return Array.from(types).sort();
  }, [documents]);

  // Filter → search → sort pipeline
  const processedDocuments = useMemo(() => {
    let filtered = documents;
    if (filterSource !== 'all') {
      filtered = filtered.filter(d => d.source_type === filterSource);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.source_type.toLowerCase().includes(q)
      );
    }
    return sortDocuments(filtered, sortField, sortDir);
  }, [documents, filterSource, searchQuery, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    const fileList = Array.from(files).filter(f => {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name} is too large (max 20MB)`); return false; }
      return true;
    });
    if (fileList.length === 0) { setUploading(false); return; }

    // Step 1: Insert placeholder rows so files appear immediately
    const placeholders = fileList.map(f => ({
      session_id: sessionId,
      name: f.name,
      source_type: 'upload',
      status: 'uploading',
      char_count: 0,
      chunk_count: 0,
    }));
    const { data: inserted, error: insertErr } = await supabase
      .from('knowledge_documents')
      .insert(placeholders)
      .select('id, name');
    if (insertErr) { toast.error('Failed to queue files'); setUploading(false); return; }
    const idMap = new Map<string, string>();
    for (const row of (inserted || []) as any[]) idMap.set(row.name, row.id);
    fetchDocuments();

    // Step 2: Process each file individually
    let successCount = 0;
    for (const file of fileList) {
      const docId = idMap.get(file.name);
      try {
        let content: string;
        if (isBinaryFile(file)) {
          const fileBase64 = await fileToBase64(file);
          const parseResp = await fetch(PARSE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ fileBase64, fileName: file.name, mimeType: getMimeType(file) }),
          });
          if (!parseResp.ok) {
            if (docId) await supabase.from('knowledge_documents').update({ status: 'error', error_message: 'Parse failed' }).eq('id', docId);
            fetchDocuments();
            continue;
          }
          const { text } = await parseResp.json();
          if (!text || text.length < 30) {
            if (docId) await supabase.from('knowledge_documents').update({ status: 'error', error_message: 'No content extracted' }).eq('id', docId);
            fetchDocuments();
            continue;
          }
          content = text;
        } else {
          content = await file.text();
        }

        // Update placeholder to pending before indexing
        if (docId) {
          await supabase.from('knowledge_documents').delete().eq('id', docId);
        }

        // Send to ingest (creates real doc with chunking)
        const response = await fetch(INGEST_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ session_id: sessionId, documents: [{ name: file.name, content, source_type: 'upload' }] }),
        });
        if (response.ok) successCount++;
        fetchDocuments();
      } catch {
        if (docId) await supabase.from('knowledge_documents').update({ status: 'error', error_message: 'Upload failed' }).eq('id', docId);
        fetchDocuments();
      }
    }

    if (successCount > 0) toast.success(`${successCount} file${successCount !== 1 ? 's' : ''} indexed`);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploading(false);
  };

  const deleteDocument = async (docId: string, docName: string) => {
    const { error } = await supabase.from('knowledge_documents').delete().eq('id', docId);
    if (error) toast.error('Failed to delete document');
    else { toast.success(`Removed "${docName}"`); fetchDocuments(); }
  };

  const readyCount = documents.filter(d => d.status === 'ready').length;
  const totalChunks = documents.reduce((sum, d) => sum + d.chunk_count, 0);
  const totalChars = documents.reduce((sum, d) => sum + d.char_count, 0);
  const formattedChars = totalChars >= 1000000 ? `${(totalChars / 1000000).toFixed(1)}M` : totalChars >= 1000 ? `${(totalChars / 1000).toFixed(1)}K` : String(totalChars);

  return (
    <div className="flex flex-col">
      {/* Single toolbar row: controls left, stats right */}
      <div className="flex items-center gap-2 px-1 mb-3">
        {/* Controls - left */}
        <div className="flex items-center gap-1.5">
          {/* View toggle */}
          <div className="flex items-center border rounded-md overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`} title="Grid view">
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setViewMode('table')} className={`p-1.5 transition-colors ${viewMode === 'table' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`} title="List view">
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filter */}
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="h-7 w-auto text-xs gap-1 border rounded-md px-2 [&>svg:last-child]:hidden">
              <Database className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-medium">Filter</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All sources</SelectItem>
              {sourceTypes.map(st => (
                <SelectItem key={st} value={st} className="text-xs">{SOURCE_LABELS[st] || st}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={`${sortField}:${sortDir}`} onValueChange={v => { const [f, d] = v.split(':'); setSortField(f as SortField); setSortDir(d as SortDir); }}>
            <SelectTrigger className="h-7 w-auto text-xs gap-1 border rounded-md px-2 [&>svg:last-child]:hidden">
              <ArrowDownAZ className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-medium">Sort</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at:desc" className="text-xs">Newest first</SelectItem>
              <SelectItem value="created_at:asc" className="text-xs">Oldest first</SelectItem>
              <SelectItem value="name:asc" className="text-xs">Name A–Z</SelectItem>
              <SelectItem value="name:desc" className="text-xs">Name Z–A</SelectItem>
              <SelectItem value="char_count:desc" className="text-xs">Largest first</SelectItem>
              <SelectItem value="char_count:asc" className="text-xs">Smallest first</SelectItem>
              <SelectItem value="chunk_count:desc" className="text-xs">Most chunks</SelectItem>
            </SelectContent>
          </Select>

          {/* Group by */}
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="h-7 w-auto text-xs gap-1 border rounded-md px-2 [&>svg:last-child]:hidden">
              <FolderOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-medium">Group</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">No grouping</SelectItem>
              <SelectItem value="source" className="text-xs">By source</SelectItem>
              <SelectItem value="status" className="text-xs">By status</SelectItem>
            </SelectContent>
          </Select>

          {(filterSource !== 'all' || searchQuery || groupBy !== 'none') && (
            <button onClick={() => { setFilterSource('all'); setSearchQuery(''); setGroupBy('none'); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-1">
              <X className="h-3 w-3" />
            </button>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-7 w-64 pl-6 text-xs"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

        </div>

        {/* Stats - right */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <BookOpen className="h-3.5 w-3.5" />
          <span><strong className="text-foreground">{readyCount}</strong> docs</span>
          <span>·</span>
          <span><strong className="text-foreground">{totalChunks}</strong> chunks</span>
          <span>·</span>
          <span><strong className="text-foreground">{formattedChars}</strong> chars</span>
        </div>
      </div>

      {/* Upload + Sync row */}
      <div className="flex items-center gap-2 px-1 mb-3">
        <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif" className="hidden" onChange={handleFileUpload} />
        <Button variant="outline" size="sm" className="flex-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
          {uploading ? 'Processing...' : 'Upload Documents'}
        </Button>
        {onIngestIntegrations && (
          <Button variant="outline" size="sm" onClick={onIngestIntegrations} disabled={ingesting || uploading} title="Re-sync integration data">
            {ingesting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            {ingesting ? 'Syncing…' : 'Sync'}
          </Button>
        )}
      </div>

      {/* Document list */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground mb-1">No documents yet</p>
            <p className="text-xs text-muted-foreground">Upload files or ingest integration data to build your knowledge base.</p>
          </div>
        ) : processedDocuments.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Search className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">No documents match your search</p>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView documents={processedDocuments} onDelete={deleteDocument} groupBy={groupBy !== 'none' ? groupBy : undefined} />
        ) : (
          <TableView documents={processedDocuments} onDelete={deleteDocument} sortField={sortField} sortDir={sortDir} onSort={handleSort} groupBy={groupBy !== 'none' ? groupBy : undefined} />
        )}
      </div>
    </div>
  );
}
