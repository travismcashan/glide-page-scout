import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, HardDrive, Plug, Trash2, Loader2, RefreshCw, CheckCircle2, AlertCircle, BarChart3, Search, ChevronDown, ChevronRight, Building2, BookOpen, Brain, Globe, Gauge, Leaf, Cpu, Users, MessageCircle, Eye, Zap, Key, Hash, Clock, CheckSquare, Waves, ArrowRight, ArrowDown, ArrowLeftRight, Radio, Upload, Headphones, Receipt, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { BrandLoader } from '@/components/BrandLoader';
import { getPausedIntegrations, toggleIntegrationPause, loadPausedIntegrations } from '@/lib/integrationState';
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

// ── Crawl Integrations (Static connections) ─────────────────────────────
type CrawlIntegration = {
  name: string;
  id: string;
  description: string;
  category: string;
  tier: 'free' | 'premium';
  hasCredits?: boolean;
};

const CRAWL_INTEGRATIONS: CrawlIntegration[] = [
  // URL Analysis
  { name: 'XML Sitemaps', id: 'sitemap', description: 'Parse XML sitemaps — discover indexed URLs and lastmod dates', category: 'URL Analysis', tier: 'free' },
  { name: 'URL Discovery', id: 'url-discovery', description: 'Firecrawl-powered sitemap mapping — discovers all pages on a domain', category: 'URL Analysis', tier: 'premium' },
  { name: 'httpstatus.io', id: 'httpstatus', description: 'HTTP redirect chain analysis — status codes, latency, TLS validity', category: 'URL Analysis', tier: 'premium' },
  // Content Analysis
  { name: 'Content Types', id: 'content-types', description: 'AI classifies URLs into content types (Blog, Product, Case Study, etc.)', category: 'Content Analysis', tier: 'free' },
  { name: 'Site Navigation', id: 'nav-structure', description: 'AI extraction of header navigation — hierarchical sitemap from the menu', category: 'Content Analysis', tier: 'free' },
  { name: 'Content Scraping', id: 'content', description: 'Extract markdown content from all business-relevant pages', category: 'Content Analysis', tier: 'premium' },
  { name: 'Readable.com', id: 'readable', description: 'Flesch-Kincaid readability scoring and grade-level analysis', category: 'Content Analysis', tier: 'premium' },
  // Design Analysis
  { name: 'Page Templates', id: 'auto-tag-pages', description: 'AI template classification — Custom, Template, or Toolkit badges', category: 'Design Analysis', tier: 'free' },
  { name: 'Screenshots', id: 'screenshots', description: 'Full-page screenshots of key template pages (5–15 layouts)', category: 'Design Analysis', tier: 'free' },
  // Technology Detection
  { name: 'BuiltWith', id: 'builtwith', description: 'Technology stack detection with historical data', category: 'Technology', tier: 'premium', hasCredits: true },
  { name: 'DetectZeStack', id: 'detectzestack', description: 'Technology detection via RapidAPI — 100 free lookups/month', category: 'Technology', tier: 'premium' },
  { name: 'AI Tech Analysis', id: 'tech-analysis', description: 'Merged analysis of all tech sources — platform, risks, redesign recommendations', category: 'Technology', tier: 'free' },
  // Performance & Sustainability
  { name: 'GTmetrix', id: 'gtmetrix', description: 'Lighthouse performance audits and Web Vitals', category: 'Performance', tier: 'premium' },
  { name: 'Google PageSpeed Insights', id: 'psi', description: 'Mobile & desktop Lighthouse scores and Core Web Vitals', category: 'Performance', tier: 'free' },
  { name: 'Chrome UX Report (CrUX)', id: 'crux', description: 'Real-user 28-day rolling Core Web Vitals from Chrome browsers', category: 'Performance', tier: 'free' },
  { name: 'Yellow Lab Tools', id: 'yellowlab', description: 'Front-end quality audit — page weight, DOM, JS, CSS, fonts', category: 'Performance', tier: 'free' },
  { name: 'Website Carbon', id: 'carbon', description: 'CO₂ footprint per page load', category: 'Performance', tier: 'free' },
  // SEO & Search
  { name: 'SEMrush', id: 'semrush', description: 'Domain overview, organic keywords, and backlinks', category: 'SEO', tier: 'premium' },
  { name: 'Schema.org Validator', id: 'schema', description: 'Structured data analysis (JSON-LD, Microdata, RDFa)', category: 'SEO', tier: 'free' },
  // UX & Accessibility
  { name: 'Lighthouse Accessibility', id: 'psi-accessibility', description: 'Accessibility score and audits from Lighthouse', category: 'Accessibility', tier: 'free' },
  { name: 'WAVE (WebAIM)', id: 'wave', description: 'WCAG accessibility audit — errors, contrast, ARIA', category: 'Accessibility', tier: 'premium' },
  { name: 'W3C Validator', id: 'w3c', description: 'HTML & CSS validation against W3C standards', category: 'Accessibility', tier: 'free' },
  // Security & Compliance
  { name: 'Mozilla Observatory', id: 'observatory', description: 'Security header analysis — CSP, HSTS, X-Frame-Options', category: 'Security', tier: 'free' },
  { name: 'SSL Labs', id: 'ssllabs', description: 'Deep SSL/TLS assessment — certificate chain, protocol support', category: 'Security', tier: 'free' },
  // Competitive Intelligence
  { name: 'Gemini Deep Research', id: 'deep-research', description: 'Autonomous multi-step research agent — competitive analysis and reports', category: 'Intelligence', tier: 'premium' },
  { name: 'Avoma', id: 'avoma', description: 'Call intelligence — match meetings by attendee email domain', category: 'Intelligence', tier: 'premium' },
  // Enrichment & Prospecting
  { name: 'HubSpot Lookup', id: 'hubspot', description: 'Pull contacts, companies, and deals during domain crawl', category: 'Enrichment', tier: 'premium' },
  { name: 'Ocean.io', id: 'ocean', description: 'Company firmographics and lookalike search', category: 'Enrichment', tier: 'premium' },
  { name: 'Apollo.io', id: 'apollo', description: 'Contact enrichment — LinkedIn, titles, phone numbers (275M+ contacts)', category: 'Enrichment', tier: 'premium' },
];

const CRAWL_CATEGORIES = ['URL Analysis', 'Content Analysis', 'Design Analysis', 'Technology', 'Performance', 'SEO', 'Accessibility', 'Security', 'Intelligence', 'Enrichment'];

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

  // Crawl integrations state
  const [crawlExpanded, setCrawlExpanded] = useState(false);
  const [pausedSet, setPausedSet] = useState(() => getPausedIntegrations());
  const [crawlUsage, setCrawlUsage] = useState<Map<string, { done: number; failed: number }>>(new Map());

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

  // Load crawl integration paused state + usage counts
  useEffect(() => {
    loadPausedIntegrations().then(setPausedSet);
    import('@/integrations/supabase/client').then(({ supabase }) => supabase.from('integration_runs').select('integration_key, status')).then(({ data }) => {
      if (!data) return;
      const counts = new Map<string, { done: number; failed: number }>();
      data.forEach(r => {
        const c = counts.get(r.integration_key) ?? { done: 0, failed: 0 };
        if (r.status === 'done') c.done++;
        if (r.status === 'failed') c.failed++;
        counts.set(r.integration_key, c);
      });
      setCrawlUsage(counts);
    });
  }, []);

  const handleCrawlToggle = async (id: string) => {
    await toggleIntegrationPause(id);
    setPausedSet(getPausedIntegrations());
  };

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

  const crawlActiveCount = CRAWL_INTEGRATIONS.filter(i => !pausedSet.has(i.id)).length;
  const crawlPausedCount = CRAWL_INTEGRATIONS.filter(i => pausedSet.has(i.id)).length;

  // ── Operational tools config ──
  const operationalTools = [
    { id: 'hubspot', name: 'HubSpot', icon: Building2, iconBg: 'bg-orange-500/10', iconColor: 'text-orange-600', healthKey: 'hubspot', desc: 'Contacts, deals, pipeline, and engagements', badges: ['Synced', 'Live'] },
    { id: 'harvest', name: 'Harvest', icon: Clock, iconBg: 'bg-orange-500/10', iconColor: 'text-orange-500', healthKey: 'harvest', desc: 'Time tracking, projects, and client billing', badges: ['Synced'] },
    { id: 'freshdesk', name: 'Freshdesk', icon: Headphones, iconBg: 'bg-green-500/10', iconColor: 'text-green-600', healthKey: 'freshdesk', desc: 'Support tickets, companies, and client history', badges: ['Synced'] },
    { id: 'asana', name: 'Asana', icon: CheckSquare, iconBg: 'bg-purple-500/10', iconColor: 'text-purple-500', healthKey: 'asana', desc: 'Project management and delivery tracking', badges: ['Synced'] },
    { id: 'quickbooks', name: 'QuickBooks', icon: Receipt, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600', healthKey: null as string | null, desc: 'Invoicing history and client billing records', badges: ['CSV Import'] },
  ];

  // ── Account connections config ──
  type AccountDef = { id: string; name: string; icon: any; iconBg: string; iconColor: string; desc: string; connection?: Connection; scope?: string; isSlack?: boolean; hasPropertyPicker?: boolean; propertyLabel?: string };
  const accountConnections: AccountDef[] = [
    { id: 'gmail', name: 'Gmail', icon: Mail, iconBg: 'bg-destructive/10', iconColor: 'text-destructive', desc: 'Search email threads for prospect intelligence', connection: gmailConnection, scope: GMAIL_SCOPE },
    { id: 'google-drive', name: 'Google Drive', icon: HardDrive, iconBg: 'bg-primary/10', iconColor: 'text-primary', desc: 'Import documents and files into the knowledge base', connection: driveConnection, scope: DRIVE_SCOPES },
    { id: 'slack', name: 'Slack', icon: Hash, iconBg: 'bg-[#4A154B]/10', iconColor: 'text-[#4A154B]', desc: 'Search and import Slack messages into the knowledge base', connection: slackConnection, isSlack: true },
    { id: 'google-analytics', name: 'Google Analytics', icon: BarChart3, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-600', desc: 'Website traffic, user behavior, and conversion analytics', connection: ga4Connection, scope: GA4_SCOPE, hasPropertyPicker: true, propertyLabel: 'Property' },
    { id: 'google-search-console', name: 'Search Console', icon: Search, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-600', desc: 'Search performance, impressions, clicks, and indexing status', connection: gscConnection, scope: GSC_SCOPE, hasPropertyPicker: true, propertyLabel: 'Property' },
    { id: 'google-notebooklm', name: 'NotebookLM', icon: BookOpen, iconBg: 'bg-violet-500/10', iconColor: 'text-violet-600', desc: 'Export knowledge base documents to Google NotebookLM', connection: notebooklmConnection, scope: NOTEBOOKLM_SCOPE },
  ];

  return (
    <div>
      <main className="px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <BrandLoader size={48} />
          </div>
        ) : (<>

        {/* ═══ Section 1: Operational Tools ═══ */}
        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-1">Operational Tools</h2>
          <p className="text-muted-foreground mb-4">The tools you use daily to run the business. Two-way sync keeps the brain current.</p>

          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {operationalTools.map(tool => {
              const status = apiStatus(tool.healthKey);
              const isQB = tool.id === 'quickbooks';
              const canSync = ['harvest', 'hubspot', 'freshdesk'].includes(tool.id) && status === 'active';
              return (
                <div key={tool.id} className="flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`h-11 w-11 rounded-xl ${tool.iconBg} flex items-center justify-center shrink-0`}>
                      <tool.icon className={`h-5 w-5 ${tool.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-semibold text-base">{tool.name}</span>
                        {isQB ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-600/10 text-xs py-0.5">
                            <Upload className="h-3 w-3 mr-1" /> CSV
                          </Badge>
                        ) : status === 'active' ? (
                          <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-600/10 text-xs py-0.5">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                          </Badge>
                        ) : status === 'inactive' ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-600/10 text-xs py-0.5">
                            <AlertCircle className="h-3 w-3 mr-1" /> Offline
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs py-0.5">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Checking
                          </Badge>
                        )}
                        {tool.badges.map(b => (
                          <Badge key={b} variant="secondary" className="text-xs py-0.5">{b}</Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{tool.desc}</p>
                    </div>
                  </div>
                  <div className="shrink-0 ml-4">
                    {isQB ? (
                      <Button variant="outline" size="sm" onClick={() => setQbDialogOpen(true)} className="gap-2">
                        <Upload className="h-4 w-4" /> Import
                      </Button>
                    ) : canSync ? (
                      <Button variant="outline" size="sm" disabled={sourceSyncing === tool.id || globalSyncing} onClick={() => handleSourceSync(tool.id)} className="gap-2">
                        {sourceSyncing === tool.id ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Syncing...</>
                        ) : (
                          <><RefreshCw className="h-4 w-4" /> Sync</>
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sync actions */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <Button onClick={handleGlobalSync} disabled={globalSyncing} className="gap-2">
              {globalSyncing ? <><Loader2 className="h-4 w-4 animate-spin" /> Syncing...</> : <><RefreshCw className="h-4 w-4" /> Sync All Sources</>}
            </Button>
            <Button variant="outline" disabled={!!artifactSyncing || globalSyncing} onClick={handleSyncAllArtifacts} className="gap-2">
              {artifactSyncing ? <><Loader2 className="h-4 w-4 animate-spin" /> Syncing Artifacts...</> : <><ArrowDown className="h-4 w-4" /> Sync All Artifacts</>}
            </Button>
            {syncResult && (
              <span className="text-sm text-muted-foreground">
                {syncResult.created > 0 && <span className="text-green-500 font-medium">{syncResult.created} created</span>}
                {syncResult.created > 0 && syncResult.updated > 0 && ' · '}
                {syncResult.updated > 0 && <span className="text-blue-400 font-medium">{syncResult.updated} updated</span>}
              </span>
            )}
          </div>
          {artifactProgress && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{artifactProgress}</span>
            </div>
          )}
          {syncResult?.details?.length > 0 && (
            <details className="mt-3">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                Show {syncResult.details.length} sync details
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
                {syncResult.details.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{d.name}</span>
                      {d.domain && <span className="text-muted-foreground shrink-0">{d.domain}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {d.sources?.map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-xs py-0.5">{s}</Badge>
                      ))}
                      {d.action === 'created' ? (
                        <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs py-0.5">New</Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-400 border-blue-400/30 text-xs py-0.5">Updated</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* ═══ Section 2: Accounts ═══ */}
        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-1">Accounts</h2>
          <p className="text-muted-foreground mb-4">OAuth-connected accounts that give the system access to your data.</p>

          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {accountConnections.map(acct => {
              const conn = acct.connection;
              const isConnected = !!conn;
              const isSlack = acct.isSlack;
              const isConnecting = connectingProvider === acct.id;
              const isDisconnecting = conn ? disconnecting === conn.id : false;

              return (
                <div key={acct.id} className="flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`h-11 w-11 rounded-xl ${acct.iconBg} flex items-center justify-center shrink-0`}>
                      <acct.icon className={`h-5 w-5 ${acct.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-base">{acct.name}</span>
                        {isConnected ? (
                          <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-600/10 text-xs py-0.5">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs py-0.5">
                            <AlertCircle className="h-3 w-3 mr-1" /> Not connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {isConnected && conn?.provider_email
                          ? <>Signed in as {conn.provider_email}{isSlack && (conn as any)?.provider_config?.team_name ? ` in ${(conn as any).provider_config.team_name}` : ''}</>
                          : acct.desc}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {isConnected ? (
                      <>
                        {acct.hasPropertyPicker && (
                          <Button variant="ghost" size="sm" onClick={() => loadProperties(acct.id)} disabled={pickerLoading && pickerProvider === acct.id}>
                            {pickerLoading && pickerProvider === acct.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                            {conn?.provider_config ? 'Change' : 'Select'} {acct.propertyLabel}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => isSlack ? connectSlack() : connectProvider(acct.id, acct.scope!)} disabled={isConnecting}>
                          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                          Reconnect
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => isSlack ? disconnectSlack(conn!.id) : disconnectConnection(conn!.id)} disabled={isDisconnecting} className="text-destructive hover:text-destructive">
                          {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => isSlack ? connectSlack() : connectProvider(acct.id, acct.scope!)} disabled={isConnecting} className="gap-2">
                        {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Property picker dropdown */}
          {pickerProvider && pickerProperties.length > 0 && (
            <Card className="mt-3 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Select Property</span>
                <Button variant="ghost" size="sm" onClick={() => { setPickerProvider(null); setPickerProperties([]); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {pickerProperties.map(p => (
                  <Button key={p.id} variant="ghost" className="w-full justify-start" disabled={savingProperty} onClick={() => saveProperty(pickerProvider, p.id, p.name)}>
                    {savingProperty ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                    {p.name}
                    {p.account && <span className="text-muted-foreground ml-2">({p.account})</span>}
                  </Button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ═══ Section 3: Site Analysis (Crawl Integrations) — Collapsible ═══ */}
        <div className="mb-10">
          <button onClick={() => setCrawlExpanded(!crawlExpanded)} className="w-full flex items-center justify-between mb-1 group cursor-pointer text-left">
            <div className="flex items-center gap-2.5">
              {crawlExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
              <h2 className="text-xl font-semibold">Site Analysis</h2>
              <Badge variant="secondary" className="text-sm py-0.5 px-2.5">{crawlActiveCount} active{crawlPausedCount > 0 && ` · ${crawlPausedCount} paused`}</Badge>
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {crawlExpanded ? 'Collapse' : 'Expand'}
            </span>
          </button>
          <p className="text-muted-foreground mb-4 ml-8">
            {CRAWL_INTEGRATIONS.length} integrations that run during website crawls and audits.
          </p>

          {crawlExpanded && (
            <div className="space-y-6">
              {CRAWL_CATEGORIES.map(cat => {
                const items = CRAWL_INTEGRATIONS.filter(i => i.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">{cat}</h3>
                    <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                      {items.map(integration => {
                        const isPaused = pausedSet.has(integration.id);
                        const usage = crawlUsage.get(integration.id);
                        return (
                          <div key={integration.id} className="flex items-center justify-between px-5 py-3.5 bg-card hover:bg-muted/30 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2.5">
                                <span className="font-medium text-base">{integration.name}</span>
                                <Badge variant="outline" className={`text-xs py-0.5 ${integration.tier === 'premium' ? 'border-primary/30 text-primary bg-primary/5' : 'border-accent/30 text-accent bg-accent/5'}`}>
                                  {integration.tier === 'premium' ? 'Premium' : 'Free'}
                                </Badge>
                                {usage && (
                                  <span className="text-sm text-muted-foreground">
                                    {usage.done} run{usage.done !== 1 ? 's' : ''}
                                    {usage.failed > 0 && <span className="text-destructive/70 ml-1">({usage.failed} failed)</span>}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">{integration.description}</p>
                            </div>
                            <Switch checked={!isPaused} onCheckedChange={() => handleCrawlToggle(integration.id)} className={`shrink-0 ${!isPaused ? 'data-[state=checked]:bg-green-500' : 'data-[state=unchecked]:bg-red-400'}`} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        </>)}
      </main>
      <QuickBooksImportDialog open={qbDialogOpen} onOpenChange={setQbDialogOpen} />
    </div>
  );
}
