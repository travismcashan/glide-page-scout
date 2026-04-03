import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { autoIngestIntegrations } from '@/lib/ragIngest';
import { BrandLoader } from '@/components/BrandLoader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Database, RefreshCw, CheckCircle, AlertCircle, FileText, Mail, Phone, Calendar, StickyNote, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Site = {
  id: string;
  domain: string;
  status: string;
  created_at: string;
};

type KnowledgeDoc = {
  id: string;
  session_id: string;
  name: string;
  source_type: string;
  source_key: string | null;
  status: string;
  chunk_count: number;
  char_count: number;
  created_at: string;
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  integration: <Database className="h-3.5 w-3.5" />,
  upload: <FileText className="h-3.5 w-3.5" />,
  scrape: <Globe className="h-3.5 w-3.5" />,
  screenshot: <Globe className="h-3.5 w-3.5" />,
};

const STATUS_STYLES: Record<string, string> = {
  ready: 'bg-green-500/15 text-green-400',
  pending: 'bg-yellow-500/15 text-yellow-400',
  processing: 'bg-blue-500/15 text-blue-400',
  error: 'bg-red-500/15 text-red-400',
};

type Props = {
  companyId: string;
  companyName: string;
  sites: Site[];
};

export function CompanyKnowledgeTab({ companyId, companyName, sites }: Props) {
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

  const sessionIds = sites.map(s => s.id);

  const fetchDocuments = useCallback(async () => {
    if (sessionIds.length === 0) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('id, session_id, name, source_type, source_key, status, chunk_count, char_count, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false });

    if (!error && data) setDocuments(data as KnowledgeDoc[]);
    setLoading(false);
  }, [sessionIds.join(',')]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleSyncAll = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncProgress({ current: 0, total: sites.length });

    let totalIngested = 0;

    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      setSyncProgress({ current: i + 1, total: sites.length });

      try {
        // Fetch session data
        const { data: session } = await supabase
          .from('crawl_sessions')
          .select('*')
          .eq('id', site.id)
          .single();

        if (!session) continue;

        const result = await autoIngestIntegrations(site.id, session as any);
        totalIngested += result.ingested;
      } catch (err) {
        console.error(`[companyKnowledge] Failed to sync ${site.domain}:`, err);
      }
    }

    setSyncing(false);
    setSyncProgress(null);
    await fetchDocuments();

    if (totalIngested > 0) {
      toast.success(`Synced ${totalIngested} documents across ${sites.length} sites`);
    } else {
      toast.info('All documents already up to date');
    }
  };

  // Group documents by site
  const docsBySite = new Map<string, KnowledgeDoc[]>();
  for (const doc of documents) {
    const existing = docsBySite.get(doc.session_id) || [];
    existing.push(doc);
    docsBySite.set(doc.session_id, existing);
  }

  const totalChunks = documents.reduce((sum, d) => sum + d.chunk_count, 0);
  const readyCount = documents.filter(d => d.status === 'ready').length;
  const pendingCount = documents.filter(d => d.status === 'pending' || d.status === 'processing').length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><BrandLoader size={48} /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5" /> Company Knowledge Base
          </h3>
          <p className="text-sm text-muted-foreground">
            {documents.length} documents &middot; {totalChunks} chunks &middot; {sites.length} sites indexed
          </p>
        </div>
        <Button
          onClick={handleSyncAll}
          disabled={syncing || sites.length === 0}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing {syncProgress?.current}/{syncProgress?.total}...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" /> Sync All Sites
            </>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{readyCount}</p>
          <p className="text-xs text-muted-foreground">Ready</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold">{totalChunks}</p>
          <p className="text-xs text-muted-foreground">Chunks</p>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No sites linked to this company yet. Analyze a site to start building the knowledge base.
        </div>
      ) : (
        /* Documents grouped by site */
        <div className="space-y-4">
          {sites.map(site => {
            const siteDocs = docsBySite.get(site.id) || [];
            return (
              <Card key={site.id} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{site.domain}</span>
                  <Badge variant="secondary" className="text-[10px] py-0">{siteDocs.length} docs</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{format(new Date(site.created_at), 'MMM d, yyyy')}</span>
                </div>
                {siteDocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">No documents indexed yet. Click "Sync All Sites" to index.</p>
                ) : (
                  <div className="space-y-1 pl-6">
                    {siteDocs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2 text-xs py-1">
                        <span className="text-muted-foreground shrink-0">{SOURCE_ICONS[doc.source_type] || <FileText className="h-3.5 w-3.5" />}</span>
                        <span className="truncate flex-1">{doc.name}</span>
                        <Badge variant="secondary" className={`text-[10px] py-0 shrink-0 ${STATUS_STYLES[doc.status] || ''}`}>
                          {doc.status}
                        </Badge>
                        <span className="text-muted-foreground/60 shrink-0">{doc.chunk_count} chunks</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
