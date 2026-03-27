import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildSitePath } from '@/lib/sessionSlug';
import { format } from 'date-fns';
import AppHeader from '@/components/AppHeader';

type CrawlSession = {
  id: string;
  domain: string;
  base_url: string;
  status: string;
  created_at: string;
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<CrawlSession[]>([]);
  const [multiDomains, setMultiDomains] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('crawl_sessions')
        .select('id, domain, base_url, status, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load crawl history:', error);
        setError('Failed to load crawl history. Please refresh and try again.');
        setSessions([]);
      } else {
        const data_ = (data ?? []) as CrawlSession[];
        setSessions(data_);
        const domainCounts = new Map<string, number>();
        data_.forEach(s => domainCounts.set(s.domain, (domainCounts.get(s.domain) ?? 0) + 1));
        setMultiDomains(domainCounts);
      }

      setLoading(false);
    };

    fetchSessions();
  }, []);

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
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer px-5 py-4 transition-colors hover:bg-muted/50"
                onClick={() => navigate(buildSitePath(session.domain, session.created_at, (multiDomains.get(session.domain) ?? 0) > 1))}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Globe className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{session.domain}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{session.base_url}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(session.created_at), 'MMM d, yyyy h:mm a')}
                    </div>
                    <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                      {session.status}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
