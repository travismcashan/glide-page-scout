import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, HardDrive, Plug, Trash2, Loader2, RefreshCw, CheckCircle2, AlertCircle, BarChart3, Search, ChevronDown, Building2, BookOpen, Brain, Globe, Gauge, Leaf, Cpu, Users, MessageCircle, MessageSquare, Eye, Zap, Key } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { BrandLoader } from '@/components/BrandLoader';

const OAUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-exchange`;
const SLACK_OAUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-oauth-exchange`;
const EMAIL_SCOPE = 'email profile';
const GMAIL_SCOPE = `https://www.googleapis.com/auth/gmail.readonly ${EMAIL_SCOPE}`;
const DRIVE_SCOPES = `https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file ${EMAIL_SCOPE}`;
const GA4_SCOPE = `https://www.googleapis.com/auth/analytics.readonly ${EMAIL_SCOPE}`;
const GSC_SCOPE = `https://www.googleapis.com/auth/webmasters.readonly ${EMAIL_SCOPE}`;
const NOTEBOOKLM_SCOPE = `https://www.googleapis.com/auth/cloud-platform ${EMAIL_SCOPE}`;

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

type ApiStatus = 'active' | 'inactive' | 'unknown';

function ApiRow({ name, description, icon: Icon, iconBg, iconColor, status }: {
  name: string;
  description: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  status: ApiStatus;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`h-8 w-8 rounded-md ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div>
          <span className="text-sm font-medium">{name}</span>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {status === 'active' ? (
        <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-600/10 text-xs shrink-0">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Active
        </Badge>
      ) : status === 'inactive' ? (
        <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-600/10 text-xs shrink-0">
          <AlertCircle className="h-3 w-3 mr-1" />
          Not configured
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground text-xs shrink-0">
          Server-managed
        </Badge>
      )}
    </div>
  );
}

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
                <>Signed in as {conn.provider_email}</>
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
  const [hubspotConfigured, setHubspotConfigured] = useState<boolean | null>(null);
  const [apiHealthData, setApiHealthData] = useState<Record<string, boolean | null>>({});

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

  // Check all API key statuses
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-health`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({}),
        });
        const data = await res.json();
        const results = data.results ?? {};
        setHubspotConfigured(results.hubspot?.ok ?? false);
        const health: Record<string, boolean | null> = {};
        for (const [key, val] of Object.entries(results)) {
          health[key] = (val as any)?.ok ?? null;
        }
        setApiHealthData(health);
      } catch {
        setHubspotConfigured(false);
      }
    })();
  }, []);

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
  const notebooklmConnection = connections.find(c => c.provider === 'google-notebooklm');
  const slackConnection = connections.find(c => c.provider === 'slack');

  // Slack OAuth uses a redirect flow (not Google's inline code client)
  const connectSlack = async () => {
    setConnectingProvider('slack');
    try {
      const configRes = await fetch(SLACK_OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'get-config' }),
      });
      const { clientId, error } = await configRes.json();
      if (!clientId) throw new Error(error || 'SLACK_CLIENT_ID not configured');

      const redirectUri = `${window.location.origin}/connections`;
      const userScopes = 'search:read';
      const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=&user_scope=${encodeURIComponent(userScopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      // Open popup
      const popup = window.open(slackAuthUrl, 'slack-oauth', 'width=600,height=700');
      if (!popup) throw new Error('Popup blocked');

      // Poll for the code in the popup URL
      const pollInterval = setInterval(async () => {
        try {
          if (popup.closed) { clearInterval(pollInterval); setConnectingProvider(null); return; }
          const popupUrl = popup.location.href;
          if (popupUrl.includes('code=')) {
            clearInterval(pollInterval);
            popup.close();
            const url = new URL(popupUrl);
            const code = url.searchParams.get('code');
            if (!code) throw new Error('No code received');

            const exchangeRes = await fetch(SLACK_OAUTH_URL, {
              method: 'POST',
              headers: apiHeaders,
              body: JSON.stringify({ action: 'exchange', code, redirectUri }),
            });
            const result = await exchangeRes.json();
            if (!exchangeRes.ok || !result.success) throw new Error(result.error || 'Exchange failed');

            await fetchConnections();
          }
        } catch (e) {
          // Cross-origin errors are expected until redirect completes
        }
      }, 500);
    } catch (err: any) {
      console.error('Slack connect error:', err);
    } finally {
      setConnectingProvider(null);
    }
  };
  const ga4Connection = connections.find(c => c.provider === 'google-analytics');
  const gscConnection = connections.find(c => c.provider === 'google-search-console');

  const liveSources: ProviderDef[] = [];

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
    {
      id: 'google-notebooklm',
      name: 'NotebookLM',
      scope: NOTEBOOKLM_SCOPE,
      icon: BookOpen,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-600',
      description: 'Export knowledge base documents to Google NotebookLM notebooks',
      connection: notebooklmConnection,
      hasPropertyPicker: false,
    },
    {
      id: 'slack',
      name: 'Slack',
      scope: 'search:read',
      icon: MessageSquare,
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-600',
      description: 'Search Slack messages about companies and index them into the knowledge base',
      connection: slackConnection,
      hasPropertyPicker: false,
    },
  ];

  // Wrap connectProvider to route Slack through its own OAuth flow
  const connectProviderRouted = async (provider: string, scope: string) => {
    if (provider === 'slack') { connectSlack(); return; }
    connectProvider(provider, scope);
  };

  const rowProps = {
    connectingProvider, disconnecting, pickerProvider, pickerProperties,
    pickerLoading, savingProperty, connectProvider: connectProviderRouted, loadProperties,
    saveProperty, disconnectConnection, setPickerProvider,
  };

  const apiStatus = (key: string | null): ApiStatus => {
    if (!key) return 'unknown';
    const val = apiHealthData[key];
    if (val === null || val === undefined) return 'unknown';
    return val ? 'active' : 'inactive';
  };

  const API_GROUPS: { label: string; items: { id: string; name: string; description: string; icon: any; iconBg: string; iconColor: string; healthKey: string | null }[] }[] = [
    {
      label: 'AI',
      items: [
        { id: 'anthropic', name: 'Anthropic', description: 'Claude AI for analysis, chat, and generation across all features', icon: Brain, iconBg: 'bg-violet-500/10', iconColor: 'text-violet-600', healthKey: null },
      ],
    },
    {
      label: 'Crawling & Discovery',
      items: [
        { id: 'firecrawl', name: 'Firecrawl', description: 'Web crawling, URL discovery, and page content extraction', icon: Globe, iconBg: 'bg-orange-500/10', iconColor: 'text-orange-600', healthKey: null },
      ],
    },
    {
      label: 'Performance',
      items: [
        { id: 'psi', name: 'PageSpeed Insights', description: 'Google Lighthouse scores and Core Web Vitals', icon: Gauge, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-600', healthKey: 'psi' },
        { id: 'gtmetrix', name: 'GTmetrix', description: 'Waterfall analysis, performance grades, and load breakdown', icon: BarChart3, iconBg: 'bg-green-500/10', iconColor: 'text-green-600', healthKey: 'gtmetrix' },
        { id: 'carbon', name: 'Website Carbon', description: 'CO₂ emissions and sustainability ratings', icon: Leaf, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600', healthKey: 'carbon' },
      ],
    },
    {
      label: 'Technical Analysis',
      items: [
        { id: 'builtwith', name: 'BuiltWith', description: 'Technology stack and CMS/platform identification', icon: Cpu, iconBg: 'bg-slate-500/10', iconColor: 'text-slate-600', healthKey: 'builtwith' },
        { id: 'detectzestack', name: 'DetectZeStack', description: 'Additional tech stack fingerprinting and detection', icon: Zap, iconBg: 'bg-yellow-500/10', iconColor: 'text-yellow-600', healthKey: null },
      ],
    },
    {
      label: 'SEO',
      items: [
        { id: 'semrush', name: 'SEMrush', description: 'Keyword rankings, backlinks, and organic traffic intelligence', icon: Search, iconBg: 'bg-orange-500/10', iconColor: 'text-orange-500', healthKey: null },
      ],
    },
    {
      label: 'Accessibility & Quality',
      items: [
        { id: 'wave', name: 'WAVE', description: 'Accessibility errors, alerts, and contrast analysis', icon: Eye, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500', healthKey: null },
      ],
    },
    {
      label: 'Outreach & CRM',
      items: [
        { id: 'apollo', name: 'Apollo.io', description: 'Contact and company enrichment for prospect intelligence', icon: Users, iconBg: 'bg-indigo-500/10', iconColor: 'text-indigo-600', healthKey: null },
        { id: 'avoma', name: 'Avoma', description: 'Meeting recordings, transcripts, and conversation intelligence', icon: MessageCircle, iconBg: 'bg-purple-500/10', iconColor: 'text-purple-600', healthKey: null },
        { id: 'ocean', name: 'Ocean.io', description: 'Company lookalike search and firmographic enrichment', icon: Building2, iconBg: 'bg-cyan-500/10', iconColor: 'text-cyan-600', healthKey: null },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connect your accounts once — they stay active across all scans. No more re-authenticating every session.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <BrandLoader size={48} />
          </div>
        ) : (<>
        {/* Live Sources */}
        <div className="mb-8">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Live Sources</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The AI queries these in real-time during chat — no need to re-crawl. Google Analytics and Search Console connect per-site on the results page.
            </p>
          </div>
          <div className="space-y-3">
            {liveSources.map((p) => <ProviderRow key={p.id} p={p} {...rowProps} />)}
            {/* HubSpot — API key based, not OAuth */}
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">HubSpot CRM</span>
                      {hubspotConfigured === null ? (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Checking...
                        </Badge>
                      ) : hubspotConfigured ? (
                        <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-600/10 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Not configured
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hubspotConfigured
                        ? 'AI can query contacts, deals, MQLs, and pipeline data in real-time'
                        : 'Requires a HubSpot access token configured as a server secret'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
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

        {/* API Connections */}
        <div className="mb-8">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">API Connections</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Server-side API keys that power integrations. Managed via Supabase environment secrets.
            </p>
          </div>
          <Card className="p-0 overflow-hidden divide-y divide-border">
            {API_GROUPS.map((group, gi) => (
              <div key={group.label}>
                <div className="px-4 py-2 bg-muted/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
                </div>
                {group.items.map((item) => (
                  <ApiRow
                    key={item.id}
                    name={item.name}
                    description={item.description}
                    icon={item.icon}
                    iconBg={item.iconBg}
                    iconColor={item.iconColor}
                    status={apiStatus(item.healthKey)}
                  />
                ))}
              </div>
            ))}
          </Card>
        </div>
        </>)}
      </main>
    </div>
  );
}
