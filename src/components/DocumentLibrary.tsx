import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { FileText, Upload, Trash2, Loader2, Database, Globe, BookOpen, CheckCircle2, AlertCircle, Clock, X, RefreshCw, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

const PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-upload`;
const BINARY_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword': 'application/msword',
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
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
    doc: 'application/msword', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif',
  };
  return map[ext] || 'application/octet-stream';
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data URI prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type KnowledgeDocument = {
  id: string;
  name: string;
  source_type: string;
  source_key: string | null;
  chunk_count: number;
  char_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
};

type Props = {
  sessionId: string;
  onDocumentCountChange?: (count: number) => void;
  refreshKey?: number;
  onIngestIntegrations?: () => void;
  ingesting?: boolean;
};

const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ingest`;

const SOURCE_ICONS: Record<string, typeof FileText> = {
  integration: Database,
  upload: FileText,
  scrape: Globe,
  chat: MessageSquare,
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ready: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Indexed' },
  processing: { icon: Loader2, color: 'text-amber-500', label: 'Processing' },
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending' },
  error: { icon: AlertCircle, color: 'text-destructive', label: 'Error' },
};

export function DocumentLibrary({ sessionId, onDocumentCountChange, refreshKey, onIngestIntegrations, ingesting }: Props) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshKey]);

  // Poll for processing documents
  useEffect(() => {
    const processing = documents.some(d => d.status === 'processing' || d.status === 'pending');
    if (!processing) return;
    const interval = setInterval(fetchDocuments, 3000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const docsToIngest: { name: string; content: string; source_type: string }[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        continue;
      }
      try {
        if (isBinaryFile(file)) {
          // Route binary files through parse-upload for AI extraction
          const fileBase64 = await fileToBase64(file);
          const mimeType = getMimeType(file);
          toast.info(`Parsing ${file.name}…`);
          const parseResp = await fetch(PARSE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ fileBase64, fileName: file.name, mimeType }),
          });
          if (!parseResp.ok) {
            const err = await parseResp.json().catch(() => ({}));
            toast.error(`Failed to parse ${file.name}: ${err.error || parseResp.status}`);
            continue;
          }
          const { text } = await parseResp.json();
          if (!text || text.length < 30) {
            toast.error(`Could not extract content from ${file.name}`);
            continue;
          }
          docsToIngest.push({ name: file.name, content: text, source_type: 'upload' });
        } else {
          // Plain text files
          const text = await file.text();
          docsToIngest.push({ name: file.name, content: text, source_type: 'upload' });
        }
      } catch {
        toast.error(`Failed to read ${file.name}`);
      }
    }

    if (docsToIngest.length > 0) {
      try {
        const response = await fetch(INGEST_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ session_id: sessionId, documents: docsToIngest }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          toast.error(err.error || 'Failed to ingest documents');
        } else {
          const data = await response.json();
          const readyCount = data.results?.filter((r: any) => r.status === 'ready').length || 0;
          toast.success(`${readyCount} document${readyCount !== 1 ? 's' : ''} indexed`);
          fetchDocuments();
        }
      } catch (err: any) {
        toast.error(err?.message || 'Upload failed');
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploading(false);
  };

  const deleteDocument = async (docId: string, docName: string) => {
    // Chunks cascade-delete via FK
    const { error } = await supabase
      .from('knowledge_documents')
      .delete()
      .eq('id', docId);

    if (error) {
      toast.error('Failed to delete document');
    } else {
      toast.success(`Removed "${docName}"`);
      fetchDocuments();
    }
  };

  const readyCount = documents.filter(d => d.status === 'ready').length;
  const totalChunks = documents.reduce((sum, d) => sum + d.chunk_count, 0);

  return (
    <div className="flex flex-col">
      {/* Header stats */}
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          <span><strong className="text-foreground">{readyCount}</strong> documents</span>
          <span>·</span>
          <span><strong className="text-foreground">{totalChunks}</strong> chunks indexed</span>
        </div>
        <div className="flex items-center gap-1">
          {onIngestIntegrations && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onIngestIntegrations} disabled={ingesting || uploading} title="Sync integration data">
              {ingesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Upload */}
      <div className="px-1 mb-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-1.5" />
          )}
          {uploading ? 'Processing...' : 'Upload Documents'}
        </Button>
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
            <p className="text-xs text-muted-foreground">
              Upload files or ingest integration data to build your knowledge base.
            </p>
          </div>
        ) : (
          <div className="space-y-1 px-1">
            {documents.map(doc => {
              const statusConf = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusConf.icon;
              const SourceIcon = SOURCE_ICONS[doc.source_type] || FileText;

              return (
                <div
                  key={doc.id}
                  className="group flex items-start gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <SourceIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{doc.name}</span>
                      <StatusIcon className={`h-3 w-3 shrink-0 ${statusConf.color} ${doc.status === 'processing' ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>{doc.chunk_count} chunks</span>
                      <span>·</span>
                      <span>{(doc.char_count / 1000).toFixed(0)}K chars</span>
                      <span>·</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                        {doc.source_type}
                      </Badge>
                    </div>
                    {doc.error_message && (
                      <p className="text-[10px] text-destructive mt-0.5 truncate">{doc.error_message}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteDocument(doc.id, doc.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                    title="Remove document"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
