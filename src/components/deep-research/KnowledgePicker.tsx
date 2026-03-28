import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Database, Loader2, Sparkles, FileText, Mail, Globe, MessageSquare, ChevronDown, ChevronUp, X, FolderOpen } from 'lucide-react';
import { KnowledgeBasePickerDialog } from './KnowledgeBasePickerDialog';

const RAG_SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-search`;

type KnowledgeDoc = {
  id: string;
  name: string;
  source_type: string;
  chunk_count: number;
  char_count: number;
  status: string;
};

type RagChunk = {
  document_name: string;
  source_type: string;
  chunk_text: string;
  similarity: number;
};

interface Props {
  sessionId: string;
  prompt: string;
  onKnowledgeChange: (docs: { name: string; content: string }[]) => void;
}

function sourceIcon(type: string) {
  switch (type) {
    case 'gmail': return <Mail className="h-3 w-3 text-red-500" />;
    case 'crawl': case 'page': return <Globe className="h-3 w-3 text-blue-500" />;
    case 'chat': return <MessageSquare className="h-3 w-3 text-purple-500" />;
    default: return <FileText className="h-3 w-3 text-muted-foreground" />;
  }
}

export function KnowledgePicker({ sessionId, prompt, onKnowledgeChange }: Props) {
  const [allDocs, setAllDocs] = useState<KnowledgeDoc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [ragChunks, setRagChunks] = useState<RagChunk[]>([]);
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoFetched, setAutoFetched] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [docChunksCache, setDocChunksCache] = useState<Record<string, string>>({});
  const [loadingDocChunks, setLoadingDocChunks] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch all knowledge documents for this session
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('knowledge_documents')
        .select('id, name, source_type, chunk_count, char_count, status')
        .eq('session_id', sessionId)
        .eq('status', 'ready')
        .order('source_type', { ascending: true });
      if (data) setAllDocs(data as KnowledgeDoc[]);
    })();
  }, [sessionId]);

  // Auto-fetch relevant RAG chunks based on prompt
  const autoFetchRelevant = useCallback(async () => {
    if (!prompt.trim() || autoFetched) return;
    setAutoFetching(true);
    try {
      const response = await fetch(RAG_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          query: prompt.slice(0, 2000),
          match_count: 50,
          match_threshold: 0.15,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setRagChunks(data.matches || []);
        setAutoFetched(true);
      }
    } catch (e) {
      console.error('RAG auto-fetch error:', e);
    } finally {
      setAutoFetching(false);
    }
  }, [sessionId, prompt, autoFetched]);

  // Fetch full content for a manually selected document
  const fetchDocContent = useCallback(async (docId: string) => {
    if (docChunksCache[docId]) return docChunksCache[docId];
    setLoadingDocChunks(prev => new Set(prev).add(docId));
    try {
      const { data } = await supabase
        .from('knowledge_chunks')
        .select('chunk_text, chunk_index')
        .eq('document_id', docId)
        .order('chunk_index', { ascending: true })
        .limit(100);
      const content = (data || []).map(c => c.chunk_text).join('\n\n');
      setDocChunksCache(prev => ({ ...prev, [docId]: content }));
      return content;
    } catch {
      return '';
    } finally {
      setLoadingDocChunks(prev => {
        const n = new Set(prev);
        n.delete(docId);
        return n;
      });
    }
  }, [docChunksCache]);

  // Toggle a document selection
  const toggleDoc = useCallback(async (docId: string) => {
    setSelectedDocIds(prev => {
      const n = new Set(prev);
      if (n.has(docId)) {
        n.delete(docId);
      } else {
        n.add(docId);
        fetchDocContent(docId);
      }
      return n;
    });
  }, [fetchDocContent]);

  // Remove a manually selected document
  const removeDoc = useCallback((docId: string) => {
    setSelectedDocIds(prev => {
      const n = new Set(prev);
      n.delete(docId);
      return n;
    });
  }, []);

  // Handle documents selected from the picker dialog
  const handlePickerSelection = useCallback((docs: { id: string; name: string }[]) => {
    setSelectedDocIds(prev => {
      const n = new Set(prev);
      for (const doc of docs) {
        n.add(doc.id);
        fetchDocContent(doc.id);
      }
      return n;
    });
  }, [fetchDocContent]);

  // Build the final docs array whenever selection or RAG chunks change
  useEffect(() => {
    const result: { name: string; content: string }[] = [];

    // 1. Auto-fetched RAG chunks (grouped by document_name)
    if (ragChunks.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const chunk of ragChunks) {
        const key = chunk.document_name;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(chunk.chunk_text);
      }
      for (const [name, texts] of Object.entries(grouped)) {
        result.push({ name: `[RAG] ${name}`, content: texts.join('\n\n') });
      }
    }

    // 2. Manually selected full documents
    for (const docId of selectedDocIds) {
      const doc = allDocs.find(d => d.id === docId);
      const content = docChunksCache[docId];
      if (doc && content) {
        result.push({ name: doc.name, content });
      }
    }

    onKnowledgeChange(result);
  }, [ragChunks, selectedDocIds, docChunksCache, allDocs, onKnowledgeChange]);

  const totalKnowledgeDocs = ragChunks.length > 0 || selectedDocIds.size > 0;
  const ragDocCount = new Set(ragChunks.map(c => c.document_name)).size;

  // Get names of selected docs for the pill display
  const selectedDocNames = Array.from(selectedDocIds)
    .map(id => allDocs.find(d => d.id === id))
    .filter(Boolean) as KnowledgeDoc[];

  if (allDocs.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Knowledge Base</span>
          {totalKnowledgeDocs && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {ragDocCount > 0 ? `${ragDocCount} auto` : ''}{selectedDocIds.size > 0 ? `${ragDocCount > 0 ? ' + ' : ''}${selectedDocIds.size} manual` : ''}
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t px-3 py-3 space-y-3">
          {/* Auto-fetch RAG section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Auto-Retrieve Relevant Knowledge</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setAutoFetched(false); autoFetchRelevant(); }}
                disabled={autoFetching || !prompt.trim()}
                className="h-7 text-xs gap-1.5"
              >
                {autoFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {autoFetched ? 'Re-fetch' : 'Find Relevant'}
              </Button>
            </div>
            {autoFetched && ragChunks.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Found {ragChunks.length} relevant chunks from {ragDocCount} document{ragDocCount !== 1 ? 's' : ''}
              </p>
            )}
            {autoFetched && ragChunks.length === 0 && (
              <p className="text-xs text-muted-foreground">No relevant knowledge found for this prompt.</p>
            )}
          </div>

          {/* Manual selection with Browse button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Full Documents ({selectedDocIds.size} selected)
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                className="h-7 text-xs gap-1.5"
              >
                <FolderOpen className="h-3 w-3" />
                Browse
              </Button>
            </div>

            {/* Selected documents as removable pills */}
            {selectedDocNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedDocNames.map(doc => (
                  <Badge
                    key={doc.id}
                    variant="secondary"
                    className="text-xs gap-1 pr-1 max-w-[200px]"
                  >
                    {sourceIcon(doc.source_type)}
                    <span className="truncate">{doc.name}</span>
                    {loadingDocChunks.has(doc.id) ? (
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeDoc(doc.id); }}
                        className="ml-0.5 hover:text-destructive transition-colors shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            )}

            {/* Inline quick-pick list (collapsed by default if we have selected docs) */}
            {selectedDocNames.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Click "Browse" to select full documents from the knowledge base.
              </p>
            )}
          </div>
        </div>
      )}

      <KnowledgeBasePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        sessionId={sessionId}
        onDocumentsSelected={handlePickerSelection}
        alreadySelectedIds={selectedDocIds}
      />
    </div>
  );
}
