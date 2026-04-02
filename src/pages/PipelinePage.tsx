import { useState, useEffect, useMemo } from "react";
import {
  DollarSign, Calendar, Building2, ExternalLink, RefreshCw, Mail, Phone, User,
  Loader2, ChevronDown, Eye, EyeOff, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
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

export default function PipelinePage() {
  const [activeTab, setActiveTab] = useState("deals");

  // Deals state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [allDeals, setAllDeals] = useState<Deal[]>([]); // includes closed, for stats
  const [dealsLoading, setDealsLoading] = useState(true);
  const [pipelineInfo, setPipelineInfo] = useState<PipelineInfo | null>(null);
  const [pipelineOptions, setPipelineOptions] = useState<PipelineOption[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("33bc2a42-c57c-4180-b0e6-77b3d6c7f69f");
  const [showClosed, setShowClosed] = useState(false);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [createDateFilter, setCreateDateFilter] = useState<string>("all");
  const [closeDateFilter, setCloseDateFilter] = useState<string>("all");

  // Leads state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [leadStatuses, setLeadStatuses] = useState<StatusInfo[]>([]);
  const [leadOwners, setLeadOwners] = useState<Record<string, string>>({});

  // ---- Fetch deals ----
  const fetchDeals = async (pipelineId?: string) => {
    setDealsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("hubspot-pipeline", {
        body: {
          action: "deals",
          pipeline: pipelineId || selectedPipeline,
        },
      });
      if (error) {
        // Try to read response body for debugging
        console.error("Deals fetch error details:", error, data);
        throw error;
      }
      setAllDeals(data.deals || []);
      setDeals(data.deals || []);
      setOwners(data.owners || {});
      if (data.pipeline) setPipelineInfo(data.pipeline);
      if (data.pipelines) setPipelineOptions(data.pipelines);
    } catch (err) {
      console.error("Failed to fetch deals:", err);
    }
    setDealsLoading(false);
  };

  // ---- Fetch leads ----
  const fetchLeads = async () => {
    setContactsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("hubspot-pipeline", {
        body: { action: "leads" },
      });
      if (error) throw error;
      setContacts(data.contacts || []);
      setLeadOwners(data.owners || {});
      if (data.statuses) setLeadStatuses(data.statuses);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    }
    setContactsLoading(false);
  };

  useEffect(() => { fetchDeals(); }, [selectedPipeline]);
  useEffect(() => { fetchLeads(); }, []);

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

  // ---- Computed: deals grouped by stage ----
  const dealsByStage = useMemo(() => {
    if (!pipelineInfo) return {};
    const map: Record<string, Deal[]> = {};
    for (const stage of pipelineInfo.stages) {
      if (!showClosed && stage.closed) continue;
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
  }, [deals, pipelineInfo, showClosed, ownerFilter, createDateFilter, closeDateFilter]);

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

  // ---- Summary stats (computed from allDeals) ----
  const pipelineStats = useMemo(() => {
    if (!pipelineInfo) return null;
    const closedWonIds = new Set(
      pipelineInfo.stages.filter((s) => s.label.includes("Won")).map((s) => s.id)
    );
    const closedIds = new Set(
      pipelineInfo.stages.filter((s) => s.closed).map((s) => s.id)
    );

    const filtered = ownerFilter === "all" ? allDeals : allDeals.filter((d) => d.hubspot_owner_id === ownerFilter);

    const open = filtered.filter((d) => !closedIds.has(d.dealstage));
    const closedWon = filtered.filter((d) => closedWonIds.has(d.dealstage));
    const closedAll = filtered.filter((d) => closedIds.has(d.dealstage));

    const openPipeline = open.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const weightedPipeline = open.reduce((s, d) => {
      const prob = STAGE_PROBABILITY[d.dealstage] || 0.5;
      return s + (Number(d.amount) || 0) * prob;
    }, 0);

    // Closing this month
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const closingThisMonth = open.filter((d) => {
      if (!d.closedate) return false;
      const cd = new Date(d.closedate);
      return cd <= monthEnd && cd >= new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const closingThisMonthValue = closingThisMonth.reduce((s, d) => s + (Number(d.amount) || 0), 0);

    // Win rate (closed-won / total closed, trailing 12 months)
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const recentClosed = closedAll.filter((d) => d.closedate && new Date(d.closedate) >= yearAgo);
    const recentWon = closedWon.filter((d) => d.closedate && new Date(d.closedate) >= yearAgo);
    const winRate = recentClosed.length > 0 ? (recentWon.length / recentClosed.length) * 100 : 0;

    // Avg deal size (open deals)
    const avgDealSize = open.length > 0 ? openPipeline / open.length : 0;

    // Avg sales cycle (closed-won deals, days from create to close)
    const cycleDays = recentWon
      .filter((d) => d.createdate && d.closedate)
      .map((d) => {
        const created = new Date(d.createdate!).getTime();
        const closed = new Date(d.closedate!).getTime();
        return (closed - created) / (1000 * 60 * 60 * 24);
      })
      .filter((d) => d > 0);
    const avgCycle = cycleDays.length > 0 ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : 0;

    return {
      openPipeline,
      weightedPipeline,
      closingThisMonthValue,
      closingThisMonthCount: closingThisMonth.length,
      winRate,
      avgDealSize,
      avgCycle,
      openCount: open.length,
    };
  }, [allDeals, pipelineInfo, ownerFilter]);

  // ---- All unique owners (merged from both) ----
  const allOwners = useMemo(() => {
    const merged = { ...owners, ...leadOwners };
    return Object.entries(merged).sort((a, b) => a[1].localeCompare(b[1]));
  }, [owners, leadOwners]);

  // ---- Stage totals ----
  const stageTotal = (stageDeals: Deal[]) =>
    stageDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-6 py-8">
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
              <SelectTrigger className="w-[180px] h-9">
                <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {allOwners.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
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
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {contacts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="deals" className="gap-2">
                <DollarSign className="h-3.5 w-3.5" />
                Deals
                {pipelineStats && pipelineStats.openCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
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

                {/* Show closed toggle */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {showClosed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  <span>Closed</span>
                  <Switch checked={showClosed} onCheckedChange={setShowClosed} />
                </div>
              </div>
            )}
          </div>

          {/* ---- LEADS TAB ---- */}
          <TabsContent value="leads" className="mt-0">
            {contactsLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                          <Badge variant="secondary" className="text-[10px]">
                            {statusContacts.length}
                          </Badge>
                        </div>

                        {/* Contact cards */}
                        <div className="space-y-2">
                          {statusContacts.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-8">No contacts</p>
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
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                          <Building2 className="h-3 w-3 shrink-0" />
                                          <span className="truncate">{contact.company}</span>
                                        </p>
                                      )}
                                      {contact.email && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                          <Mail className="h-3 w-3 shrink-0" />
                                          <span className="truncate">{contact.email}</span>
                                        </p>
                                      )}
                                    </div>
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5" />
                                  </div>

                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                                    <span className="text-[10px] text-muted-foreground">
                                      {contact.lastmodifieddate
                                        ? formatDistanceToNow(new Date(contact.lastmodifieddate), { addSuffix: true })
                                        : ""}
                                    </span>
                                    {contact.hubspot_owner_id && leadOwners[contact.hubspot_owner_id] && (
                                      <span className="text-[10px] text-muted-foreground">
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
              <div className="mb-4 rounded-lg border border-border bg-muted/30 px-6 py-4">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-6">
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Open Pipeline</p>
                    <p className="text-xl font-bold mt-0.5">${pipelineStats.openPipeline >= 1_000_000 ? (pipelineStats.openPipeline / 1_000_000).toFixed(2) + "M" : (pipelineStats.openPipeline / 1_000).toFixed(0) + "K"}</p>
                    <p className="text-[10px] text-muted-foreground">{pipelineStats.openCount} deals</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Weighted Pipeline</p>
                    <p className="text-xl font-bold mt-0.5">${pipelineStats.weightedPipeline >= 1_000_000 ? (pipelineStats.weightedPipeline / 1_000_000).toFixed(2) + "M" : (pipelineStats.weightedPipeline / 1_000).toFixed(0) + "K"}</p>
                    <p className="text-[10px] text-muted-foreground">by stage probability</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Closing This Month</p>
                    <p className="text-xl font-bold mt-0.5">${pipelineStats.closingThisMonthValue >= 1_000_000 ? (pipelineStats.closingThisMonthValue / 1_000_000).toFixed(2) + "M" : (pipelineStats.closingThisMonthValue / 1_000).toFixed(0) + "K"}</p>
                    <p className="text-[10px] text-muted-foreground">{pipelineStats.closingThisMonthCount} deals</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Win Rate</p>
                    <p className="text-xl font-bold mt-0.5">{pipelineStats.winRate > 0 ? pipelineStats.winRate.toFixed(0) + "%" : "—"}</p>
                    <p className="text-[10px] text-muted-foreground">trailing 12 months</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Avg Deal Size</p>
                    <p className="text-xl font-bold mt-0.5">${pipelineStats.avgDealSize >= 1_000_000 ? (pipelineStats.avgDealSize / 1_000_000).toFixed(2) + "M" : (pipelineStats.avgDealSize / 1_000).toFixed(1) + "K"}</p>
                    <p className="text-[10px] text-muted-foreground">open deals</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Avg Sales Cycle</p>
                    <p className="text-xl font-bold mt-0.5">{pipelineStats.avgCycle > 0 ? pipelineStats.avgCycle.toFixed(1) + " days" : "—"}</p>
                    <p className="text-[10px] text-muted-foreground">create to close</p>
                  </div>
                </div>
              </div>
            )}

            {dealsLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4" style={{ minWidth: Object.keys(dealsByStage).length * 300 }}>
                  {pipelineInfo?.stages
                    .filter((s) => showClosed || !s.closed)
                    .map((stage) => {
                      const stageDeals = dealsByStage[stage.id] || [];
                      const total = stageTotal(stageDeals);
                      return (
                        <div key={stage.id} className="w-[300px] shrink-0">
                          {/* Column header */}
                          <div className={`flex items-center justify-between px-3 py-2 mb-3 rounded-lg ${
                            stage.closed ? "bg-muted/30" : "bg-muted/50"
                          }`}>
                            <div className="min-w-0">
                              <span className={`text-sm font-semibold ${stage.closed ? "text-muted-foreground" : ""}`}>
                                {stage.label}
                              </span>
                              {total > 0 && (
                                <p className="text-[10px] text-muted-foreground">
                                  ${total.toLocaleString()}
                                </p>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                              {stageDeals.length}
                            </Badge>
                          </div>

                          {/* Deal cards */}
                          <div className="space-y-2">
                            {stageDeals.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-8">No deals</p>
                            ) : (
                              stageDeals.map((deal) => (
                                <button
                                  key={deal.id}
                                  onClick={() => setSelectedDeal(deal)}
                                  className="block w-full text-left"
                                >
                                  <Card className="p-3 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                                    <p className="text-sm font-semibold text-primary truncate">
                                      {deal.dealname || "Untitled Deal"}
                                    </p>
                                    {deal.companyName && (
                                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                        {deal.companyName}
                                      </p>
                                    )}
                                    <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
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
                        <p className="text-xs text-muted-foreground">Deal owner</p>
                        <p className="text-sm font-medium mt-0.5">
                          {selectedDeal.hubspot_owner_id && owners[selectedDeal.hubspot_owner_id]
                            ? owners[selectedDeal.hubspot_owner_id]
                            : "Unassigned"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Contacted</p>
                        <p className="text-sm mt-0.5">
                          {selectedDeal.notes_last_contacted
                            ? format(new Date(selectedDeal.notes_last_contacted), "MM/dd/yyyy h:mm a")
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Deal Type</p>
                        <p className="text-sm mt-0.5">{selectedDeal.dealtype || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Priority</p>
                        <p className="text-sm mt-0.5">{selectedDeal.hs_priority || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Deal Source</p>
                        <p className="text-sm mt-0.5">
                          {selectedDeal.deal_source_details
                            ? selectedDeal.deal_source_details.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Forecast Probability</p>
                        <p className="text-sm mt-0.5">
                          {selectedDeal.hs_forecast_probability
                            ? `${Number(selectedDeal.hs_forecast_probability).toFixed(0)}%`
                            : "—"}
                        </p>
                      </div>
                      {selectedDeal.companyName && (
                        <div>
                          <p className="text-xs text-muted-foreground">Company</p>
                          <p className="text-sm mt-0.5">{selectedDeal.companyName}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
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
