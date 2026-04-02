import { useState, useEffect, useMemo } from "react";
import {
  DollarSign, Calendar, Building2, ExternalLink, RefreshCw, Mail, Phone, User,
  Loader2, ChevronDown, Eye, EyeOff,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  const [dealsLoading, setDealsLoading] = useState(true);
  const [pipelineInfo, setPipelineInfo] = useState<PipelineInfo | null>(null);
  const [pipelineOptions, setPipelineOptions] = useState<PipelineOption[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("33bc2a42-c57c-4180-b0e6-77b3d6c7f69f");
  const [showClosed, setShowClosed] = useState(false);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

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
          includeClosedStages: showClosed,
        },
      });
      if (error) throw error;
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

  useEffect(() => { fetchDeals(); }, [selectedPipeline, showClosed]);
  useEffect(() => { fetchLeads(); }, []);

  // ---- Computed: deals grouped by stage ----
  const dealsByStage = useMemo(() => {
    if (!pipelineInfo) return {};
    const map: Record<string, Deal[]> = {};
    for (const stage of pipelineInfo.stages) {
      if (!showClosed && stage.closed) continue;
      map[stage.id] = [];
    }
    const filtered = ownerFilter === "all" ? deals : deals.filter((d) => d.hubspot_owner_id === ownerFilter);
    for (const deal of filtered) {
      if (map[deal.dealstage]) {
        map[deal.dealstage].push(deal);
      }
    }
    return map;
  }, [deals, pipelineInfo, showClosed, ownerFilter]);

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

  // ---- Summary stats ----
  const totalPipelineValue = useMemo(() => {
    const openDeals = deals.filter((d) => {
      const stage = pipelineInfo?.stages.find((s) => s.id === d.dealstage);
      return stage && !stage.closed;
    });
    return openDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [deals, pipelineInfo]);

  const openDealCount = useMemo(() => {
    return deals.filter((d) => {
      const stage = pipelineInfo?.stages.find((s) => s.id === d.dealstage);
      return stage && !stage.closed;
    }).length;
  }, [deals, pipelineInfo]);

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
                {openDealCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {openDealCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Deals-specific controls */}
            {activeTab === "deals" && (
              <div className="flex items-center gap-4">
                {/* Pipeline selector */}
                <Select value={selectedPipeline} onValueChange={(v) => { setSelectedPipeline(v); fetchDeals(v); }}>
                  <SelectTrigger className="w-[240px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelineOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
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
            {/* Summary stats */}
            {!dealsLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <Card className="p-3">
                  <p className="text-2xl font-bold">${totalPipelineValue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Open Pipeline</p>
                </Card>
                <Card className="p-3">
                  <p className="text-2xl font-bold">{openDealCount}</p>
                  <p className="text-xs text-muted-foreground">Open Deals</p>
                </Card>
                {pipelineInfo && (
                  <Card className="p-3">
                    <p className="text-2xl font-bold">
                      ${openDealCount > 0 ? Math.round(totalPipelineValue / openDealCount).toLocaleString() : "0"}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Deal Size</p>
                  </Card>
                )}
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
                              stageDeals.map((deal) => {
                                const closeDatePast = deal.closedate && isPast(new Date(deal.closedate));
                                return (
                                  <a
                                    key={deal.id}
                                    href={`https://app.hubspot.com/contacts/${HUBSPOT_ACCOUNT}/record/0-3/${deal.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <Card className="p-3 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium truncate">
                                            {deal.dealname || "Untitled Deal"}
                                          </p>
                                          {deal.companyName && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                              <Building2 className="h-3 w-3 shrink-0" />
                                              <span className="truncate">{deal.companyName}</span>
                                            </p>
                                          )}
                                        </div>
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5" />
                                      </div>

                                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                        {deal.amount && (
                                          <span className="flex items-center gap-1 font-medium text-foreground">
                                            <DollarSign className="h-3 w-3" />
                                            {Number(deal.amount).toLocaleString()}
                                          </span>
                                        )}
                                        {deal.closedate && (
                                          <span className={`flex items-center gap-1 ${closeDatePast ? "text-red-500" : ""}`}>
                                            <Calendar className="h-3 w-3" />
                                            {formatDistanceToNow(new Date(deal.closedate), { addSuffix: true })}
                                          </span>
                                        )}
                                      </div>

                                      {deal.hubspot_owner_id && owners[deal.hubspot_owner_id] && (
                                        <div className="mt-2 pt-2 border-t border-border/50">
                                          <span className="text-[10px] text-muted-foreground">
                                            {owners[deal.hubspot_owner_id]}
                                          </span>
                                        </div>
                                      )}
                                    </Card>
                                  </a>
                                );
                              })
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
      </div>
    </div>
  );
}
