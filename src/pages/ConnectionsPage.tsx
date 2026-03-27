import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, Plug, Trash2, Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const OAUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-exchange`;
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

type Connection = {
  id: string;
  provider: string;
  provider_email: string;
  token_expires_at: string;
  scopes: string;
  created_at: string;
  updated_at: string;
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function ConnectionsPage() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const apiHeaders = {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'list' }),
      });
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const connectGmail = async () => {
    setConnecting(true);
    try {
      // 1. Get client ID
      const configRes = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'get-config' }),
      });
      const { clientId } = await configRes.json();
      if (!clientId) throw new Error('Could not get Google config');

      // 2. Load Google Identity Services
      await loadScript('https://accounts.google.com/gsi/client');

      // 3. Use authorization code flow (not implicit) for refresh tokens
      const code = await new Promise<string>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: GMAIL_SCOPE,
          ux_mode: 'popup',
          callback: (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve(response.code);
          },
        });
        client.requestCode();
      });

      // 4. Exchange code for tokens on the server
      const exchangeRes = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'exchange',
          code,
          redirectUri: window.location.origin,
          provider: 'gmail',
        }),
      });
      const result = await exchangeRes.json();
      if (!exchangeRes.ok) throw new Error(result.message || result.error);

      // 5. Refresh the list
      await fetchConnections();
    } catch (err: any) {
      console.error('Gmail connect error:', err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnectConnection = async (id: string) => {
    setDisconnecting(id);
    try {
      await fetch(OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'disconnect', id }),
      });
      // Also clear legacy localStorage token
      try { localStorage.removeItem('gmail-access-token'); } catch {}
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setDisconnecting(null);
    }
  };

  const gmailConnection = connections.find(c => c.provider === 'gmail');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/integrations')}>
              Integrations
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              History
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-muted-foreground text-sm">
            Connect your accounts once — they stay active across all scans. No more re-authenticating every session.
          </p>
        </div>

        <div className="space-y-4">
          {/* Gmail Connection */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Gmail</span>
                    {gmailConnection ? (
                      <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-600/10 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {gmailConnection
                      ? `Signed in as ${gmailConnection.provider_email}`
                      : 'Read-only access to search email threads for prospect intelligence'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {gmailConnection ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={connectGmail}
                      disabled={connecting}
                      className="text-xs"
                    >
                      {connecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Reconnect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnectConnection(gmailConnection.id)}
                      disabled={disconnecting === gmailConnection.id}
                      className="text-destructive hover:text-destructive text-xs"
                    >
                      {disconnecting === gmailConnection.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={connectGmail}
                    disabled={connecting}
                  >
                    {connecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                    Connect Gmail
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Placeholder for future connections */}
          <div className="text-center py-8 text-muted-foreground/50 text-sm">
            More connections coming soon — Google Drive, HubSpot CRM, and more.
          </div>
        </div>
      </main>
    </div>
  );
}
