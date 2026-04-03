import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { autoIngestIntegrations } from '@/lib/ragIngest';
import { BrandLoader } from '@/components/BrandLoader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Database, RefreshCw, CheckCircle, AlertCircle, FileText, Mail, Phone, Calendar, StickyNote, Globe, Loader2, HardDrive, MessageSquare, Search, Download } from 'lucide-react';
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
  gdrive: <HardDrive className="h-3.5 w-3.5" />,
  slack: <MessageSquare className="h-3.5 w-3.5" />,
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

  // Google Drive state
  const [driveSearching, setDriveSearching] = useState(false);
  const [driveResults, setDriveResults] = useState<{ id: string; name: string; mimeType: string; modifiedTime: string }[]>([]);
  const [driveIngesting, setDriveIngesting] = useState<Set<string>>(new Set());
  const [driveIngested, setDriveIngested] = useState<Set<string>>(new Set());

  // Slack state
  const [slackSearching, setSlackSearching] = useState(false);
  const [slackResults, setSlackResults] = useState<{ id: string; text: string; username: string; channel: string; date: string | null; permalink: string }[]>([]);
  const [slackIngesting, setSlackIngesting] = useState(false);
  const [slackIngested, setSlackIngested] = useState(false);

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

  // Google Drive: search for company-related docs
  const handleDriveSearch = async () => {
    setDriveSearching(true);
    setDriveResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-list', {
        body: { searchQuery: companyName },
      });
      if (error) throw error;
      if (data?.error === 'drive_auth_required') {
        toast.error('Google Drive is not connected. Go to Connections to set it up.');
        setDriveSearching(false);
        return;
      }
      const files = (data?.files || []).filter((f: any) =>
        f.mimeType !== 'application/vnd.google-apps.folder'
      );
      setDriveResults(files);
      if (files.length === 0) toast.info('No Drive documents found for this company.');
      else toast.success(`Found ${files.length} documents in Google Drive`);
    } catch (err) {
      console.error('[knowledge] Drive search failed:', err);
      toast.error('Google Drive search failed');
    }
    setDriveSearching(false);
  };

  // Google Drive: download + ingest a single doc
  const handleDriveIngest = async (file: { id: string; name: string; mimeType: string }) => {
    if (!sessionIds[0]) { toast.error('No session to ingest into'); return; }
    setDriveIngesting(prev => new Set([...prev, file.id]));
    try {
      // Download content
      const { data: dlData, error: dlError } = await supabase.functions.invoke('google-drive-download', {
        body: { fileId: file.id },
      });
      if (dlError) throw dlError;
      const content = dlData?.content || dlData?.text || '';
      if (!content || content.length < 30) {
        toast.error(`${file.name}: no readable content`);
        setDriveIngesting(prev => { const n = new Set(prev); n.delete(file.id); return n; });
        return;
      }

      // Register as knowledge document on the first session
      const targetSessionId = sessionIds[0];
      const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ingest`;

      // Create document record
      const { data: doc } = await supabase
        .from('knowledge_documents')
        .insert({
          session_id: targetSessionId,
          name: `Google Drive: ${file.name}`,
          source_type: 'gdrive',
          source_key: `gdrive:${file.id}`,
          status: 'pending',
          chunk_count: 0,
          char_count: content.length,
        })
        .select('id')
        .single();

      if (!doc) throw new Error('Failed to create document record');

      // Send to rag-ingest
      await fetch(INGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          session_id: targetSessionId,
          documents: [{ document_id: doc.id, content: content.slice(0, 30_000) }],
        }),
      });

      setDriveIngested(prev => new Set([...prev, file.id]));
      toast.success(`Indexed: ${file.name}`);
      fetchDocuments();
    } catch (err) {
      console.error('[knowledge] Drive ingest failed:', err);
      toast.error(`Failed to index ${file.name}`);
    }
    setDriveIngesting(prev => { const n = new Set(prev); n.delete(file.id); return n; });
  };

  // Slack: search for messages about company
  const handleSlackSearch = async () => {
    setSlackSearching(true);
    setSlackResults([]);
    setSlackIngested(false);
    try {
      const { data, error } = await supabase.functions.invoke('slack-search', {
        body: { query: companyName, count: 30 },
      });
      if (error) throw error;
      if (data?.error === 'slack_auth_required') {
        toast.error('Slack is not connected. Go to Connections to set it up.');
        setSlackSearching(false);
        return;
      }
      if (data?.error) throw new Error(data.error);
      setSlackResults(data?.messages || []);
      if (!data?.messages?.length) toast.info('No Slack messages found for this company.');
      else toast.success(`Found ${data.messages.length} Slack messages (${data.total} total)`);
    } catch (err) {
      console.error('[knowledge] Slack search failed:', err);
      toast.error('Slack search failed. Check your connection in Settings.');
    }
    setSlackSearching(false);
  };

  // Slack: ingest all results as one knowledge document
  const handleSlackIngest = async () => {
    if (!sessionIds[0] || slackResults.length === 0) return;
    setSlackIngesting(true);
    try {
      const content = slackResults.map(msg => {
        const date = msg.date ? new Date(msg.date).toLocaleString() : '';
        return `[${date}] #${msg.channel} @${msg.username}: ${msg.text}`;
      }).join('\n\n');

      const targetSessionId = sessionIds[0];
      const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ingest`;

      const { data: doc } = await supabase
        .from('knowledge_documents')
        .insert({
          session_id: targetSessionId,
          name: `Slack: ${companyName} messages (${slackResults.length})`,
          source_type: 'slack',
          source_key: `slack:${companyName}:${Date.now()}`,
          status: 'pending',
          chunk_count: 0,
          char_count: content.length,
        })
        .select('id')
        .single();

      if (!doc) throw new Error('Failed to create document record');

      await fetch(INGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          session_id: targetSessionId,
          documents: [{ document_id: doc.id, content: content.slice(0, 30_000) }],
        }),
      });

      setSlackIngested(true);
      toast.success(`Indexed ${slackResults.length} Slack messages`);
      fetchDocuments();
    } catch (err) {
      console.error('[knowledge] Slack ingest failed:', err);
      toast.error('Failed to index Slack messages');
    }
    setSlackIngesting(false);
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

      {/* External Sources */}
      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Search className="h-4 w-4" /> External Sources
        </h4>
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Google Drive */}
          <div className="border border-border/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Google Drive</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Search Drive for docs about "{companyName}" and index them.</p>
            <Button onClick={handleDriveSearch} disabled={driveSearching} variant="outline" size="sm" className="w-full gap-2">
              {driveSearching ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...</> : <><Search className="h-3.5 w-3.5" /> Search Drive</>}
            </Button>
            {driveResults.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                {driveResults.map(file => (
                  <div key={file.id} className="flex items-center gap-2 text-xs">
                    <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    {driveIngested.has(file.id) ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    ) : (
                      <Button
                        onClick={() => handleDriveIngest(file)}
                        disabled={driveIngesting.has(file.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs shrink-0"
                      >
                        {driveIngesting.has(file.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  onClick={() => driveResults.filter(f => !driveIngested.has(f.id)).forEach(f => handleDriveIngest(f))}
                  disabled={driveResults.every(f => driveIngested.has(f.id))}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs"
                >
                  Index All ({driveResults.filter(f => !driveIngested.has(f.id)).length} remaining)
                </Button>
              </div>
            )}
          </div>

          {/* Slack */}
          <div className="border border-border/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Slack</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Search Slack for messages about "{companyName}" and index them.</p>
            <Button onClick={handleSlackSearch} disabled={slackSearching} variant="outline" size="sm" className="w-full gap-2">
              {slackSearching ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...</> : <><Search className="h-3.5 w-3.5" /> Search Slack</>}
            </Button>
            {slackResults.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                {slackResults.slice(0, 10).map((msg, i) => (
                  <div key={msg.id || i} className="text-xs p-1.5 rounded bg-muted/30">
                    <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                      <span className="font-medium">#{msg.channel}</span>
                      <span>&middot;</span>
                      <span>@{msg.username}</span>
                      {msg.date && <span className="ml-auto text-[10px]">{new Date(msg.date).toLocaleDateString()}</span>}
                    </div>
                    <p className="line-clamp-2">{msg.text}</p>
                  </div>
                ))}
                {slackResults.length > 10 && (
                  <p className="text-[10px] text-muted-foreground text-center">+ {slackResults.length - 10} more messages</p>
                )}
                {slackIngested ? (
                  <div className="flex items-center justify-center gap-1 text-xs text-green-400 mt-2">
                    <CheckCircle className="h-3.5 w-3.5" /> Indexed
                  </div>
                ) : (
                  <Button
                    onClick={handleSlackIngest}
                    disabled={slackIngesting}
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 text-xs"
                  >
                    {slackIngesting ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Indexing...</> : `Index All ${slackResults.length} Messages`}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

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
