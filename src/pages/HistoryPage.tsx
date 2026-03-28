import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Globe, Clock, Trash2, Share2, Database, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildSitePath } from '@/lib/sessionSlug';
import { format } from 'date-fns';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type CrawlSession = {
  id: string;
  domain: string;
  base_url: string;
  status: string;
  created_at: string;
};

/** Count non-null integration data columns */
const INTEGRATION_KEYS = [
  'psi_data','wappalyzer_data','builtwith_data','carbon_data','crux_data',
  'wave_data','observatory_data','ocean_data','ssllabs_data','httpstatus_data',
  'linkcheck_data','w3c_data','schema_data','readable_data','yellowlab_data',
  'semrush_data','nav_structure','content_types_data','page_tags','sitemap_data',
  'forms_data','tech_analysis_data','deep_research_data','observations_data',
  'avoma_data','apollo_data','hubspot_data','gmail_data','apollo_team_data',
  'ga4_data','search_console_data','detectzestack_data',
] as const;

export default function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<CrawlSession[]>([]);
  const [multiDomains, setMultiDomains] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrawlSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [integrationCounts, setIntegrationCounts] = useState<Map<string, number>>(new Map());
  const [docCounts, setDocCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('crawl_sessions')
        .select(`id, domain, base_url, status, created_at, ${INTEGRATION_KEYS.join(',')}`)
        .neq('domain', '__global_chat__')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load crawl history:', error);
        setError('Failed to load crawl history. Please refresh and try again.');
        setSessions([]);
      } else {
        const data_ = (data ?? []) as any[];
        setSessions(data_.map(d => ({ id: d.id, domain: d.domain, base_url: d.base_url, status: d.status, created_at: d.created_at })));
        
        const domainCounts = new Map<string, number>();
        const intCounts = new Map<string, number>();
        data_.forEach(s => {
          domainCounts.set(s.domain, (domainCounts.get(s.domain) ?? 0) + 1);
          let count = 0;
          for (const key of INTEGRATION_KEYS) {
            if (s[key] != null) count++;
          }
          intCounts.set(s.id, count);
        });
        setMultiDomains(domainCounts);
        setIntegrationCounts(intCounts);

        // Fetch knowledge document counts per session
        const sessionIds = data_.map(d => d.id);
        if (sessionIds.length > 0) {
          const { data: docs } = await supabase
            .from('knowledge_documents')
            .select('session_id')
            .in('session_id', sessionIds);
          const dCounts = new Map<string, number>();
          (docs ?? []).forEach(d => dCounts.set(d.session_id, (dCounts.get(d.session_id) ?? 0) + 1));
          setDocCounts(dCounts);
        }
      }

      setLoading(false);
    };

    fetchSessions();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const sid = deleteTarget.id;

    const deletes = await Promise.all([
      supabase.from('crawl_pages').delete().eq('session_id', sid),
      supabase.from('crawl_screenshots').delete().eq('session_id', sid),
      supabase.from('knowledge_chunks').delete().eq('session_id', sid),
      supabase.from('knowledge_documents').delete().eq('session_id', sid),
      supabase.from('knowledge_messages').delete().eq('session_id', sid),
      supabase.from('knowledge_favorites').delete().eq('session_id', sid),
      supabase.from('chat_threads').delete().eq('session_id', sid),
    ]);

    const childError = deletes.find(r => r.error);
    if (childError?.error) {
      console.error('Failed to delete related data:', childError.error);
      toast.error('Failed to delete crawl. Please try again.');
      setDeleting(false);
      setDeleteTarget(null);
      return;
    }

    const { error: sessionError } = await supabase.from('crawl_sessions').delete().eq('id', sid);
    if (sessionError) {
      console.error('Failed to delete session:', sessionError);
      toast.error('Failed to delete crawl session.');
    } else {
      setSessions(prev => {
        const next = prev.filter(s => s.id !== sid);
        const domainCounts = new Map<string, number>();
        next.forEach(s => domainCounts.set(s.domain, (domainCounts.get(s.domain) ?? 0) + 1));
        setMultiDomains(domainCounts);
        return next;
      });
      toast.success(`Deleted crawl for ${deleteTarget.domain}`);
    }

    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Crawl History</h1>

        {loading ? (
          <p className="py-16 text-center text-muted-foreground">Loading...</p>
        ) : error ? (
          <div className="py-16 text-center">
            <Globe className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground">No crawls yet. Start by entering a URL!</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40%]">Domain</TableHead>
                  <TableHead className="text-center">Integrations</TableHead>
                  <TableHead className="text-center">Files</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(buildSitePath(session.domain, session.created_at, (multiDomains.get(session.domain) ?? 0) > 1))}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate font-medium">{session.domain}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Database className="h-3 w-3" />
                        <span className="text-xs font-mono">{integrationCounts.get(session.id) ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span className="text-xs font-mono">{docCounts.get(session.id) ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        {format(new Date(session.created_at), 'MMM d, yyyy h:mm a')}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                        {session.status === 'analyzing'
                          ? (Date.now() - new Date(session.created_at).getTime() > 10 * 60 * 1000 ? 'completed' : 'analyzing')
                          : session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const path = buildSitePath(session.domain, session.created_at, (multiDomains.get(session.domain) ?? 0) > 1);
                            const url = `${window.location.origin}${path}?view=shared`;
                            navigator.clipboard.writeText(url);
                            toast.success('View-only link copied to clipboard');
                          }}
                          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Copy share link"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(session);
                          }}
                          className="p-1.5 rounded-md text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete crawl"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete crawl?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the crawl for <strong>{deleteTarget?.domain}</strong> and all associated data (pages, screenshots, chat history, knowledge documents). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
