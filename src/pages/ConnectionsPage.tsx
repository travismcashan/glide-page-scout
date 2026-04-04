import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, HardDrive, Plug, Trash2, Loader2, RefreshCw, CheckCircle2, AlertCircle, BarChart3, Search, ChevronDown, Building2, BookOpen, Brain, Globe, Gauge, Leaf, Cpu, Users, MessageCircle, Eye, Zap, Key, Hash, Clock, CheckSquare, Waves, ArrowRight, ArrowDown, ArrowLeftRight, Radio, Upload, Headphones, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { BrandLoader } from '@/components/BrandLoader';
import QuickBooksImportDialog from '@/components/connections/QuickBooksImportDialog';

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

  // QuickBooks import dialog
  const [qbDialogOpen, setQbDialogOpen] = useState(false);

  // Global Sync state
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [sourceSyncing, setSourceSyncing] = useState<string | null>(null);
  const [artifactSyncing, setArtifactSyncing] = useState<string | null>(null);
  const [artifactProgress, setArtifactProgress] = useState<string>('');

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

  // Handle Slack OAuth redirect callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slackCode = params.get('code');
    const slackState = params.get('state');
    if (!slackCode || slackState !== 'slack-oauth') return;

    // Clean URL immediately
    window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      setConnectingProvider('slack');
      try {
        // The redirect_uri must match exactly what was sent to Slack
        const redirectUri = window.location.origin + window.location.pathname;
        const res = await fetch(SLACK_OAUTH_URL, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({ action: 'exchange', code: slackCode, redirectUri }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Exchange failed');
        console.log('Slack connected:', result);
        await fetchConnections();
      } catch (err) {
        console.error('Slack OAuth exchange error:', err);
      } finally {
        setConnectingProvider(null);
      }
    })();
  }, [fetchConnections]);

  const connectSlack = async () => {
    setConnectingProvider('slack');
    try {
      const res = await fetch(SLACK_OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'get-config' }),
      });
      const { clientId, error } = await res.json();
      if (!clientId) throw new Error(error || 'Could not get Slack config');

      const redirectUri = window.location.origin + window.location.pathname;
      const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&user_scope=search:read&redirect_uri=${encodeURIComponent(redirectUri)}&state=slack-oauth`;
      window.location.href = slackAuthUrl;
    } catch (err) {
      console.error('Slack connect error:', err);
      setConnectingProvider(null);
    }
  };

  const disconnectSlack = async (id: string) => {
    setDisconnecting(id);
    try {
      await fetch(SLACK_OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'disconnect', id }),
      });
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Slack disconnect error:', err);
    } finally {
      setDisconnecting(null);
    }
  };

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

  const handleGlobalSync = async () => {
    setGlobalSyncing(true);
    setSyncResult(null);
    try {
      // Get current user ID for the sync
      const userRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-exchange`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'get-config' }),
      });
      // We need the actual Supabase user ID
      const { data: { user } } = await (await import('@/integrations/supabase/client')).supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/global-sync`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'sync', userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      setSyncResult(data.summary);
      const { created, updated } = data.summary;
      if (created > 0 || updated > 0) {
        toast.success(`Sync complete: ${created} created, ${updated} updated`);
      } else {
        toast.info('Everything is already in sync');
      }
    } catch (err: any) {
      console.error('Global sync error:', err);
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setGlobalSyncing(false);
    }
  };

  const handleSourceSync = async (sourceId: string) => {
    setSourceSyncing(sourceId);
    try {
      const { data: { user } } = await (await import('@/integrations/supabase/client')).supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/global-sync`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'sync', userId: user.id, sources: [sourceId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      const { created, updated } = data.summary;
      const label = { hubspot: 'HubSpot', harvest: 'Harvest', freshdesk: 'Freshdesk' }[sourceId] || sourceId;
      if (created > 0 || updated > 0) {
        toast.success(`${label} sync: ${created} created, ${updated} updated`);
      } else {
        toast.info(`${label} already in sync`);
      }
    } catch (err: any) {
      console.error(`Source sync error (${sourceId}):`, err);
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSourceSyncing(null);
    }
  };

  const handleArtifactSync = async (source: string) => {
    const fnName = `${source}-sync`;
    const label = { hubspot: 'HubSpot', harvest: 'Harvest', freshdesk: 'Freshdesk' }[source] || source;
    setArtifactSyncing(source);
    setArtifactProgress(`Connecting to ${label}...`);
    try {
      const { data: { user } } = await (await import('@/integrations/supabase/client')).supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      setArtifactProgress(`Fetching ${label} data from API...`);
      toast.info(`${label} sync started — pulling data from API...`, { duration: 3000 });

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      setArtifactProgress('');
      const parts: string[] = [];
      for (const [key, val] of Object.entries(data.results || {})) {
        const v = typeof val === 'number' ? val : (val as any);
        const count = typeof v === 'number' ? v : ((v?.created || 0) + (v?.updated || 0) || v || 0);
        if (count > 0) parts.push(`${key}: ${count}`);
      }
      if (parts.length > 0) {
        toast.success(`✅ ${label} artifacts synced — ${parts.join(', ')}`, { duration: 6000 });
      } else {
        toast.info(`${label} — no new artifacts found`);
      }
    } catch (err: any) {
      console.error(`Artifact sync error (${source}):`, err);
      toast.error(`${label} artifact sync failed: ${err.message}`, { duration: 8000 });
      setArtifactProgress('');
    } finally {
      setArtifactSyncing(null);
      setArtifactProgress('');
    }
  };

  const handleSyncAllArtifacts = async () => {
    // Split into small per-artifact calls to avoid edge function timeout (150s)
    const steps = [
      { fn: 'hubspot-sync', label: 'HubSpot Contacts', artifacts: ['contacts'] },
      { fn: 'hubspot-sync', label: 'HubSpot Deals', artifacts: ['deals'] },
      { fn: 'hubspot-sync', label: 'HubSpot Engagements', artifacts: ['engagements'] },
      { fn: 'harvest-sync', label: 'Harvest Projects', artifacts: ['projects'] },
      { fn: 'harvest-sync', label: 'Harvest Time Entries', artifacts: ['time_entries'] },
      { fn: 'harvest-sync', label: 'Harvest Invoices', artifacts: ['invoices'] },
      { fn: 'harvest-sync', label: 'Harvest Contacts', artifacts: ['contacts'] },
      { fn: 'freshdesk-sync', label: 'Freshdesk Tickets', artifacts: ['tickets'] },
      { fn: 'freshdesk-sync', label: 'Freshdesk Contacts', artifacts: ['contacts'] },
    ];
    const total = steps.length;

    try {
      const { data: { user } } = await (await import('@/integrations/supabase/client')).supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const pct = Math.round(((i) / total) * 100);
        setArtifactSyncing(step.fn.replace('-sync', ''));
        setArtifactProgress(`${pct}% — Step ${i + 1}/${total}: ${step.label}...`);

        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${step.fn}`, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({ userId: user.id, artifacts: step.artifacts }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Sync failed');

          const parts: string[] = [];
          for (const [key, val] of Object.entries(data.results || {})) {
            const v = typeof val === 'number' ? val : (val as any);
            const count = typeof v === 'number' ? v : ((v?.created || 0) + (v?.updated || 0) || v || 0);
            if (count > 0) parts.push(`${key}: ${count}`);
          }
          const detail = parts.length ? ` — ${parts.join(', ')}` : '';
          toast.success(`[${i + 1}/${total}] ${step.label} done${detail}`, { duration: 4000 });
        } catch (err: any) {
          console.error(`Artifact sync error (${step.fn} ${step.artifacts}):`, err);
          toast.error(`[${i + 1}/${total}] ${step.label} failed: ${err.message}`, { duration: 6000 });
          // Continue to next step even if one fails
        }
      }
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    }

    setArtifactSyncing(null);
    setArtifactProgress('');
    toast.success('All artifact syncs complete!', { duration: 6000 });
  };

  const gmailConnection = connections.find(c => c.provider === 'gmail');
  const driveConnection = connections.find(c => c.provider === 'google-drive');
  const notebooklmConnection = connections.find(c => c.provider === 'google-notebooklm');
  const ga4Connection = connections.find(c => c.provider === 'google-analytics');
  const gscConnection = connections.find(c => c.provider === 'google-search-console');
  const slackConnection = connections.find(c => c.provider === 'slack');

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
  ];

  const rowProps = {
    connectingProvider, disconnecting, pickerProvider, pickerProperties,
    pickerLoading, savingProperty, connectProvider, loadProperties,
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
            The nervous system of Agency Brain. Every source of truth wired in and flowing continuously.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <BrandLoader size={48} />
          </div>
        ) : (<>
        {/* ── Synced Connections ── */}
        <div className="mb-8">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground tracking-tight">Synced</h2>
              <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">Two-way</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Read and write back. These connections keep Agency Brain in sync with your operational tools.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            {[
              { id: 'harvest', name: 'Harvest', icon: Clock, iconBg: 'bg-orange-500/10', iconColor: 'text-orange-500', healthKey: 'harvest', desc: 'Time tracking, projects, and client billing' },
              { id: 'asana', name: 'Asana', icon: CheckSquare, iconBg: 'bg-purple-500/10', iconColor: 'text-purple-500', healthKey: 'asana', desc: 'Project management and delivery tracking' },
              { id: 'hubspot', name: 'HubSpot', icon: Building2, iconBg: 'bg-orange-500/10', iconColor: 'text-orange-600', healthKey: 'hubspot', desc: 'Contacts, deals, pipeline, and engagements' },
              { id: 'freshdesk', name: 'Freshdesk', icon: Headphones, iconBg: 'bg-green-500/10', iconColor: 'text-green-600', healthKey: 'freshdesk', desc: 'Support tickets, companies, and client history' },
              { id: 'quickbooks', name: 'QuickBooks', icon: Receipt, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600', healthKey: null, desc: 'Invoicing history and client billing records' },
            ].map(stream => {
              const status = apiStatus(stream.healthKey);
              const isQB = stream.id === 'quickbooks';
              return (
                <Card key={stream.id} className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`h-9 w-9 rounded-lg ${stream.iconBg} flex items-center justify-center`}>
                      <stream.icon className={`h-4.5 w-4.5 ${stream.iconColor}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{stream.name}</span>
                        {isQB ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-600/10 text-[10px] py-0">
                            <Upload className="h-2.5 w-2.5 mr-0.5" />
                            CSV
                          </Badge>
                        ) : status === 'active' ? (
                          <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-600/10 text-[10px] py-0">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                            Live
                          </Badge>
                        ) : status === 'inactive' ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-600/10 text-[10px] py-0">
                            <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                            Offline
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px] py-0">
                            <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{stream.desc}</p>
                  {isQB ? (
                    <Button size="sm" variant="outline" className="mt-2 w-full text-xs gap-1.5" onClick={() => setQbDialogOpen(true)}>
                      <Upload className="h-3 w-3" /> Import CSV
                    </Button>
                  ) : ['harvest', 'hubspot', 'freshdesk'].includes(stream.id) && status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full text-xs gap-1.5"
                      disabled={sourceSyncing === stream.id || globalSyncing}
                      onClick={() => handleSourceSync(stream.id)}
                    >
                      {sourceSyncing === stream.id ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Syncing...</>
                      ) : (
                        <><RefreshCw className="h-3 w-3" /> Sync {stream.name}</>
                      )}
                    </Button>
                  ) : null}
                </Card>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGlobalSync}
              disabled={globalSyncing}
              className="gap-2"
              size="sm"
            >
              {globalSyncing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Syncing streams...</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Sync &amp; Backfill Clients</>
              )}
            </Button>
            {syncResult && (
              <span className="text-xs text-muted-foreground">
                {syncResult.created > 0 && <span className="text-green-500 font-medium">{syncResult.created} created</span>}
                {syncResult.created > 0 && syncResult.updated > 0 && <span> &middot; </span>}
                {syncResult.updated > 0 && <span className="text-blue-400 font-medium">{syncResult.updated} updated</span>}
                {syncResult.matched?.domain > 0 && <span> &middot; {syncResult.matched.domain} matched by domain</span>}
                {syncResult.matched?.name > 0 && <span> &middot; {syncResult.matched.name} matched by name</span>}
                {' '}&middot; Companies: {syncResult.sources?.hubspot || 0} HubSpot, {syncResult.sources?.harvest || 0} Harvest, {syncResult.sources?.freshdesk || 0} Freshdesk &middot; Linked: {syncResult.sources?.asana || 0} Asana projects
              </span>
            )}
          </div>
          {syncResult?.details?.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                Show {syncResult.details.length} sync details
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
                {syncResult.details.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{d.name}</span>
                      {d.domain && <span className="text-muted-foreground shrink-0">{d.domain}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {d.sources?.map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-[10px] py-0">{s}</Badge>
                      ))}
                      {d.action === 'created' ? (
                        <Badge variant="outline" className="text-green-500 border-green-500/30 text-[10px] py-0">New</Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-400 border-blue-400/30 text-[10px] py-0">Updated</Badge>
                      )}
                      {d.hasActiveProject && (
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px] py-0">Active</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Artifact Sync */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Sync artifacts (contacts, deals, tickets, projects, time entries, invoices) for all mapped companies:</p>
            {artifactProgress && (
              <div className="mb-2 flex items-center gap-2 text-sm text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                <span>{artifactProgress}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="default"
                disabled={!!artifactSyncing || globalSyncing}
                onClick={handleSyncAllArtifacts}
                className="gap-1.5"
              >
                {artifactSyncing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing All...</>
                ) : (
                  <><RefreshCw className="h-3.5 w-3.5" /> Sync All Artifacts</>
                )}
              </Button>
              {[
                { id: 'hubspot', label: 'HubSpot', desc: 'Contacts, Deals, Engagements' },
                { id: 'harvest', label: 'Harvest', desc: 'Projects, Time, Invoices' },
                { id: 'freshdesk', label: 'Freshdesk', desc: 'Tickets, Conversations' },
              ].map(s => (
                <Button
                  key={s.id}
                  size="sm"
                  variant="outline"
                  disabled={!!artifactSyncing || globalSyncing}
                  onClick={() => handleArtifactSync(s.id)}
                  className="gap-1.5"
                >
                  {artifactSyncing === s.id ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {s.label}...</>
                  ) : (
                    <><ArrowDown className="h-3.5 w-3.5" /> {s.label}</>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Live Connections ── */}
        <div className="mb-8">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-foreground tracking-tight">Live</h2>
              <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">Real-time</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              The AI queries these APIs on-demand during conversation. No stale data, no re-crawl needed.
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

        {/* ── Backfill / Account Access ── */}
        <div className="mb-8">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-foreground tracking-tight">Backfill</h2>
              <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">Import</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Import historical data into the knowledge base. OAuth accounts for document access, plus CSV/PDF/URL uploads.
            </p>
          </div>
          <div className="space-y-3">
            {accountAccess.map((p) => <ProviderRow key={p.id} p={p} {...rowProps} />)}
            {/* Slack — uses its own OAuth, not Google */}
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-[#4A154B]/10 flex items-center justify-center">
                    <Hash className="h-5 w-5 text-[#4A154B]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Slack</span>
                      {slackConnection ? (
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
                      {slackConnection
                        ? <>Signed in as {slackConnection.provider_email}{(slackConnection.provider_config as any)?.team_name ? ` in ${(slackConnection.provider_config as any).team_name}` : ''}</>
                        : 'Search Slack messages and import conversations into the knowledge base'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {slackConnection ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={connectSlack}
                        disabled={connectingProvider === 'slack'}
                        className="text-xs"
                      >
                        {connectingProvider === 'slack' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Reconnect
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => disconnectSlack(slackConnection.id)}
                        disabled={disconnecting === slackConnection.id}
                        className="text-destructive hover:text-destructive text-xs"
                      >
                        {disconnecting === slackConnection.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={connectSlack}
                      disabled={connectingProvider === 'slack'}
                    >
                      {connectingProvider === 'slack' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Hash className="h-3 w-3 mr-1" />}
                      Connect Slack
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ── Static Connections ── */}
        <div className="mb-8">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-foreground tracking-tight">Static</h2>
              <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">One-way read</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pull data and store it. Fire-and-forget API integrations managed via server secrets.
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
      <QuickBooksImportDialog open={qbDialogOpen} onOpenChange={setQbDialogOpen} />
    </div>
  );
}
