import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { FileText, Upload, Trash2, Loader2, Database, Globe, BookOpen, CheckCircle2, AlertCircle, Clock, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

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
};

const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ingest`;

const SOURCE_ICONS: Record<string, typeof FileText> = {
  integration: Database,
  upload: FileText,
  scrape: Globe,
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ready: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Indexed' },
  processing: { icon: Loader2, color: 'text-amber-500', label: 'Processing' },
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending' },
  error: { icon: AlertCircle, color: 'text-destructive', label: 'Error' },
};

export function DocumentLibrary({ sessionId, onDocumentCountChange }: Props) {
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
  }, [fetchDocuments]);

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
        const text = await file.text();
        docsToIngest.push({ name: file.name, content: text, source_type: 'upload' });
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
    <div className="flex flex-col h-full">
      {/* Header stats */}
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          <span><strong className="text-foreground">{readyCount}</strong> documents</span>
          <span>·</span>
          <span><strong className="text-foreground">{totalChunks}</strong> chunks indexed</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchDocuments} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Upload */}
      <div className="px-1 mb-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.pdf,.doc,.docx"
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
      <ScrollArea className="flex-1">
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
      </ScrollArea>
    </div>
  );
}
