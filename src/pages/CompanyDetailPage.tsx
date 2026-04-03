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
  MessageSquare, PhoneCall, Calendar, StickyNote, CheckSquare, Brain, Database
} from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { supabase } from '@/integrations/supabase/client';
import { buildSitePath } from '@/lib/sessionSlug';
import { format } from 'date-fns';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
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
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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
      const [companyRes, contactsRes, sitesRes, dealsRes, engagementsRes] = await Promise.all([
        supabase.from('companies').select('*').eq('id', id).single(),
        supabase.from('contacts').select('*').eq('company_id', id).order('is_primary', { ascending: false }).order('created_at'),
        supabase.from('crawl_sessions').select('id, domain, base_url, status, created_at').eq('company_id', id).order('created_at', { ascending: false }),
        supabase.from('deals').select('*').eq('company_id', id).order('created_at', { ascending: false }),
        supabase.from('engagements').select('*').eq('company_id', id).order('occurred_at', { ascending: false }).limit(30),
      ]);

      if (companyRes.data) setCompany(companyRes.data as Company);
      if (contactsRes.data) setContacts(contactsRes.data as Contact[]);
      if (sitesRes.data) setSites(sitesRes.data as Site[]);
      if (dealsRes.data) setDeals(dealsRes.data as Deal[]);
      if (engagementsRes.data) setEngagements(engagementsRes.data as Engagement[]);
      setLoading(false);
    }

    fetchAll();
  }, [id]);

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
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex items-center justify-center py-20"><BrandLoader size={48} /></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="text-center py-20 text-muted-foreground">Company not found.</div>
      </div>
    );
  }

  const enrichment = company.enrichment_data?.apollo_org || {};
  const technologies = enrichment.organizationTechnologies || [];
  const attachedSessionIds = sites.map(s => s.id);
  const attachedSites = sites.map(s => ({ session_id: s.id, domain: s.domain }));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-3 sm:px-6 py-8">
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
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" /> Knowledge
            </TabsTrigger>
            <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" /> Chat
              {sites.length > 0 && <Badge variant="secondary" className="text-[10px] py-0 ml-1">{sites.length} sites</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
              <StatCard label="Contacts" value={contacts.length} icon={<Users className="h-4 w-4" />} />
              <StatCard label="Sites" value={sites.length} icon={<Globe className="h-4 w-4" />} />
              <StatCard label="Deals" value={deals.length} icon={<DollarSign className="h-4 w-4" />} />
              <StatCard label="Engagements" value={engagements.length} icon={<MessageSquare className="h-4 w-4" />} />
              {deals.length > 0 && (
                <StatCard
                  label="Pipeline Value"
                  value={`$${deals.filter(d => d.status === 'open').reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString()}`}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
              )}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Contacts column */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" /> Contacts ({contacts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No contacts yet. Enrich a contact via Apollo to add one.</p>
                    ) : (
                      <div className="space-y-3">
                        {contacts.map(contact => (
                          <div key={contact.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
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
                                <span className="font-medium text-sm">{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown'}</span>
                                {contact.is_primary && <Badge variant="outline" className="text-[10px] py-0">Primary</Badge>}
                                {contact.seniority && <Badge variant="secondary" className={`text-[10px] py-0 ${SENIORITY_COLORS[contact.seniority] || ''}`}>{contact.seniority.replace('_', ' ')}</Badge>}
                              </div>
                              {contact.title && <p className="text-xs text-muted-foreground mt-0.5">{contact.title}</p>}
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                {contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" /> {contact.email}</a>}
                                {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {contact.phone}</span>}
                                {contact.linkedin_url && <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground"><Linkedin className="h-3 w-3" /> LinkedIn</a>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Deals */}
                {deals.length > 0 && (
                  <Card className="mt-6">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Deals ({deals.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {deals.map(deal => (
                          <div key={deal.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                            <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{deal.name}</span>
                                <Badge variant="outline" className={deal.status === 'won' ? 'bg-green-500/15 text-green-400' : deal.status === 'lost' ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'}>{deal.status}</Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                                {deal.amount != null && <span className="font-medium">${deal.amount.toLocaleString()}</span>}
                                {deal.close_date && <span>Close: {format(new Date(deal.close_date), 'MMM d, yyyy')}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Engagements */}
                {engagements.length > 0 && (
                  <Card className="mt-6">
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

                {/* Technologies */}
                {technologies.length > 0 && (
                  <Card className="mt-6">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Technologies ({technologies.length})</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {technologies.map((tech: string) => <Badge key={tech} variant="secondary" className="text-xs">{tech}</Badge>)}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sites column */}
              <div>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Sites ({sites.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sites.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No sites linked to this company yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {sites.map(site => (
                          <button key={site.id} onClick={() => navigate(buildSitePath(site.domain, site.created_at, 'raw-data'))} className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-border hover:bg-accent/5 transition-all group flex items-center gap-3">
                            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{site.domain}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(site.created_at), 'MMM d, yyyy')} &middot; {site.status}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {company.notes && (
                  <Card className="mt-6">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{company.notes}</p></CardContent>
                  </Card>
                )}
              </div>
            </div>
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
