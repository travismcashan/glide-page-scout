import { useState, useEffect, useMemo } from "react";
import {
  DollarSign, Calendar, Building2, ExternalLink, RefreshCw, Mail, Phone, User,
  ChevronDown, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent,
} from "@/components/ui/sheet";
import AppHeader from "@/components/AppHeader";
import { BrandLoader } from "@/components/BrandLoader";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format, isPast } from "date-fns";

const HUBSPOT_ACCOUNT = "3457789";

// ---- Types ----
type Deal = {
  id: string;
  dealname: string;
  amount: string | null;
  dealstage: string;
  pipeline: string;
  closedate: string | null;
  createdate: string | null;
  hs_lastmodifieddate: string | null;
  hubspot_owner_id: string | null;
  companyName?: string;
  dealtype?: string | null;
  hs_priority?: string | null;
  deal_source_details?: string | null;
  hs_forecast_probability?: string | null;
  notes_last_contacted?: string | null;
};

type Contact = {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  company: string | null;
  jobtitle: string | null;
  phone: string | null;
  lifecyclestage: string | null;
  hs_lead_status: string | null;
  hubspot_owner_id: string | null;
  lastmodifieddate: string | null;
  createdate: string | null;
};

type StageInfo = { id: string; label: string; closed?: boolean };
type PipelineInfo = { id: string; label: string; stages: StageInfo[] };
type PipelineOption = { id: string; label: string };
type StatusInfo = { id: string; label: string };
type OwnerInfo = { name: string; team: string | null; active: boolean };

export default function PipelinePage() {
  const [activeTab, setActiveTab] = useState("deals");

  // Deals state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsError, setDealsError] = useState<string | null>(null);
  const [pipelineInfo, setPipelineInfo] = useState<PipelineInfo | null>(null);
  const [pipelineOptions, setPipelineOptions] = useState<PipelineOption[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("33bc2a42-c57c-4180-b0e6-77b3d6c7f69f");
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [ownerTeams, setOwnerTeams] = useState<Record<string, OwnerInfo>>({});
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [showOtherOwners, setShowOtherOwners] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [createDateFilter, setCreateDateFilter] = useState<string>("all");
  const [closeDateFilter, setCloseDateFilter] = useState<string>("all");

  // Leads state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [leadStatuses, setLeadStatuses] = useState<StatusInfo[]>([]);
  const [leadOwners, setLeadOwners] = useState<Record<string, string>>({});

  // Historical stats (from lightweight closed-deals query)
  const [historicalStats, setHistoricalStats] = useState<{
    winRate: number; avgCycle: number; wonRevenue: number;
    closedWonCount: number; closedTotalCount: number;
  } | null>(null);

  // ---- Fetch deals ----
  const fetchDeals = async (pipelineId?: string) => {
    setDealsLoading(true);
    setDealsError(null);
    try {
      const { data, error } = await supabase.functions.invoke("hubspot-pipeline", {
        body: {
          action: "deals",
          pipeline: pipelineId || selectedPipeline,
        },
      });
      if (error) {
        // Extract readable error from edge function response
        let msg = "Failed to load deals";
        try {
          const body = typeof error === "object" && error?.context?.body
            ? await new Response(error.context.body).text()
            : null;
          if (body) {
            const parsed = JSON.parse(body);
            msg = parsed.error || msg;
          }
        } catch { /* fallback to generic message */ }

        // Detect common HubSpot errors
        if (msg.includes("429") || msg.includes("TOO_MANY")) {
          msg = "HubSpot rate limit reached. Try again in a few minutes.";
        } else if (msg.includes("401") || msg.includes("UNAUTHORIZED")) {
          msg = "HubSpot access token expired. Contact admin to refresh.";
        } else if (msg.includes("403")) {
          msg = "HubSpot permissions error. The API token may not have deal access.";
        }
        setDealsError(msg);
        console.error("Deals fetch error:", msg, error);
        setDealsLoading(false);
        return;
      }
      setDeals(data.deals || []);
      setOwners(data.owners || {});
      if (data.ownerTeams) setOwnerTeams((prev) => ({ ...prev, ...data.ownerTeams }));
      if (data.pipeline) setPipelineInfo(data.pipeline);
      if (data.pipelines) setPipelineOptions(data.pipelines);
    } catch (err: any) {
      const msg = err?.message || "Unexpected error loading deals";
      setDealsError(msg);
      console.error("Failed to fetch deals:", err);
    }
    setDealsLoading(false);
  };

  // ---- Fetch leads ----
  const fetchLeads = async () => {
    setContactsLoading(true);
    setContactsError(null);
    try {
      const { data, error } = await supabase.functions.invoke("hubspot-pipeline", {
        body: { action: "leads" },
      });
      if (error) {
        let msg = "Failed to load leads";
        try {
          const body = typeof error === "object" && error?.context?.body
            ? await new Response(error.context.body).text()
            : null;
          if (body) {
            const parsed = JSON.parse(body);
            msg = parsed.error || msg;
          }
        } catch { /* fallback */ }
        if (msg.includes("429") || msg.includes("TOO_MANY")) {
          msg = "HubSpot rate limit reached. Try again in a few minutes.";
        }
        setContactsError(msg);
        console.error("Leads fetch error:", msg);
        setContactsLoading(false);
        return;
      }
      setContacts(data.contacts || []);
      setLeadOwners(data.owners || {});
      if (data.ownerTeams) setOwnerTeams((prev) => ({ ...prev, ...data.ownerTeams }));
      if (data.statuses) setLeadStatuses(data.statuses);
    } catch (err: any) {
      setContactsError(err?.message || "Unexpected error loading leads");
      console.error("Failed to fetch leads:", err);
    }
    setContactsLoading(false);
  };

  // ---- Fetch historical stats (win rate, avg cycle) ----
  const fetchStats = async (pipelineId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("hubspot-pipeline", {
        body: { action: "stats", pipeline: pipelineId || selectedPipeline },
      });
      if (!error && data) setHistoricalStats(data);
    } catch { /* non-critical, stats just show — */ }
  };

  // Stagger API calls to avoid hitting HubSpot rate limits on mount
  // Deals + stats fire first, leads fires after deals complete
  useEffect(() => {
    fetchDeals().then(() => fetchStats());
  }, [selectedPipeline]);
  useEffect(() => {
    // Delay leads slightly so deals/stats finish their HubSpot calls first
    const t = setTimeout(() => fetchLeads(), 1500);
    return () => clearTimeout(t);
  }, []);

  // ---- Date range helper ----
  const getDateRange = (filter: string): { start: Date; end: Date } | null => {
    if (filter === "all") return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
    const quarterStart = new Date(today.getFullYear(), quarterMonth, 1);
    const quarterEnd = new Date(today.getFullYear(), quarterMonth + 3, 0, 23, 59, 59);

    const ranges: Record<string, { start: Date; end: Date }> = {
      today: { start: today, end: tomorrow },
      yesterday: { start: new Date(today.getTime() - 86400000), end: today },
      this_week: { start: weekStart, end: weekEnd },
      last_week: { start: new Date(weekStart.getTime() - 7 * 86400000), end: weekStart },
      this_month: { start: monthStart, end: monthEnd },
      last_month: { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: monthStart },
      this_quarter: { start: quarterStart, end: quarterEnd },
      last_quarter: { start: new Date(today.getFullYear(), quarterMonth - 3, 1), end: quarterStart },
      last_14_days: { start: new Date(today.getTime() - 14 * 86400000), end: tomorrow },
      last_30_days: { start: new Date(today.getTime() - 30 * 86400000), end: tomorrow },
      last_90_days: { start: new Date(today.getTime() - 90 * 86400000), end: tomorrow },
      this_year: { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear(), 11, 31, 23, 59, 59) },
    };
    return ranges[filter] || null;
  };

  const DATE_OPTIONS = [
    { value: "all", label: "All dates" },
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "this_week", label: "This week" },
    { value: "last_week", label: "Last week" },
    { value: "this_month", label: "This month" },
    { value: "last_month", label: "Last month" },
    { value: "this_quarter", label: "This quarter" },
    { value: "last_quarter", label: "Last quarter" },
    { value: "last_14_days", label: "Last 14 days" },
    { value: "last_30_days", label: "Last 30 days" },
    { value: "last_90_days", label: "Last 90 days" },
    { value: "this_year", label: "This year" },
  ];

  // ---- Computed: deals grouped by stage (open stages only) ----
  const dealsByStage = useMemo(() => {
    if (!pipelineInfo) return {};
    const map: Record<string, Deal[]> = {};
    for (const stage of pipelineInfo.stages) {
      if (stage.closed) continue; // only show open stages
      map[stage.id] = [];
    }

    let filtered = ownerFilter === "all" ? deals : deals.filter((d) => d.hubspot_owner_id === ownerFilter);

    // Apply create date filter
    const createRange = getDateRange(createDateFilter);
    if (createRange) {
      filtered = filtered.filter((d) => {
        if (!d.createdate) return false;
        const cd = new Date(d.createdate);
        return cd >= createRange.start && cd <= createRange.end;
      });
    }

    // Apply close date filter
    const closeRange = getDateRange(closeDateFilter);
    if (closeRange) {
      filtered = filtered.filter((d) => {
        if (!d.closedate) return false;
        const cd = new Date(d.closedate);
        return cd >= closeRange.start && cd <= closeRange.end;
      });
    }

    for (const deal of filtered) {
      if (map[deal.dealstage]) {
        map[deal.dealstage].push(deal);
      }
    }
    return map;
  }, [deals, pipelineInfo, ownerFilter, createDateFilter, closeDateFilter]);

  // ---- Computed: contacts grouped by lead status ----
  const contactsByStatus = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    for (const s of leadStatuses) {
      map[s.id] = [];
    }
    const filtered = ownerFilter === "all" ? contacts : contacts.filter((c) => c.hubspot_owner_id === ownerFilter);
    for (const c of filtered) {
      const status = c.hs_lead_status || "Inbound";
      if (map[status]) map[status].push(c);
    }
    return map;
  }, [contacts, leadStatuses, ownerFilter]);

  // ---- Stage probability for weighted pipeline ----
  const STAGE_PROBABILITY: Record<string, number> = {
    "753958": 0.1,    // Follow-Up / Scheduling
    "132302": 0.2,    // Discovery Call
    "132303": 0.4,    // Needs Analysis
    "132304": 0.6,    // Proposal Due
    "132305": 0.8,    // Open Deal
    "30306367": 0.95,  // Closed: In Contract
    "132306": 1.0,    // Closed: Won!
    // Services pipeline
    "67943339": 0.1, "67943340": 0.15, "67918443": 0.2,
    "67943342": 0.4, "67943343": 0.6, "67958172": 0.8,
    "67958173": 0.95, "67943344": 1.0,
    // RFP pipeline
    "1103540129": 0.05, "1103540130": 0.1, "1103540132": 0.15,
    "1103540133": 0.3, "1103540134": 0.4, "1269247232": 0.5,
    "1103540135": 0.6, "1103625803": 0.8, "1103625804": 1.0,
  };

  // ---- Summary stats (computed from open deals only) ----
  const pipelineStats = useMemo(() => {
    if (!pipelineInfo) return null;
    const filtered = ownerFilter === "all" ? deals : deals.filter((d) => d.hubspot_owner_id === ownerFilter);

    const openPipeline = filtered.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const weightedPipeline = filtered.reduce((s, d) => {
      const prob = STAGE_PROBABILITY[d.dealstage] || 0.5;
      return s + (Number(d.amount) || 0) * prob;
    }, 0);

    // Closing this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const closingThisMonth = filtered.filter((d) => {
      if (!d.closedate) return false;
      const cd = new Date(d.closedate);
      return cd >= monthStart && cd <= monthEnd;
    });
    const closingThisMonthValue = closingThisMonth.reduce((s, d) => s + (Number(d.amount) || 0), 0);

    const avgDealSize = filtered.length > 0 ? openPipeline / filtered.length : 0;

    return {
      openPipeline,
      weightedPipeline,
      closingThisMonthValue,
      closingThisMonthCount: closingThisMonth.length,
      winRate: historicalStats?.winRate ?? 0,
      avgDealSize,
      avgCycle: historicalStats?.avgCycle ?? 0,
      openCount: filtered.length,
    };
  }, [deals, pipelineInfo, ownerFilter, historicalStats]);

  // ---- Owners grouped by team ----
  const ownersByTeam = useMemo(() => {
    const merged = { ...owners, ...leadOwners };
    const groups: Record<string, { id: string; name: string }[]> = {};

    // Only show owners who have deals or leads (i.e., appear in merged)
    for (const [id, name] of Object.entries(merged)) {
      const info = ownerTeams[id];
      const team = info?.team || "Others";
      if (!groups[team]) groups[team] = [];
      groups[team].push({ id, name });
    }

    // Sort owners within each group
    for (const team of Object.keys(groups)) {
      groups[team].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Put known teams first, "Others" last
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      if (a === "Others") return 1;
      if (b === "Others") return -1;
      return a.localeCompare(b);
    });

    return sorted;
  }, [owners, leadOwners, ownerTeams]);

  // ---- Stage totals ----
  const stageTotal = (stageDeals: Deal[]) =>
    stageDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage leads and deals from HubSpot
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Owner filter */}
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-fit min-w-[130px] h-9">
                <User className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="All owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {ownersByTeam.map(([team, members], i) => {
                  const isOther = team === "Others";
                  return (
                    <SelectGroup key={team}>
                      <div className="mx-2 my-1 border-t border-border" />
                      {isOther ? (
                        <button
                          type="button"
                          className="flex items-center gap-0.5 py-1.5 pl-8 pr-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full cursor-pointer hover:text-foreground transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowOtherOwners((v) => !v);
                          }}
                        >
                          <ChevronDown className={`h-3 w-3 stroke-[2.5] transition-transform ${showOtherOwners ? "" : "-rotate-90"}`} />
                          {team} ({members.length})
                        </button>
                      ) : (
                        <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wider">{team}</SelectLabel>
                      )}
                      {(!isOther || showOtherOwners) && members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => activeTab === "deals" ? fetchDeals() : fetchLeads()}
              disabled={activeTab === "deals" ? dealsLoading : contactsLoading}
            >
              <RefreshCw className={`h-4 w-4 ${(dealsLoading || contactsLoading) ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="leads" className="gap-2">
                <Mail className="h-3.5 w-3.5" />
                Leads
                {contacts.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                    {contacts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="deals" className="gap-2">
                <DollarSign className="h-3.5 w-3.5" />
                Deals
                {pipelineStats && pipelineStats.openCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                    {pipelineStats.openCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Deals-specific controls */}
            {activeTab === "deals" && (
              <div className="flex items-center gap-3 flex-wrap">
                {/* Pipeline selector */}
                <Select value={selectedPipeline} onValueChange={(v) => { setSelectedPipeline(v); fetchDeals(v); }}>
                  <SelectTrigger className="w-[220px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelineOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Create date filter */}
                <Select value={createDateFilter} onValueChange={setCreateDateFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Create date" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label === "All dates" ? "Create date" : o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Close date filter */}
                <Select value={closeDateFilter} onValueChange={setCloseDateFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Close date" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label === "All dates" ? "Close date" : o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Closed toggle removed — only open deals are fetched for performance */}
              </div>
            )}
          </div>

          {/* ---- LEADS TAB ---- */}
          <TabsContent value="leads" className="mt-0">
            {contactsLoading ? (
              <div className="flex items-center justify-center py-24">
                <BrandLoader size={64} />
              </div>
            ) : contactsError ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="text-sm text-destructive font-medium">{contactsError}</div>
                <Button variant="outline" size="sm" onClick={() => fetchLeads()}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Retry
                </Button>
              </div>
            ) : (
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4" style={{ minWidth: leadStatuses.length * 300 }}>
                  {leadStatuses.map((status) => {
                    const statusContacts = contactsByStatus[status.id] || [];
                    return (
                      <div key={status.id} className="w-[300px] shrink-0">
                        {/* Column header */}
                        <div className="flex items-center justify-between px-3 py-2 mb-3 rounded-lg bg-muted/50">
                          <span className="text-sm font-semibold">{status.label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {statusContacts.length}
                          </Badge>
                        </div>

                        {/* Contact cards */}
                        <div className="space-y-2">
                          {statusContacts.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No contacts</p>
                          ) : (
                            statusContacts.map((contact) => (
                              <a
                                key={contact.id}
                                href={`https://app.hubspot.com/contacts/${HUBSPOT_ACCOUNT}/record/0-1/${contact.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <Card className="p-3 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">
                                        {[contact.firstname, contact.lastname].filter(Boolean).join(" ") || "Unknown"}
                                      </p>
                                      {contact.company && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                                          <span className="truncate">{contact.company}</span>
                                        </p>
                                      )}
                                      {contact.email && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                          <Mail className="h-3.5 w-3.5 shrink-0" />
                                          <span className="truncate">{contact.email}</span>
                                        </p>
                                      )}
                                    </div>
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5" />
                                  </div>

                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                                    <span className="text-sm text-muted-foreground">
                                      {contact.lastmodifieddate
                                        ? formatDistanceToNow(new Date(contact.lastmodifieddate), { addSuffix: true })
                                        : ""}
                                    </span>
                                    {contact.hubspot_owner_id && leadOwners[contact.hubspot_owner_id] && (
                                      <span className="text-sm text-muted-foreground">
                                        {leadOwners[contact.hubspot_owner_id].split(" ")[0]}
                                      </span>
                                    )}
                                  </div>
                                </Card>
                              </a>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </TabsContent>

          {/* ---- DEALS TAB ---- */}
          <TabsContent value="deals" className="mt-0">
            {/* Pipeline stats bar */}
            {!dealsLoading && pipelineStats && (
              <div className="mb-6 rounded-lg border border-border bg-muted/30 px-6 py-5">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-8">
                  <div>
                    <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">Open Pipeline</p>
                    <p className="text-2xl font-bold mt-1">${pipelineStats.openPipeline >= 1_000_000 ? (pipelineStats.openPipeline / 1_000_000).toFixed(2) + "M" : (pipelineStats.openPipeline / 1_000).toFixed(0) + "K"}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{pipelineStats.openCount} deals</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">Weighted Pipeline</p>
                    <p className="text-2xl font-bold mt-1">${pipelineStats.weightedPipeline >= 1_000_000 ? (pipelineStats.weightedPipeline / 1_000_000).toFixed(2) + "M" : (pipelineStats.weightedPipeline / 1_000).toFixed(0) + "K"}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">by stage probability</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">Closing This Month</p>
                    <p className="text-2xl font-bold mt-1">${pipelineStats.closingThisMonthValue >= 1_000_000 ? (pipelineStats.closingThisMonthValue / 1_000_000).toFixed(2) + "M" : (pipelineStats.closingThisMonthValue / 1_000).toFixed(0) + "K"}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{pipelineStats.closingThisMonthCount} deals</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold mt-1">{pipelineStats.winRate > 0 ? pipelineStats.winRate.toFixed(0) + "%" : "—"}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">trailing 12 months</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">Avg Deal Size</p>
                    <p className="text-2xl font-bold mt-1">${pipelineStats.avgDealSize >= 1_000_000 ? (pipelineStats.avgDealSize / 1_000_000).toFixed(2) + "M" : (pipelineStats.avgDealSize / 1_000).toFixed(1) + "K"}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">open deals</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">Avg Sales Cycle</p>
                    <p className="text-2xl font-bold mt-1">{pipelineStats.avgCycle > 0 ? pipelineStats.avgCycle.toFixed(1) + " days" : "—"}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">create to close</p>
                  </div>
                </div>
              </div>
            )}

            {dealsLoading ? (
              <div className="flex items-center justify-center py-24">
                <BrandLoader size={64} />
              </div>
            ) : dealsError ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="text-sm text-destructive font-medium">{dealsError}</div>
                <Button variant="outline" size="sm" onClick={() => fetchDeals()}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Retry
                </Button>
              </div>
            ) : (
              <ScrollArea className="w-full">
                {/* Chevron pipeline bar */}
                {(() => {
                  const openStages = pipelineInfo?.stages.filter((s) => !s.closed) || [];
                  return (
                    <div className="flex mb-4" style={{ minWidth: openStages.length * 300 + (openStages.length - 1) * 16 }}>
                      {openStages.map((stage, i) => {
                        const stageDeals = dealsByStage[stage.id] || [];
                        const total = stageTotal(stageDeals);
                        const isFirst = i === 0;
                        const isLast = i === openStages.length - 1;
                        return (
                          <div
                            key={stage.id}
                            className="relative flex items-center shrink-0"
                            style={{ width: 300 + (isLast ? 0 : 16), marginLeft: isFirst ? 0 : -16 }}
                          >
                            <svg
                              viewBox="0 0 316 48"
                              className="absolute inset-0 w-full h-full"
                              preserveAspectRatio="none"
                            >
                              <path
                                d={isFirst
                                  ? "M4 4 L290 4 L312 24 L290 44 L4 44 Z"
                                  : isLast
                                  ? "M0 4 L20 24 L0 44 L312 44 L312 4 Z"
                                  : "M0 4 L20 24 L0 44 L290 44 L312 24 L290 4 Z"
                                }
                                fill="none"
                                stroke="hsl(var(--border))"
                                strokeWidth="1.5"
                                rx="2"
                              />
                              <path
                                d={isFirst
                                  ? "M4 4 L290 4 L312 24 L290 44 L4 44 Z"
                                  : isLast
                                  ? "M0 4 L20 24 L0 44 L312 44 L312 4 Z"
                                  : "M0 4 L20 24 L0 44 L290 44 L312 24 L290 4 Z"
                                }
                                fill="hsl(var(--muted) / 0.4)"
                              />
                            </svg>
                            <div className="relative z-10 flex items-center justify-between w-full px-5 py-2" style={{ paddingLeft: isFirst ? 20 : 28 }}>
                              <div className="min-w-0">
                                <span className="text-sm font-semibold truncate block">{stage.label}</span>
                                <span className="text-sm text-muted-foreground">${total.toLocaleString()}</span>
                              </div>
                              <Badge variant="secondary" className="text-sm shrink-0 ml-2">
                                {stageDeals.length}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="flex gap-4 pb-4" style={{ minWidth: Object.keys(dealsByStage).length * 300 }}>
                  {pipelineInfo?.stages
                    .filter((s) => !s.closed)
                    .map((stage) => {
                      const stageDeals = dealsByStage[stage.id] || [];
                      return (
                        <div key={stage.id} className="w-[300px] shrink-0">

                          {/* Deal cards */}
                          <div className="space-y-2">
                            {stageDeals.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">No deals</p>
                            ) : (
                              stageDeals.map((deal) => (
                                <button
                                  key={deal.id}
                                  onClick={() => setSelectedDeal(deal)}
                                  className="block w-full text-left"
                                >
                                  <Card className="p-3 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                                    <p className="text-sm font-semibold text-primary leading-snug">
                                      {deal.dealname || "Untitled Deal"}
                                    </p>
                                    {deal.companyName && (
                                      <p className="text-sm text-muted-foreground mt-0.5">
                                        {deal.companyName}
                                      </p>
                                    )}
                                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                      {deal.amount && (
                                        <p>Amount: <span className="text-foreground font-medium">${Number(deal.amount).toLocaleString()}</span></p>
                                      )}
                                      {deal.closedate && (
                                        <p>Close date: <span className={isPast(new Date(deal.closedate)) ? "text-red-500" : "text-foreground"}>{format(new Date(deal.closedate), "MM/dd/yyyy")}</span></p>
                                      )}
                                      {deal.deal_source_details && (
                                        <p>Deal Source: <span className="text-foreground">{deal.deal_source_details.replace(/_/g, " ")}</span></p>
                                      )}
                                    </div>
                                  </Card>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* ---- Deal Detail Drawer ---- */}
        <Sheet open={!!selectedDeal} onOpenChange={(o) => !o && setSelectedDeal(null)}>
          <SheetContent side="right" className="sm:max-w-md p-0 flex flex-col">
            {selectedDeal && (() => {
              const stageDef = pipelineInfo?.stages.find((s) => s.id === selectedDeal.dealstage);
              const pipeLabel = pipelineInfo?.label || "";
              return (
                <>
                  {/* Header */}
                  <div className="px-6 pt-8 pb-4 border-b border-border bg-primary/5">
                    <p className="text-xl font-bold">{selectedDeal.dealname}</p>
                    <a
                      href={`https://app.hubspot.com/contacts/${HUBSPOT_ACCOUNT}/record/0-3/${selectedDeal.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      View in HubSpot <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Deal summary */}
                  <div className="px-6 py-4 border-b border-border space-y-2 text-sm">
                    {selectedDeal.amount && (
                      <p className="text-muted-foreground">Amount: <span className="text-foreground font-semibold">${Number(selectedDeal.amount).toLocaleString()}</span></p>
                    )}
                    {selectedDeal.closedate && (
                      <p className="text-muted-foreground">Close Date: <span className={`font-medium ${isPast(new Date(selectedDeal.closedate)) ? "text-red-500" : "text-foreground"}`}>{format(new Date(selectedDeal.closedate), "MM/dd/yyyy")}</span></p>
                    )}
                    <p className="text-muted-foreground">Pipeline: <span className="text-foreground">{pipeLabel}</span></p>
                    <p className="text-muted-foreground">Deal Stage: <span className="text-foreground">{stageDef?.label || selectedDeal.dealstage}</span></p>
                  </div>

                  {/* About this deal */}
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    <p className="text-sm font-semibold mb-4">About this deal</p>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Deal owner</p>
                        <p className="text-sm font-medium mt-0.5">
                          {selectedDeal.hubspot_owner_id && owners[selectedDeal.hubspot_owner_id]
                            ? owners[selectedDeal.hubspot_owner_id]
                            : "Unassigned"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Last Contacted</p>
                        <p className="text-sm mt-0.5">
                          {selectedDeal.notes_last_contacted
                            ? format(new Date(selectedDeal.notes_last_contacted), "MM/dd/yyyy h:mm a")
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Deal Type</p>
                        <p className="text-sm mt-0.5">{selectedDeal.dealtype || "—"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Priority</p>
                        <p className="text-sm mt-0.5">{selectedDeal.hs_priority || "—"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Deal Source</p>
                        <p className="text-sm mt-0.5">
                          {selectedDeal.deal_source_details
                            ? selectedDeal.deal_source_details.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Forecast Probability</p>
                        <p className="text-sm mt-0.5">
                          {selectedDeal.hs_forecast_probability
                            ? `${Number(selectedDeal.hs_forecast_probability).toFixed(0)}%`
                            : "—"}
                        </p>
                      </div>
                      {selectedDeal.companyName && (
                        <div>
                          <p className="text-sm text-muted-foreground">Company</p>
                          <p className="text-sm mt-0.5">{selectedDeal.companyName}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="text-sm mt-0.5">
                          {selectedDeal.createdate
                            ? format(new Date(selectedDeal.createdate), "MM/dd/yyyy")
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
