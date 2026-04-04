import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Building2, Users, Globe, MapPin, Mail, Phone, Linkedin, ExternalLink,
  ArrowLeft, Briefcase, Clock, TrendingUp, ChevronRight, DollarSign,
  MessageSquare, PhoneCall, Calendar, StickyNote, CheckSquare, Brain, Database,
  FileJson, ChevronDown, ChevronUp, RefreshCw, FolderOpen, Receipt, Headphones,
  Timer
} from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { supabase } from '@/integrations/supabase/client';
import { buildSitePath } from '@/lib/sessionSlug';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useProduct } from '@/contexts/ProductContext';
import { WORKSPACE_COMPANY_TABS } from '@/config/workspace-nav';
import { KnowledgeChatCard } from '@/components/KnowledgeChatCard';
import RoadmapTab from '@/components/roadmap/RoadmapTab';
import { CompanyKnowledgeTab } from '@/components/CompanyKnowledgeTab';
import { VERSIONS, type ModelProvider, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DEFAULT_BEST, DEFAULT_REASONING, persistResolvedChatSelection, resolveStoredChatSelection } from '@/lib/chatPreferences';
import { withQueryTimeout } from '@/lib/queryTimeout';

type Company = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: string | null;
  annual_revenue: string | null;
  location: string | null;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  status: string;
  enrichment_data: any;
  tags: string[];
  notes: string | null;
  created_at: string;
  hubspot_company_id: string | null;
  harvest_client_id: string | null;
  freshdesk_company_id: string | null;
};

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  seniority: string | null;
  role_type: string | null;
  is_primary: boolean;
  created_at: string;
};

type Site = {
  id: string;
  domain: string;
  base_url: string;
  status: string;
  created_at: string;
};

type Deal = {
  id: string;
  name: string;
  amount: number | null;
  stage: string | null;
  pipeline: string | null;
  close_date: string | null;
  status: string;
  created_at: string;
};

type Engagement = {
  id: string;
  engagement_type: string;
  subject: string | null;
  body_preview: string | null;
  direction: string | null;
  occurred_at: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  active: 'bg-green-500/15 text-green-400 border-green-500/20',
  past: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  archived: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

const SENIORITY_COLORS: Record<string, string> = {
  c_suite: 'bg-purple-500/15 text-purple-400',
  vp: 'bg-indigo-500/15 text-indigo-400',
  director: 'bg-blue-500/15 text-blue-400',
  manager: 'bg-teal-500/15 text-teal-400',
  senior: 'bg-green-500/15 text-green-400',
};

const COMPANY_CHAT_PREFIX = '__company_chat_';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProduct } = useProduct();
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [harvestProjects, setHarvestProjects] = useState<any[]>([]);
  const [harvestTimeEntries, setHarvestTimeEntries] = useState<any[]>([]);
  const [harvestInvoices, setHarvestInvoices] = useState<any[]>([]);
  const [freshdeskTickets, setFreshdeskTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Artifact on-demand fetching state
  const [artifactLoading, setArtifactLoading] = useState<Record<string, boolean>>({});
  const artifactsFetched = useRef<Set<string>>(new Set());

  // Source data state
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [sourceDataLoading, setSourceDataLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  // Chat state
  const [chatSession, setChatSession] = useState<any>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const initialChatSelectionRef = useRef(resolveStoredChatSelection());
  const initialChatSelection = initialChatSelectionRef.current;

  const [chatProvider, setChatProviderRaw] = useState<ModelProvider>(() => initialChatSelection.provider);
  const [chatModel, setChatModel] = useState(() => initialChatSelection.model);
  const [chatReasoning, setChatReasoning] = useState<ReasoningEffort>(() => initialChatSelection.reasoning);

  const setChatProvider = useCallback((p: ModelProvider) => {
    setChatProviderRaw(p);
    const best = DEFAULT_BEST[p] || VERSIONS[p]?.[VERSIONS[p].length - 1]?.id;
    const nextReasoning = DEFAULT_REASONING[p] || 'none';
    if (best) {
      setChatModel(best);
      persistResolvedChatSelection({ mode: p === 'council' ? 'council' : 'individual', provider: p, model: best, reasoning: nextReasoning });
    }
    setChatReasoning(nextReasoning);
  }, []);

  const handleModelChange = useCallback((m: string) => {
    setChatModel(m);
    persistResolvedChatSelection({ mode: chatProvider === 'council' ? 'council' : 'individual', provider: chatProvider, model: m, reasoning: chatReasoning });
  }, [chatProvider, chatReasoning]);

  const handleReasoningChange = useCallback((r: ReasoningEffort) => {
    setChatReasoning(r);
    persistResolvedChatSelection({ mode: chatProvider === 'council' ? 'council' : 'individual', provider: chatProvider, model: chatModel, reasoning: r });
  }, [chatModel, chatProvider]);

  useEffect(() => {
    if (!id) return;

    async function fetchAll() {
      const [companyRes, contactsRes, sitesRes] = await Promise.all([
        supabase.from('companies').select('*').eq('id', id).single(),
        supabase.from('contacts').select('*').eq('company_id', id).order('is_primary', { ascending: false }).order('created_at'),
        supabase.from('crawl_sessions').select('id, domain, base_url, status, created_at').eq('company_id', id).order('created_at', { ascending: false }),
      ]);

      if (companyRes.data) setCompany(companyRes.data as Company);
      if (contactsRes.data) setContacts(contactsRes.data as Contact[]);
      if (sitesRes.data) setSites(sitesRes.data as Site[]);
      setLoading(false);
    }

    fetchAll();
  }, [id]);

  // On-demand artifact fetching when tabs are activated
  const fetchArtifact = useCallback(async (artifactType: string) => {
    if (!id || artifactsFetched.current.has(artifactType)) return;
    artifactsFetched.current.add(artifactType);
    setArtifactLoading(prev => ({ ...prev, [artifactType]: true }));

    try {
      const { data: result, error } = await supabase.functions.invoke('company-artifacts', {
        body: { companyId: id, artifact: artifactType },
      });

      if (error) throw error;
      const items = result?.data || [];

      switch (artifactType) {
        case 'deals': setDeals(items); break;
        case 'engagements': setEngagements(items); break;
        case 'projects': setHarvestProjects(items); break;
        case 'time_entries': setHarvestTimeEntries(items); break;
        case 'invoices': setHarvestInvoices(items); break;
        case 'tickets': setFreshdeskTickets(items); break;
      }
    } catch (err) {
      console.error(`[CompanyDetail] Failed to fetch ${artifactType}:`, err);
      toast.error(`Failed to load ${artifactType}`);
      // Allow retry on error
      artifactsFetched.current.delete(artifactType);
    } finally {
      setArtifactLoading(prev => ({ ...prev, [artifactType]: false }));
    }
  }, [id]);

  // Map tabs to artifact types for on-demand fetching
  useEffect(() => {
    const tabToArtifact: Record<string, string> = {
      overview: 'engagements', // overview shows engagements
      deals: 'deals',
      projects: 'projects',
      time: 'time_entries',
      invoices: 'invoices',
      tickets: 'tickets',
    };
    const artifactType = tabToArtifact[activeTab];
    if (artifactType && company) {
      fetchArtifact(artifactType);
    }
  }, [activeTab, company, fetchArtifact]);

  // Fetch source data when Source Data tab is opened
  const sourceDataFetched = useRef(false);
  useEffect(() => {
    if (activeTab !== 'source-data' || sourceDataFetched.current || !id) return;
    sourceDataFetched.current = true;
    setSourceDataLoading(true);
    (async () => {
      const { data } = await supabase
        .from('company_source_data')
        .select('*')
        .eq('company_id', id)
        .order('source');
      setSourceData(data || []);
      setSourceDataLoading(false);
    })();
  }, [activeTab, id]);

  const refreshSourceData = useCallback(async () => {
    if (!id) return;
    setSourceDataLoading(true);
    const { data } = await supabase
      .from('company_source_data')
      .select('*')
      .eq('company_id', id)
      .order('source');
    setSourceData(data || []);
    setSourceDataLoading(false);
  }, [id]);

  const toggleSource = useCallback((source: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }, []);

  // Initialize sentinel session when Chat or Roadmap tab is first opened
  useEffect(() => {
    if ((activeTab !== 'chat' && activeTab !== 'roadmap') || chatSession || chatLoading || !id) return;
    setChatLoading(true);

    const domain = `${COMPANY_CHAT_PREFIX}${id}`;

    (async () => {
      try {
        const { data: existing } = await withQueryTimeout(
          supabase.from('crawl_sessions')
            .select('id, domain, base_url, status, created_at')
            .eq('domain', domain)
            .limit(1)
            .maybeSingle(),
          12000, 'Loading chat timed out'
        );

        if (existing) { setChatSession(existing); setChatLoading(false); return; }

        const { data: created, error } = await withQueryTimeout(
          supabase.from('crawl_sessions')
            .insert({ domain, base_url: `https://company-chat-${id}`, status: 'complete' } as any)
            .select('id, domain, base_url, status, created_at')
            .single(),
          12000, 'Creating chat session timed out'
        );

        if (error) throw error;
        setChatSession(created);
      } catch (err) {
        console.error('Failed to initialize company chat:', err);
        toast.error('Chat failed to load.');
      } finally {
        setChatLoading(false);
      }
    })();
  }, [activeTab, chatSession, chatLoading, id]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center py-20"><BrandLoader size={48} /></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div>
        <div className="text-center py-20 text-muted-foreground">Company not found.</div>
      </div>
    );
  }

  const enrichment = company.enrichment_data?.apollo_org || {};
  const technologies = enrichment.organizationTechnologies || [];
  const attachedSessionIds = sites.map(s => s.id);
  const attachedSites = sites.map(s => ({ session_id: s.id, domain: s.domain }));

  return (
    <div>
      <main className="px-4 sm:px-6 py-6">
        {/* Back button */}
        <button
          onClick={() => navigate('/companies')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Companies
        </button>

        {/* Company Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="shrink-0 w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="w-full h-full object-contain p-1.5" />
            ) : (
              <Building2 className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight truncate">{company.name}</h1>
              <Select
                value={company.status}
                onValueChange={async (value) => {
                  await supabase.from('companies').update({ status: value, updated_at: new Date().toISOString() }).eq('id', company.id);
                  setCompany({ ...company, status: value });
                }}
              >
                <SelectTrigger className={`w-auto h-7 text-xs border ${STATUS_COLORS[company.status] || ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {company.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{company.description}</p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              {company.domain && (
                <a href={company.website_url || `https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <Globe className="h-3.5 w-3.5" /> {company.domain} <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {company.industry && <span className="capitalize">{company.industry}</span>}
              {company.employee_count && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {company.employee_count} employees</span>}
              {company.annual_revenue && <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> {company.annual_revenue}</span>}
              {company.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {company.location}</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            {WORKSPACE_COMPANY_TABS[currentProduct.id]
              .filter(tab => !tab.condition || tab.condition(company))
              .map(tab => {
                const badgeCounts: Record<string, number | undefined> = {
                  contacts: contacts.length || undefined,
                  deals: deals.length || undefined,
                  projects: harvestProjects.length || undefined,
                  time: harvestTimeEntries.length || undefined,
                  invoices: (company as any).quickbooks_invoice_summary?.count || undefined,
                  tickets: freshdeskTickets.length || undefined,
                  sites: sites.length || undefined,
                };
                const count = badgeCounts[tab.value];
                return (
                  <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5">
                    {tab.label}
                    {count != null && count > 0 && (
                      <Badge variant="secondary" className="text-[10px] py-0 ml-1">{count}</Badge>
                    )}
                  </TabsTrigger>
                );
              })}
          </TabsList>

          {/* Overview Tab — clean summary */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
              <button onClick={() => setActiveTab('contacts')} className="text-left"><StatCard label="Contacts" value={contacts.length} icon={<Users className="h-4 w-4" />} /></button>
              <button onClick={() => setActiveTab('sites')} className="text-left"><StatCard label="Sites" value={sites.length} icon={<Globe className="h-4 w-4" />} /></button>
              <button onClick={() => setActiveTab('deals')} className="text-left"><StatCard label="Deals" value={artifactLoading.deals ? '...' : deals.length} icon={<DollarSign className="h-4 w-4" />} /></button>
              <StatCard label="Engagements" value={artifactLoading.engagements ? '...' : engagements.length} icon={<MessageSquare className="h-4 w-4" />} />
              {deals.length > 0 && (
                <StatCard
                  label="Pipeline Value"
                  value={`$${deals.filter(d => d.status === 'open').reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString()}`}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
              )}
            </div>

            {/* Technologies */}
            {technologies.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-3"><CardTitle className="text-base">Technologies ({technologies.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {technologies.map((tech: string) => <Badge key={tech} variant="secondary" className="text-xs">{tech}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            {artifactLoading.engagements && (
              <div className="flex items-center justify-center py-12"><BrandLoader size={36} /></div>
            )}
            {!artifactLoading.engagements && engagements.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Recent Activity ({engagements.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {engagements.map(eng => {
                      const icon = { email: <Mail className="h-3.5 w-3.5" />, call: <PhoneCall className="h-3.5 w-3.5" />, meeting: <Calendar className="h-3.5 w-3.5" />, note: <StickyNote className="h-3.5 w-3.5" />, task: <CheckSquare className="h-3.5 w-3.5" /> }[eng.engagement_type] || <MessageSquare className="h-3.5 w-3.5" />;
                      return (
                        <div key={eng.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-accent/5 transition-colors">
                          <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium capitalize">{eng.engagement_type}</span>
                              {eng.direction && <Badge variant="outline" className="text-[10px] py-0">{eng.direction}</Badge>}
                              {eng.occurred_at && <span className="text-[10px] text-muted-foreground/60 ml-auto">{format(new Date(eng.occurred_at), 'MMM d, yyyy')}</span>}
                            </div>
                            {eng.subject && eng.subject !== eng.engagement_type.charAt(0).toUpperCase() + eng.engagement_type.slice(1) && <p className="text-xs text-muted-foreground truncate mt-0.5">{eng.subject}</p>}
                            {eng.body_preview && <p className="text-xs text-muted-foreground/60 line-clamp-2 mt-0.5">{eng.body_preview}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {company.notes && (
              <Card className="mt-6">
                <CardHeader className="pb-3"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{company.notes}</p></CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts">
            {contacts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No contacts yet. Enrich a contact via Apollo to add one.</div>
            ) : (
              <div className="space-y-3">
                {contacts.map(contact => (
                  <div key={contact.id} className="flex items-start gap-3 p-4 rounded-lg border border-border/50 hover:border-border transition-colors bg-card">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {contact.photo_url ? (
                        <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">
                          {(contact.first_name?.[0] || '') + (contact.last_name?.[0] || '') || '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown'}</span>
                        {contact.is_primary && <Badge variant="outline" className="text-[10px] py-0">Primary</Badge>}
                        {contact.seniority && <Badge variant="secondary" className={`text-[10px] py-0 ${SENIORITY_COLORS[contact.seniority] || ''}`}>{contact.seniority.replace('_', ' ')}</Badge>}
                      </div>
                      {contact.title && <p className="text-sm text-muted-foreground mt-0.5">{contact.title}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        {contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="h-3.5 w-3.5" /> {contact.email}</a>}
                        {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {contact.phone}</span>}
                        {contact.linkedin_url && <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</a>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Deals Tab */}
          <TabsContent value="deals">
            {artifactLoading.deals ? (
              <div className="flex items-center justify-center py-12"><BrandLoader size={36} /></div>
            ) : deals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No deals found{company.hubspot_company_id ? ' in HubSpot' : '. Map a HubSpot company ID to fetch deals.'}.</div>
            ) : (
              <div className="space-y-3">
                {deals.map(deal => (
                  <div key={deal.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50 bg-card">
                    <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{deal.name}</span>
                        <Badge variant="outline" className={deal.status === 'won' ? 'bg-green-500/15 text-green-400' : deal.status === 'lost' ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'}>{deal.status}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        {deal.amount != null && <span className="font-semibold text-foreground">${deal.amount.toLocaleString()}</span>}
                        {deal.close_date && <span>Close: {format(new Date(deal.close_date), 'MMM d, yyyy')}</span>}
                        {deal.pipeline && <span>Pipeline: {deal.pipeline}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Projects Tab (Harvest) */}
          <TabsContent value="projects">
            {artifactLoading.projects ? (
              <div className="flex items-center justify-center py-12"><BrandLoader size={36} /></div>
            ) : harvestProjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No Harvest projects found.</div>
            ) : (
              <div className="space-y-3">
                {harvestProjects.map((p: any) => (
                  <div key={p.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50 bg-card">
                    <FolderOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{p.name}</span>
                        {p.code && <span className="text-sm text-muted-foreground">{p.code}</span>}
                        <Badge variant="outline" className={p.is_active ? 'bg-green-500/15 text-green-400' : 'bg-zinc-500/15 text-zinc-400'}>
                          {p.is_active ? 'Active' : 'Archived'}
                        </Badge>
                        {p.is_billable && <Badge variant="secondary" className="text-xs">Billable</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        {p.budget != null && <span>Budget: {p.budget.toLocaleString()} {p.budget_by === 'project' ? 'hrs' : ''}</span>}
                        {p.hourly_rate != null && <span>Rate: ${p.hourly_rate}/hr</span>}
                        {p.fee != null && <span>Fee: ${p.fee.toLocaleString()}</span>}
                        {p.starts_on && <span>Start: {format(new Date(p.starts_on), 'MMM d, yyyy')}</span>}
                        {p.ends_on && <span>End: {format(new Date(p.ends_on), 'MMM d, yyyy')}</span>}
                      </div>
                      {p.notes && <p className="text-sm text-muted-foreground/60 mt-1 line-clamp-2">{p.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Time Tab (Harvest) */}
          <TabsContent value="time">
            {artifactLoading.time_entries ? (
              <div className="flex items-center justify-center py-12"><BrandLoader size={36} /></div>
            ) : harvestTimeEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No Harvest time entries found.</div>
            ) : (() => {
              const totalHours = harvestTimeEntries.reduce((s: number, t: any) => s + (t.hours || 0), 0);
              const billableHours = harvestTimeEntries.filter((t: any) => t.billable).reduce((s: number, t: any) => s + (t.hours || 0), 0);
              return (
                <div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                      <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Billable Hours</p>
                      <p className="text-2xl font-bold">{billableHours.toFixed(1)}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Entries</p>
                      <p className="text-2xl font-bold">{harvestTimeEntries.length}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium">Date</th>
                          <th className="text-left py-2 px-3 font-medium">Project</th>
                          <th className="text-left py-2 px-3 font-medium">Task</th>
                          <th className="text-left py-2 px-3 font-medium">Person</th>
                          <th className="text-right py-2 px-3 font-medium">Hours</th>
                          <th className="text-left py-2 px-3 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {harvestTimeEntries.slice(0, 100).map((t: any) => (
                          <tr key={t.id} className="border-t border-border/30">
                            <td className="py-2 px-3 whitespace-nowrap">{t.spent_date ? format(new Date(t.spent_date), 'MMM d, yyyy') : '—'}</td>
                            <td className="py-2 px-3 truncate max-w-[160px]">{t.project_name || '—'}</td>
                            <td className="py-2 px-3 truncate max-w-[140px]">{t.task_name || '—'}</td>
                            <td className="py-2 px-3 truncate max-w-[120px]">{t.harvest_user_name || '—'}</td>
                            <td className="py-2 px-3 text-right font-medium">{(t.hours || 0).toFixed(2)}</td>
                            <td className="py-2 px-3 truncate max-w-[200px] text-muted-foreground">{t.notes || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </TabsContent>

          {/* Invoices Tab (QuickBooks) */}
          <TabsContent value="invoices">
            {(() => {
              const qb = (company as any)?.quickbooks_invoice_summary;
              if (!qb) return <div className="text-center py-12 text-muted-foreground">No QuickBooks invoice data.</div>;
              const services = qb.services ? Object.entries(qb.services) as [string, { count: number; total: number }][] : [];
              const txTypes = qb.transactionTypes ? Object.entries(qb.transactionTypes) as [string, number][] : [];
              return (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold">${(qb.total || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Transactions</p>
                      <p className="text-2xl font-bold">{qb.count || 0}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">First Transaction</p>
                      <p className="text-lg font-semibold">{qb.firstDate ? format(new Date(qb.firstDate), 'MMM d, yyyy') : '—'}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Last Transaction</p>
                      <p className="text-lg font-semibold">{qb.lastDate ? format(new Date(qb.lastDate), 'MMM d, yyyy') : '—'}</p>
                    </div>
                  </div>

                  {/* Transaction Types */}
                  {txTypes.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Transaction Types</h3>
                      <div className="flex flex-wrap gap-2">
                        {txTypes.sort((a, b) => (b[1] as number) - (a[1] as number)).map(([type, count]) => (
                          <Badge key={type} variant="outline" className="text-sm py-1 px-3">
                            {type}: {(count as number).toLocaleString()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Services Breakdown */}
                  {services.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Services</h3>
                      <div className="space-y-2">
                        {services.sort((a, b) => (b[1] as any).total - (a[1] as any).total).map(([name, data]) => (
                          <div key={name} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{name.replace(/^[^:]+:/, '').trim()}</span>
                              <span className="text-xs text-muted-foreground ml-2">({(data as any).count} transactions)</span>
                            </div>
                            <span className="font-semibold shrink-0">${((data as any).total || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample Memos */}
                  {qb.sampleMemos?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Recent Memos</h3>
                      <div className="space-y-1">
                        {qb.sampleMemos.slice(0, 5).map((memo: string, i: number) => (
                          <div key={i} className="text-sm text-muted-foreground p-2 rounded bg-muted/30 truncate">
                            {memo}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* Tickets Tab (Freshdesk) */}
          <TabsContent value="tickets">
            {artifactLoading.tickets ? (
              <div className="flex items-center justify-center py-12"><BrandLoader size={36} /></div>
            ) : freshdeskTickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No Freshdesk tickets found.</div>
            ) : (() => {
              const open = freshdeskTickets.filter((t: any) => t.status === 2 || t.status === 3).length;
              const resolved = freshdeskTickets.filter((t: any) => t.status === 4 || t.status === 5).length;
              const priorityColors: Record<string, string> = { Low: 'text-zinc-400', Medium: 'text-blue-400', High: 'text-amber-400', Urgent: 'text-red-400' };
              return (
                <div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Total Tickets</p>
                      <p className="text-2xl font-bold">{freshdeskTickets.length}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Open / Pending</p>
                      <p className="text-2xl font-bold">{open}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Resolved / Closed</p>
                      <p className="text-2xl font-bold">{resolved}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {freshdeskTickets.map((t: any) => (
                      <div key={t.id} className="flex items-start gap-4 p-3 rounded-lg border border-border/50 bg-card">
                        <Headphones className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{t.subject || 'No subject'}</span>
                            <Badge variant="outline" className={t.status_label === 'Closed' || t.status_label === 'Resolved' ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'}>
                              {t.status_label || `Status ${t.status}`}
                            </Badge>
                            {t.priority_label && (
                              <span className={`text-sm font-medium ${priorityColors[t.priority_label] || ''}`}>{t.priority_label}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 mt-1 text-sm text-muted-foreground">
                            {t.requester_name && <span>{t.requester_name}</span>}
                            {t.ticket_type && <span>{t.ticket_type}</span>}
                            {t.source_label && <span>via {t.source_label}</span>}
                            {t.created_date && <span>{format(new Date(t.created_date), 'MMM d, yyyy')}</span>}
                          </div>
                          {t.description_text && <p className="text-sm text-muted-foreground/60 mt-1 line-clamp-2">{t.description_text}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </TabsContent>

          {/* Sites Tab */}
          <TabsContent value="sites">
            {sites.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No sites linked to this company yet. Analyze a site to link it.</div>
            ) : (
              <div className="space-y-3">
                {sites.map(site => (
                  <button key={site.id} onClick={() => navigate(buildSitePath(site.domain, site.created_at, 'raw-data'))} className="w-full text-left p-4 rounded-lg border border-border/50 hover:border-border hover:bg-accent/5 transition-all group flex items-center gap-4 bg-card">
                    <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{site.domain}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(site.created_at), 'MMM d, yyyy')} &middot; {site.status}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-foreground/50 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Knowledge Tab */}
          <TabsContent value="knowledge">
            <CompanyKnowledgeTab
              companyId={company.id}
              companyName={company.name}
              sites={sites}
            />
          </TabsContent>

          {/* Roadmap Tab */}
          <TabsContent value="roadmap" className="min-h-[600px]">
            {chatLoading ? (
              <div className="flex items-center justify-center py-20"><BrandLoader size={48} /></div>
            ) : !chatSession ? (
              <div className="text-center py-20 text-muted-foreground">Loading roadmap...</div>
            ) : (
              <ErrorBoundary fallback={
                <div className="flex items-center justify-center py-20 text-center">
                  <div>
                    <p className="text-muted-foreground mb-2">Roadmap failed to load.</p>
                    <button className="text-sm underline text-muted-foreground hover:text-foreground" onClick={() => window.location.reload()}>Reload page</button>
                  </div>
                </div>
              }>
                <RoadmapTab
                  sessionId={chatSession.id}
                  domain={company.domain || undefined}
                  companyId={company.id}
                  companyName={company.name}
                />
              </ErrorBoundary>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="min-h-[600px]">
            {chatLoading ? (
              <div className="flex items-center justify-center py-20"><BrandLoader size={48} /></div>
            ) : !chatSession ? (
              <div className="text-center py-20 text-muted-foreground">
                {sites.length === 0
                  ? 'No sites linked to this company yet. Analyze a site first to enable chat.'
                  : 'Loading chat...'}
              </div>
            ) : (
              <ErrorBoundary fallback={
                <div className="flex items-center justify-center py-20 text-center">
                  <div>
                    <p className="text-muted-foreground mb-2">Chat failed to load.</p>
                    <button className="text-sm underline text-muted-foreground hover:text-foreground" onClick={() => window.location.reload()}>Reload page</button>
                  </div>
                </div>
              }>
                <KnowledgeChatCard
                  session={chatSession}
                  pages={[]}
                  selectedModel={chatModel}
                  provider={chatProvider}
                  reasoning={chatReasoning}
                  onProviderChange={setChatProvider}
                  onModelChange={handleModelChange}
                  onReasoningChange={handleReasoningChange}
                  globalMode
                  attachedSessionIds={attachedSessionIds}
                  attachedSites={attachedSites}
                  crawlContextOverride={`Company: ${company.name}\nDomain: ${company.domain || 'N/A'}\nIndustry: ${company.industry || 'N/A'}\nEmployees: ${company.employee_count || 'N/A'}\nRevenue: ${company.annual_revenue || 'N/A'}\nLocation: ${company.location || 'N/A'}\nDescription: ${company.description || 'N/A'}\nContacts: ${contacts.map(c => `${[c.first_name, c.last_name].filter(Boolean).join(' ')} (${c.title || 'No title'}, ${c.email || 'No email'})`).join('; ')}\nDeals: ${deals.map(d => `${d.name} ($${d.amount?.toLocaleString() || '?'}, ${d.status})`).join('; ') || 'None'}`}
                />
              </ErrorBoundary>
            )}
          </TabsContent>

          {/* Source Data Tab */}
          <TabsContent value="source-data">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Raw API responses from connected systems. Run a global sync to populate.
              </p>
              <Button variant="outline" size="sm" onClick={refreshSourceData} disabled={sourceDataLoading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${sourceDataLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            {sourceDataLoading ? (
              <div className="flex items-center justify-center py-12"><BrandLoader size={36} /></div>
            ) : sourceData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No source data stored yet. Run a global sync to pull raw API data from HubSpot, Harvest, and Freshdesk.
              </div>
            ) : (
              <div className="space-y-3">
                {sourceData.map((sd: any) => {
                  const isExpanded = expandedSources.has(sd.source);
                  const sourceLabel = { hubspot: 'HubSpot', harvest: 'Harvest', freshdesk: 'Freshdesk' }[sd.source] || sd.source;
                  const sourceColor = { hubspot: 'text-orange-400', harvest: 'text-amber-400', freshdesk: 'text-green-400' }[sd.source] || '';
                  const fieldCount = sd.raw_data ? Object.keys(sd.raw_data).length : 0;
                  return (
                    <Card key={sd.id}>
                      <button
                        onClick={() => toggleSource(sd.source)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileJson className={`h-5 w-5 ${sourceColor}`} />
                          <div>
                            <span className="font-semibold">{sourceLabel}</span>
                            <span className="text-xs text-muted-foreground ml-2">ID: {sd.source_id}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">{fieldCount} fields</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {sd.fetched_at ? format(new Date(sd.fetched_at), 'MMM d, yyyy h:mm a') : ''}
                          </span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>
                      {isExpanded && (
                        <CardContent className="pt-0 pb-4">
                          <SourceDataTable data={sd.raw_data} />
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function SourceDataTable({ data }: { data: any }) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  if (!data || typeof data !== 'object') return null;

  const toggleKey = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatKey = (key: string): string => {
    // Known compound words common in API responses
    const compounds: Record<string, string> = {
      numberofemployees: 'Number Of Employees', annualrevenue: 'Annual Revenue',
      createdate: 'Create Date', lastmodifieddate: 'Last Modified Date',
      lifecyclestage: 'Lifecycle Stage', hubspot_owner_id: 'HubSpot Owner ID',
      hs_object_id: 'HubSpot Object ID', firstname: 'First Name', lastname: 'Last Name',
      closedate: 'Close Date', dealstage: 'Deal Stage', dealname: 'Deal Name',
      companyname: 'Company Name', phonenumber: 'Phone Number', emailaddress: 'Email Address',
      webpage: 'Web Page', customfields: 'Custom Fields', displayvalue: 'Display Value',
    };
    // Get just the last segment (after last dot or bracket)
    const last = key.includes('.') ? key.split('.').pop()! : key;
    // Strip array index brackets like [0]
    const clean = last.replace(/\[\d+\]/g, '');
    const lower = clean.toLowerCase();
    if (compounds[lower]) return compounds[lower];
    // Split on underscores, camelCase boundaries, and dots
    return clean
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → camel Case
      .replace(/[_.-]+/g, ' ') // underscores/dots/hyphens → spaces
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'string' && val === '') return '(empty)';
    return String(val);
  };

  const isExpandable = (val: any): boolean =>
    val !== null && typeof val === 'object' && (Array.isArray(val) ? val.length > 0 : Object.keys(val).length > 0);

  const renderRows = (obj: any, prefix = ''): React.ReactNode[] => {
    return Object.entries(obj).map(([key, val]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const expandable = isExpandable(val);
      const expanded = expandedKeys.has(fullKey);

      // Array of primitives — show inline
      if (Array.isArray(val) && val.length > 0 && val.every(v => typeof v !== 'object')) {
        return (
          <tr key={fullKey} className="border-b border-border/30 last:border-0">
            <td className="py-2.5 px-3 text-sm text-muted-foreground whitespace-nowrap align-top w-[240px]" title={fullKey}>{formatKey(fullKey)}</td>
            <td className="py-2.5 px-3 text-sm break-all">{val.join(', ')}</td>
          </tr>
        );
      }

      if (expandable) {
        return (
          <tr key={fullKey} className="border-b border-border/30 last:border-0">
            <td colSpan={2} className="p-0">
              <button
                onClick={() => toggleKey(fullKey)}
                className="w-full flex items-center gap-1.5 py-2.5 px-3 text-sm text-muted-foreground hover:bg-accent/5 transition-colors"
              >
                {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <span title={fullKey}>{formatKey(fullKey)}</span>
                <Badge variant="secondary" className="text-xs py-0 ml-1">
                  {Array.isArray(val) ? `${(val as any[]).length} items` : `${Object.keys(val as object).length} fields`}
                </Badge>
              </button>
              {expanded && (
                <table className="w-full ml-4 border-l border-border/20">
                  <tbody>
                    {Array.isArray(val)
                      ? (val as any[]).map((item, i) =>
                          typeof item === 'object' && item !== null
                            ? renderRows(item, `${fullKey}[${i}]`)
                            : (
                              <tr key={`${fullKey}[${i}]`} className="border-b border-border/30 last:border-0">
                                <td className="py-2 px-3 text-sm text-muted-foreground w-[240px]">Item {i + 1}</td>
                                <td className="py-2 px-3 text-sm">{formatValue(item)}</td>
                              </tr>
                            )
                        ).flat()
                      : renderRows(val as object, fullKey)
                    }
                  </tbody>
                </table>
              )}
            </td>
          </tr>
        );
      }

      // Primitive value
      const display = formatValue(val);
      const isUrl = typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));
      const isDate = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val);

      return (
        <tr key={fullKey} className="border-b border-border/30 last:border-0">
          <td className="py-2.5 px-3 text-sm text-muted-foreground whitespace-nowrap align-top w-[240px]" title={fullKey}>{formatKey(fullKey)}</td>
          <td className="py-2.5 px-3 text-sm break-all">
            {isUrl ? (
              <a href={val as string} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{display}</a>
            ) : isDate ? (
              <span title={val as string}>{format(new Date(val as string), 'MMM d, yyyy h:mm a')}</span>
            ) : val === null || val === undefined ? (
              <span className="text-muted-foreground/50">{display}</span>
            ) : (
              display
            )}
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden max-h-[600px] overflow-y-auto">
      <table className="w-full">
        <thead className="bg-muted/30 sticky top-0">
          <tr>
            <th className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left w-[240px]">Field</th>
            <th className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left">Value</th>
          </tr>
        </thead>
        <tbody>
          {renderRows(data)}
        </tbody>
      </table>
    </div>
  );
}
