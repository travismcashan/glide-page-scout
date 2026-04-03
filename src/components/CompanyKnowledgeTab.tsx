import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { autoIngestIntegrations } from '@/lib/ragIngest';
import {
  getConnectedFolders, connectFolder, disconnectFolder, syncFolder,
  type ConnectedFolder, type SyncProgress,
} from '@/lib/driveFolderSync';
import { ConnectFolderDialog } from '@/components/company/ConnectFolderDialog';
import { BrandLoader } from '@/components/BrandLoader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Database, RefreshCw, CheckCircle, FileText, Globe, Loader2,
  HardDrive, MessageSquare, Search, FolderOpen, Plus, Trash2, Clock,
  Briefcase, Users as UsersIcon, FolderSync,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

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
  'google-drive': <HardDrive className="h-3.5 w-3.5" />,
  gdrive: <HardDrive className="h-3.5 w-3.5" />,
  slack: <MessageSquare className="h-3.5 w-3.5" />,
};

const STATUS_STYLES: Record<string, string> = {
  ready: 'bg-green-500/15 text-green-400',
  pending: 'bg-yellow-500/15 text-yellow-400',
  processing: 'bg-blue-500/15 text-blue-400',
  error: 'bg-red-500/15 text-red-400',
};

const LABEL_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  sales: { icon: <Briefcase className="h-3 w-3" />, color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  client: { icon: <UsersIcon className="h-3 w-3" />, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  general: { icon: <FolderOpen className="h-3 w-3" />, color: 'bg-muted text-muted-foreground border-border' },
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

  // Connected folders (Streams)
  const [folders, setFolders] = useState<ConnectedFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [folderSyncProgress, setFolderSyncProgress] = useState<Record<string, SyncProgress>>({});
  const [syncingFolderId, setSyncingFolderId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Slack state
  const [slackSearching, setSlackSearching] = useState(false);
  const [slackResults, setSlackResults] = useState<{ id: string; text: string; username: string; channel: string; date: string | null; permalink: string }[]>([]);
  const [slackIngesting, setSlackIngesting] = useState(false);
  const [slackIngested, setSlackIngested] = useState(false);

  // Auto-sync guard
  const autoSyncRan = useRef(false);

  const sessionIds = sites.map(s => s.id);
  const primarySessionId = sessionIds[0] || null;

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

  // Fetch connected folders
  const fetchFolders = useCallback(async () => {
    const data = await getConnectedFolders(companyId);
    setFolders(data);
    setFoldersLoading(false);
  }, [companyId]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  // Auto-sync stale folders on mount (1 hour staleness)
  useEffect(() => {
    if (autoSyncRan.current || foldersLoading || !primarySessionId || folders.length === 0) return;
    autoSyncRan.current = true;

    const staleFolders = folders.filter(f => {
      if (!f.is_enabled || f.sync_status === 'syncing') return false;
      if (!f.last_synced_at) return true;
      return Date.now() - new Date(f.last_synced_at).getTime() > 3600_000;
    });

    if (staleFolders.length === 0) return;

    (async () => {
      for (const folder of staleFolders) {
        await syncFolder(primarySessionId, folder, (p) => {
          setFolderSyncProgress(prev => ({ ...prev, [folder.id]: p }));
        });
      }
      fetchFolders();
      fetchDocuments();
    })();
  }, [foldersLoading, folders.length, primarySessionId]);

  const handleSyncAll = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncProgress({ current: 0, total: sites.length });

    let totalIngested = 0;

    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      setSyncProgress({ current: i + 1, total: sites.length });
      try {
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

  const handleConnectFolder = async (folderId: string, folderName: string, folderPath: string, label: string) => {
    const folder = await connectFolder(companyId, folderId, folderName, folderPath, label);
    if (!folder) { toast.error('Failed to connect folder'); return; }
    toast.success(`Connected "${folderName}"`);
    await fetchFolders();

    if (primarySessionId) {
      setSyncingFolderId(folder.id);
      const result = await syncFolder(primarySessionId, folder, (p) => {
        setFolderSyncProgress(prev => ({ ...prev, [folder.id]: p }));
      });
      setSyncingFolderId(null);
      await fetchFolders();
      await fetchDocuments();
      if (result.ingested > 0) toast.success(`Indexed ${result.ingested} documents from "${folderName}"`);
      else if (!result.error) toast.info(`No new documents found in "${folderName}"`);
    }
  };

  const handleSyncFolder = async (folder: ConnectedFolder) => {
    if (!primarySessionId) { toast.error('No session available'); return; }
    setSyncingFolderId(folder.id);
    const result = await syncFolder(primarySessionId, folder, (p) => {
      setFolderSyncProgress(prev => ({ ...prev, [folder.id]: p }));
    });
    setSyncingFolderId(null);
    await fetchFolders();
    await fetchDocuments();
    if (result.ingested > 0) toast.success(`Synced ${result.ingested} new documents from "${folder.folder_name}"`);
    else if (result.error) toast.error(`Sync failed: ${result.error}`);
    else toast.info(`"${folder.folder_name}" is up to date`);
  };

  const handleDisconnect = async (folder: ConnectedFolder) => {
    setDisconnectingId(folder.id);
    const ok = await disconnectFolder(folder.id);
    setDisconnectingId(null);
    if (ok) { toast.success(`Disconnected "${folder.folder_name}"`); fetchFolders(); }
    else toast.error('Failed to disconnect');
  };

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

  const handleSlackIngest = async () => {
    if (!primarySessionId || slackResults.length === 0) return;
    setSlackIngesting(true);
    try {
      const content = slackResults.map(msg => {
        const date = msg.date ? new Date(msg.date).toLocaleString() : '';
        return `[${date}] #${msg.channel} @${msg.username}: ${msg.text}`;
      }).join('\n\n');

      const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ingest`;

      const { data: doc } = await supabase
        .from('knowledge_documents')
        .insert({
          session_id: primarySessionId,
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
          session_id: primarySessionId,
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
            <Database className="h-5 w-5" /> Agency Brain
          </h3>
          <p className="text-sm text-muted-foreground">
            {documents.length} documents &middot; {totalChunks} chunks &middot; {sites.length} sites &middot; {folders.length} streams
          </p>
        </div>
        <Button onClick={handleSyncAll} disabled={syncing || sites.length === 0} variant="outline" size="sm" className="gap-2">
          {syncing ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Syncing {syncProgress?.current}/{syncProgress?.total}...</>
          ) : (
            <><RefreshCw className="h-4 w-4" /> Sync All Sites</>
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

      {/* Connected Folders (Streams) */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FolderSync className="h-4 w-4" /> Connected Streams
          </h4>
          <Button variant="outline" size="sm" onClick={() => setConnectDialogOpen(true)} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Folder
          </Button>
        </div>

        {foldersLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading streams...
          </div>
        ) : folders.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No folders connected yet</p>
            <p className="text-xs mt-1">Connect a Google Drive folder to continuously sync documents into Agency Brain</p>
          </div>
        ) : (
          <div className="space-y-2">
            {folders.map(folder => {
              const progress = folderSyncProgress[folder.id];
              const isSyncing = syncingFolderId === folder.id || folder.sync_status === 'syncing';
              const labelCfg = LABEL_CONFIG[folder.label] || LABEL_CONFIG.general;

              return (
                <div key={folder.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
                  <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{folder.folder_name}</span>
                      <Badge variant="outline" className={`text-[10px] py-0 ${labelCfg.color}`}>
                        {labelCfg.icon}
                        <span className="ml-1 capitalize">{folder.label}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      {folder.last_synced_at ? (
                        <>
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(folder.last_synced_at), { addSuffix: true })}
                          <span>&middot;</span>
                          <span>{folder.last_sync_file_count} files</span>
                        </>
                      ) : (
                        <span>Never synced</span>
                      )}
                      {isSyncing && progress && (
                        <span className="text-primary">
                          &middot; {progress.phase === 'listing' ? 'Listing files...' :
                            progress.phase === 'downloading' ? `${progress.filesProcessed}/${progress.filesNew} files` :
                            progress.phase === 'complete' ? 'Done' : progress.phase}
                        </span>
                      )}
                      {folder.sync_status === 'error' && folder.last_sync_error && (
                        <span className="text-destructive">&middot; {folder.last_sync_error}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleSyncFolder(folder)} disabled={isSyncing} className="h-7 w-7 p-0">
                      {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDisconnect(folder)} disabled={disconnectingId === folder.id} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                      {disconnectingId === folder.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ConnectFolderDialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen} onConnect={handleConnectFolder} />

      {/* Slack */}
      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Search className="h-4 w-4" /> External Sources
        </h4>
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
                <Button onClick={handleSlackIngest} disabled={slackIngesting} variant="outline" size="sm" className="w-full mt-2 text-xs">
                  {slackIngesting ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Indexing...</> : `Index All ${slackResults.length} Messages`}
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {sites.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No sites linked to this company yet. Analyze a site to start building the knowledge base.
        </div>
      ) : (
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
