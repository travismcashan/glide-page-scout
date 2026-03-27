import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Mail, HardDrive, Plug, Trash2, Loader2, RefreshCw, CheckCircle2, AlertCircle, BarChart3, Search, ChevronDown } from 'lucide-react';

const OAUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-exchange`;
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

type Connection = {
  id: string;
  provider: string;
  provider_email: string;
  token_expires_at: string;
  scopes: string;
  created_at: string;
  updated_at: string;
  provider_config?: { propertyId: string; propertyName: string } | null;
};

type PropertyOption = {
  id: string;
  name: string;
  account?: string;
  permissionLevel?: string;
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

const apiHeaders = {
  'Content-Type': 'application/json',
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

type ProviderDef = {
  id: string;
  name: string;
  scope: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  description: string;
  connection?: Connection;
  hasPropertyPicker: boolean;
  propertyLabel?: string;
};

function ProviderRow({ p, connectingProvider, disconnecting, pickerProvider, pickerProperties, pickerLoading, savingProperty, connectProvider, loadProperties, saveProperty, disconnectConnection, setPickerProvider }: {
  p: ProviderDef;
  connectingProvider: string | null;
  disconnecting: string | null;
  pickerProvider: string | null;
  pickerProperties: PropertyOption[];
  pickerLoading: boolean;
  savingProperty: boolean;
  connectProvider: (provider: string, scope: string) => Promise<void>;
  loadProperties: (provider: string) => Promise<void>;
  saveProperty: (provider: string, propertyId: string, propertyName: string) => Promise<void>;
  disconnectConnection: (id: string) => Promise<void>;
  setPickerProvider: (v: string | null) => void;
}) {
  const Icon = p.icon;
  const conn = p.connection;
  const isConnecting = connectingProvider === p.id;
  const isDisconnecting = disconnecting === conn?.id;
  const isPickerOpen = pickerProvider === p.id;
  const selectedProperty = conn?.provider_config as { propertyId: string; propertyName: string } | undefined;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-4">
          <div className={`h-10 w-10 rounded-lg ${p.iconBg} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${p.iconColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{p.name}</span>
              {conn ? (
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
              {conn ? (
                <>
                  Signed in as {conn.provider_email}
                  {p.hasPropertyPicker && selectedProperty && (
                    <span className="ml-1.5 text-foreground font-medium">
                      · {selectedProperty.propertyName}
                    </span>
                  )}
                  {p.hasPropertyPicker && !selectedProperty && (
                    <span className="ml-1.5 text-amber-600 font-medium">
                      · No {p.propertyLabel?.toLowerCase()} selected
                    </span>
                  )}
                </>
              ) : p.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conn ? (
            <>
              {p.hasPropertyPicker && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => isPickerOpen ? setPickerProvider(null) : loadProperties(p.id)}
                  disabled={pickerLoading && isPickerOpen}
                  className="text-xs"
                >
                  {pickerLoading && isPickerOpen ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <ChevronDown className="h-3 w-3 mr-1" />
                  )}
                  {selectedProperty ? 'Change' : 'Select'} {p.propertyLabel}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => connectProvider(p.id, p.scope)}
                disabled={isConnecting}
                className="text-xs"
              >
                {isConnecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Reconnect
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnectConnection(conn.id)}
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive text-xs"
              >
                {isDisconnecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => connectProvider(p.id, p.scope)}
              disabled={isConnecting}
            >
              {isConnecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Icon className="h-3 w-3 mr-1" />}
              Connect {p.name}
            </Button>
          )}
        </div>
      </div>

      {conn && isPickerOpen && (
        <div className="border-t border-border bg-muted/30 px-5 py-4">
          <p className="text-xs text-muted-foreground mb-3">
            Select which {p.propertyLabel?.toLowerCase()} to use for scans. Only data from the selected {p.propertyLabel?.toLowerCase()} will be fetched.
          </p>
          {pickerLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading available {p.propertyLabel?.toLowerCase()}s...
            </div>
          ) : pickerProperties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No {p.propertyLabel?.toLowerCase()}s found for this account.</p>
          ) : (
            <div className="space-y-2">
              {pickerProperties.map((prop) => {
                const isSelected = selectedProperty?.propertyId === prop.id;
                return (
                  <button
                    key={prop.id}
                    onClick={() => !isSelected && saveProperty(p.id, prop.id, prop.name)}
                    disabled={savingProperty}
                    className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors text-sm ${
                      isSelected
                        ? 'border-primary/50 bg-primary/5 text-foreground'
                        : 'border-border bg-card hover:bg-accent/50 text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{prop.name}</span>
                        {prop.account && (
                          <span className="text-muted-foreground ml-2 text-xs">({prop.account})</span>
                        )}
                        {prop.permissionLevel && (
                          <span className="text-muted-foreground ml-2 text-xs">{prop.permissionLevel}</span>
                        )}
                      </div>
                      {isSelected && (
                        <Badge variant="outline" className="text-primary border-primary/30 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{prop.id}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ConnectionsPage() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Property picker state
  const [pickerProvider, setPickerProvider] = useState<string | null>(null);
  const [pickerProperties, setPickerProperties] = useState<PropertyOption[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [savingProperty, setSavingProperty] = useState(false);

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

  const connectProvider = async (provider: string, scope: string) => {
    setConnectingProvider(provider);
    try {
      const configRes = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'get-config' }),
      });
      const { clientId } = await configRes.json();
      if (!clientId) throw new Error('Could not get Google config');

      await loadScript('https://accounts.google.com/gsi/client');

      const code = await new Promise<string>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope,
          ux_mode: 'popup',
          callback: (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve(response.code);
          },
        });
        client.requestCode();
      });

      const exchangeRes = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'exchange',
          code,
          redirectUri: window.location.origin,
          provider,
        }),
      });
      const result = await exchangeRes.json();
      if (!exchangeRes.ok) throw new Error(result.message || result.error);

      await fetchConnections();

      // If the provider returned available properties, show the picker
      if (result.needsPropertySelection && result.availableProperties?.length) {
        setPickerProvider(provider);
        setPickerProperties(result.availableProperties);
      }
    } catch (err: any) {
      console.error(`${provider} connect error:`, err);
    } finally {
      setConnectingProvider(null);
    }
  };

  const loadProperties = async (provider: string) => {
    setPickerLoading(true);
    setPickerProvider(provider);
    try {
      const res = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'list-properties', provider }),
      });
      const data = await res.json();
      setPickerProperties(data.properties || []);
    } catch (err) {
      console.error('Failed to load properties:', err);
    } finally {
      setPickerLoading(false);
    }
  };

  const saveProperty = async (provider: string, propertyId: string, propertyName: string) => {
    setSavingProperty(true);
    try {
      await fetch(OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'set-property', provider, propertyId, propertyName }),
      });
      await fetchConnections();
      setPickerProvider(null);
      setPickerProperties([]);
    } catch (err) {
      console.error('Failed to save property:', err);
    } finally {
      setSavingProperty(false);
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
      try {
        localStorage.removeItem('gmail-access-token');
        localStorage.removeItem('google-drive-access-token');
        localStorage.removeItem('google-drive-access-token-expires-at');
      } catch {}
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setDisconnecting(null);
    }
  };

  const gmailConnection = connections.find(c => c.provider === 'gmail');
  const driveConnection = connections.find(c => c.provider === 'google-drive');
  const ga4Connection = connections.find(c => c.provider === 'google-analytics');
  const gscConnection = connections.find(c => c.provider === 'google-search-console');

  const liveSources = [
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      scope: GA4_SCOPE,
      icon: BarChart3,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
      description: 'Read-only access to GA4 traffic, engagement, and conversion data',
      connection: ga4Connection,
      hasPropertyPicker: true,
      propertyLabel: 'GA4 Property',
    },
    {
      id: 'google-search-console',
      name: 'Search Console',
      scope: GSC_SCOPE,
      icon: Search,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
      description: 'Read-only access to search queries, impressions, clicks, and indexing data',
      connection: gscConnection,
      hasPropertyPicker: true,
      propertyLabel: 'Site',
    },
  ];

  const accountAccess = [
    {
      id: 'gmail',
      name: 'Gmail',
      scope: GMAIL_SCOPE,
      icon: Mail,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
      description: 'Read-only access to search email threads for prospect intelligence',
      connection: gmailConnection,
      hasPropertyPicker: false,
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      scope: DRIVE_SCOPES,
      icon: HardDrive,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      description: 'Import documents, spreadsheets, and files into the knowledge base',
      connection: driveConnection,
      hasPropertyPicker: false,
    },
  ];

  const rowProps = {
    connectingProvider, disconnecting, pickerProvider, pickerProperties,
    pickerLoading, savingProperty, connectProvider, loadProperties,
    saveProperty, disconnectConnection, setPickerProvider,
  };

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

        {/* Live Sources */}
        <div className="mb-8">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Live Sources</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The AI queries these in real-time during chat — no need to re-crawl.
            </p>
          </div>
          <div className="space-y-3">
            {liveSources.map((p) => <ProviderRow key={p.id} p={p} {...rowProps} />)}
          </div>
        </div>

        {/* Account Access */}
        <div className="mb-8">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Account Access</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Used for importing and crawling data into your knowledge base.
            </p>
          </div>
          <div className="space-y-3">
            {accountAccess.map((p) => <ProviderRow key={p.id} p={p} {...rowProps} />)}
          </div>
        </div>

        <div className="text-center py-4 text-muted-foreground/50 text-sm">
          More connections coming soon — HubSpot CRM, Slack, and more.
        </div>
      </main>
    </div>
  );
}
