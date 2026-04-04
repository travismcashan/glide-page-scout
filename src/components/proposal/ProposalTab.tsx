import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useServiceOfferings, type Offering } from "@/hooks/useServiceOfferings";
import type { TimelineItem } from "@/types/roadmap";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import ProposalHero from "./sections/ProposalHero";
import WhatWeHeard from "./sections/WhatWeHeard";
import NorthStar from "./sections/NorthStar";
import MeasurementPlan from "./sections/MeasurementPlan";
import StrategicFoundation from "./sections/StrategicFoundation";
import ProposalGrowthPlan from "./sections/ProposalGrowthPlan";
import ProposalCaseStudies, { type CaseStudy } from "./sections/ProposalCaseStudies";
import ProposalTestimonials from "./sections/ProposalTestimonials";
import ProposalInvestment from "./sections/ProposalInvestment";
import WhyGlide from "./sections/WhyGlide";
import ProposalFAQ from "./sections/ProposalFAQ";
import NextSteps from "./sections/NextSteps";

interface ProposalTabProps {
  sessionId: string;
  domain?: string;
  companyId?: string;
  initialCompanyName?: string;
  dealId?: string;
}

export interface ProposalData {
  whatWeHeard: { title: string; quote: string; author: string }[];
  northStar: { position: string; positionDetail: string; project: string; projectDetail: string };
  measurementPlan: { metric: string; baseline: string; target: string; method: string }[];
  strategicFoundation: { category: string; points: string[] }[];
  whyGlide: { number: string; title: string; subtitle: string; items: { label: string; text: string }[] }[];
  faqs: { question: string; answer: string }[];
}

const EMPTY_PROPOSAL: ProposalData = {
  whatWeHeard: [],
  northStar: { position: "", positionDetail: "", project: "", projectDetail: "" },
  measurementPlan: [],
  strategicFoundation: [],
  whyGlide: [],
  faqs: [],
};

function isRecurringOffering(offering: Offering): boolean {
  return (
    offering.billingType === "Retainer" ||
    (offering.billingType === "T&M" &&
      offering.minRetainer == null &&
      offering.maxRetainer == null &&
      (offering.minHourly != null || offering.maxHourly != null))
  );
}

export default function ProposalTab({ sessionId, domain, companyId, initialCompanyName, dealId }: ProposalTabProps) {
  const { user } = useAuth();
  const { offerings, loading: offeringsLoading } = useServiceOfferings();
  const [proposalData, setProposalData] = useState<ProposalData>(EMPTY_PROPOSAL);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [companyName, setCompanyName] = useState(domain?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "");

  // ── Section-by-section generation state ─────────────────────
  type SectionKey = 'whatWeHeard' | 'northStar' | 'measurementPlan' | 'strategicFoundation' | 'whyGlide' | 'faqs';
  type SectionStatus = 'idle' | 'generating' | 'complete' | 'error';
  const SECTION_ORDER: SectionKey[] = ['whatWeHeard', 'northStar', 'measurementPlan', 'strategicFoundation', 'whyGlide', 'faqs'];
  const SECTION_LABELS: Record<SectionKey, string> = {
    whatWeHeard: 'Synthesizing what we heard...',
    northStar: 'Defining the North Star positioning...',
    measurementPlan: 'Building measurement plan with KPIs...',
    strategicFoundation: 'Running 5C strategic diagnostic...',
    whyGlide: "Crafting 'Why GLIDE' value narrative...",
    faqs: 'Generating client-specific FAQs...',
  };
  const [sectionStatuses, setSectionStatuses] = useState<Record<SectionKey, SectionStatus>>(
    () => Object.fromEntries(SECTION_ORDER.map(k => [k, 'idle'])) as Record<SectionKey, SectionStatus>
  );
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState<SectionKey | null>(null);
  const contextRef = useRef<{ clientContext: string; ragContext: string; clientName: string; domain: string } | null>(null);
  const isGenerating = currentSection !== null || SECTION_ORDER.some(k => sectionStatuses[k] === 'generating');

  // ── Case studies state ───────────────────────────────────────
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);

  // ── Roadmap state (interactive, same as RoadmapTab) ─────────
  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [startMonthIndex, setStartMonthIndex] = useState(new Date().getMonth());
  const [totalMonths, setTotalMonths] = useState(12);
  const [outcomesData, setOutcomesData] = useState<Record<number, string[]>>({});
  const [roadmapLoaded, setRoadmapLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Load roadmap (company-first, session fallback) ──────────
  useEffect(() => {
    if ((!sessionId && !companyId) || offeringsLoading) return;
    (async () => {
      let existing: any = null;
      if (companyId) {
        const { data } = await supabase
          .from("roadmaps" as any)
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        existing = data;
      }
      if (!existing && sessionId) {
        const { data } = await supabase
          .from("roadmaps" as any)
          .select("*")
          .eq("session_id", sessionId)
          .maybeSingle();
        existing = data;
      }

      const roadmap = existing as any;
      if (!roadmap) { setRoadmapLoaded(true); return; }

      setRoadmapId(roadmap.id);
      setStartMonthIndex(roadmap.start_month ?? new Date().getMonth());
      setTotalMonths(roadmap.total_months ?? 12);
      if (roadmap.outcomes_data && typeof roadmap.outcomes_data === "object") {
        setOutcomesData(roadmap.outcomes_data as Record<number, string[]>);
      }

      const { data: dbItems } = await supabase
        .from("roadmap_items" as any)
        .select("*")
        .eq("roadmap_id", roadmap.id);

      if (dbItems) {
        setItems(
          (dbItems as any[]).map((di) => {
            const offering = offerings.find((o) => o.sku === di.sku);
            return {
              sku: di.sku,
              name: di.custom_name || offering?.name || `SKU ${di.sku}`,
              pillar: offering?.pillar || "IS",
              startMonth: di.start_month,
              duration: di.duration,
              sortOrder: di.sort_order ?? 0,
              unitPrice: di.unit_price ?? null,
              estimatedAdSpend: di.estimated_ad_spend ?? null,
              discountType: di.discount_type ?? null,
              discountValue: di.discount_value ?? null,
            };
          })
        );
      }
      setRoadmapLoaded(true);
    })();
  }, [sessionId, offeringsLoading, offerings]);

  // ── Auto-save roadmap items on change ───────────────────────
  const saveRoadmap = useCallback(() => {
    if (!roadmapId || !roadmapLoaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await supabase.from("roadmap_items" as any).delete().eq("roadmap_id", roadmapId);
      if (items.length > 0) {
        await supabase.from("roadmap_items" as any).insert(
          items.map((i) => {
            const offering = offerings.find((o) => o.sku === i.sku);
            const recurring = offering ? isRecurringOffering(offering) : false;
            return {
              roadmap_id: roadmapId,
              sku: i.sku,
              start_month: i.startMonth,
              duration: i.duration,
              custom_name: i.name,
              sort_order: i.sortOrder,
              unit_price: i.unitPrice ?? null,
              billing_type: offering?.billingType ?? null,
              is_recurring: recurring,
              estimated_ad_spend: i.estimatedAdSpend ?? null,
              discount_type: i.discountType ?? null,
              discount_value: i.discountValue ?? null,
            };
          })
        );
      }
    }, 800);
  }, [roadmapId, roadmapLoaded, items, offerings]);

  useEffect(() => { saveRoadmap(); }, [saveRoadmap]);

  // ── Item handlers (identical to RoadmapTab) ─────────────────
  const moveItem = useCallback((sku: number, newStart: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.sku !== sku) return item;
        const snapped = Math.round(newStart * 2) / 2;
        return { ...item, startMonth: Math.max(0, Math.min(snapped, totalMonths - item.duration)) };
      })
    );
  }, [totalMonths]);

  const resizeItem = useCallback((sku: number, newStart: number, newDuration: number) => {
    setItems((prev) => {
      const resized = prev.find((i) => i.sku === sku);
      if (!resized) return prev;
      const duration = Math.max(0.5, newDuration);
      const start = Math.max(0, newStart);
      const clampedDuration = Math.min(duration, totalMonths - start);
      const newEnd = start + clampedDuration;
      const oldEnd = resized.startMonth + resized.duration;
      const delta = newEnd - oldEnd;
      const isFB = resized.pillar === "IS" || resized.pillar === "FB";
      return prev.map((item) => {
        if (item.sku === sku) return { ...item, startMonth: start, duration: clampedDuration };
        if (isFB && delta > 0 && (item.pillar === "GO" || item.pillar === "TS") && newEnd > item.startMonth) {
          const pushed = newEnd;
          const newItemDuration = Math.min(item.duration, totalMonths - pushed);
          if (pushed < totalMonths) return { ...item, startMonth: pushed, duration: Math.max(0.5, newItemDuration) };
        }
        return item;
      });
    });
  }, [totalMonths]);

  const removeItem = useCallback((sku: number) => {
    setItems((prev) => prev.filter((i) => i.sku !== sku));
  }, []);

  const renameItem = useCallback((sku: number, newName: string) => {
    setItems((prev) => prev.map((item) => (item.sku === sku ? { ...item, name: newName } : item)));
  }, []);

  const reorderItem = useCallback((sku: number, direction: "up" | "down") => {
    setItems((prev) => {
      const item = prev.find((i) => i.sku === sku);
      if (!item) return prev;
      const pillarItems = prev.filter((i) => i.pillar === item.pillar).sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = pillarItems.findIndex((i) => i.sku === sku);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= pillarItems.length) return prev;
      const swapItem = pillarItems[swapIdx];
      return prev.map((i) => {
        if (i.sku === sku) return { ...i, sortOrder: swapItem.sortOrder };
        if (i.sku === swapItem.sku) return { ...i, sortOrder: item.sortOrder };
        return i;
      });
    });
  }, []);

  const setItemPrice = useCallback((sku: number, price: number) => {
    setItems((prev) => prev.map((item) => (item.sku === sku ? { ...item, unitPrice: price } : item)));
  }, []);

  const setItemAdSpend = useCallback((sku: number, adSpend: number) => {
    setItems((prev) => prev.map((item) => (item.sku === sku ? { ...item, estimatedAdSpend: adSpend } : item)));
  }, []);

  const setItemDiscount = useCallback((sku: number, type: "percent" | "fixed" | null, value: number | null) => {
    setItems((prev) => prev.map((item) => (item.sku === sku ? { ...item, discountType: type, discountValue: value } : item)));
  }, []);

  const getMinPrice = useCallback((offering: Offering): number | null => {
    if (offering.minRetainer != null) return Number(offering.minRetainer);
    if (offering.minFixed != null) return Number(offering.minFixed);
    if (offering.minHourly != null) {
      const rate = Number(offering.hourlyRateExternal ?? 150);
      return Number(offering.minHourly) * rate;
    }
    return null;
  }, []);

  const dropOffering = useCallback((sku: number, startMonth: number) => {
    setItems((prev) => {
      if (prev.some((i) => i.sku === sku)) return prev;
      const offering = offerings.find((o) => o.sku === sku);
      if (!offering) return prev;
      const clamped = Math.max(0, Math.min(startMonth, totalMonths - 1));
      const duration = Math.min(offering.defaultDuration, totalMonths - clamped);
      const pillarCount = prev.filter((i) => i.pillar === offering.pillar).length;
      const defaultPrice = getMinPrice(offering);
      return [...prev, { sku: offering.sku, name: offering.name, pillar: offering.pillar, startMonth: clamped, duration, sortOrder: pillarCount, unitPrice: defaultPrice }];
    });
  }, [totalMonths, offerings, getMinPrice]);

  const handleOutcomesChange = useCallback((outcomes: Record<number, string[]>) => {
    setOutcomesData(outcomes);
  }, []);

  // ── Load proposal + HubSpot contact (company-first) ─────────
  useEffect(() => {
    if (!sessionId && !companyId) return;
    (async () => {
      let data: any = null;
      if (companyId) {
        const { data: byCompany } = await supabase
          .from("proposals" as any)
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        data = byCompany;
      }
      if (!data && sessionId) {
        const { data: bySession } = await supabase
          .from("proposals" as any)
          .select("*")
          .eq("session_id", sessionId)
          .maybeSingle();
        data = bySession;
      }
      if (data) {
        const d = data as any;
        if (d.proposal_data) {
          setProposalData(d.proposal_data);
          setHasGenerated(true);
        }
        if (d.contact_name) setContactName(d.contact_name);
        if (d.contact_title) setContactTitle(d.contact_title);
        if (d.contact_email) setContactEmail(d.contact_email);
        if (d.company_name) setCompanyName(d.company_name);
        return;
      }

      // No saved proposal — pull primary contact from HubSpot
      const { data: session } = await supabase
        .from("crawl_sessions" as any)
        .select("hubspot_data")
        .eq("id", sessionId)
        .maybeSingle();
      if (session) {
        const hs = (session as any).hubspot_data;
        if (hs?.contacts?.length) {
          const primary = hs.contacts[0];
          const name = [primary.firstname, primary.lastname].filter(Boolean).join(" ");
          if (name) setContactName(name);
          if (primary.jobtitle) setContactTitle(primary.jobtitle);
          if (primary.email) setContactEmail(primary.email);
        }
        if (hs?.companies?.length) {
          const co = hs.companies[0];
          if (co.name) setCompanyName(co.name);
        }
      }
    })();

    // Load case studies
    (async () => {
      const { data: cs } = await (supabase.from("proposal_case_studies" as any) as any)
        .select("*")
        .eq("session_id", sessionId)
        .order("sort_order");
      if (cs?.length) setCaseStudies(cs.map((c: any) => ({ ...c, references: c.sources || c.references })));
    })();
  }, [sessionId]);

  // ── Save proposal (company_id is primary parent) ────────────
  const saveProposal = useCallback(async (data: ProposalData) => {
    const payload: any = {
      user_id: user?.id ?? null,
      proposal_data: data,
      contact_name: contactName,
      contact_title: contactTitle,
      contact_email: contactEmail,
      company_name: companyName,
      updated_at: new Date().toISOString(),
    };
    if (companyId) payload.company_id = companyId;
    if (sessionId) payload.session_id = sessionId;
    if (dealId) payload.deal_id = dealId;

    // Upsert by session_id for backward compat (existing records keyed by session)
    if (sessionId) {
      await supabase.from("proposals" as any).upsert(payload, { onConflict: "session_id" });
    } else {
      await supabase.from("proposals" as any).insert(payload);
    }
  }, [sessionId, companyId, dealId, user, contactName, contactTitle, contactEmail, companyName]);

  const generateSection = useCallback(async (
    sectionKey: SectionKey,
    context: { clientContext: string; ragContext: string; clientName: string; domain: string },
    priorData: ProposalData,
  ): Promise<any> => {
    setSectionStatuses(prev => ({ ...prev, [sectionKey]: 'generating' }));
    setCurrentSection(sectionKey);
    setSectionErrors(prev => { const n = { ...prev }; delete n[sectionKey]; return n; });

    // Build priorSections from already-completed sections
    const priorSections: Record<string, any> = {};
    for (const key of SECTION_ORDER) {
      if (key === sectionKey) break;
      const val = priorData[key];
      if (val && (Array.isArray(val) ? val.length > 0 : typeof val === 'object' && Object.values(val).some(v => v))) {
        priorSections[key] = val;
      }
    }

    const { data, error } = await supabase.functions.invoke("generate-proposal-section", {
      body: { section: sectionKey, ...context, priorSections },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data?.data?.[sectionKey] ?? data?.data;
  }, []);

  const generateProposal = useCallback(async () => {
    // Reset all sections
    setSectionStatuses(Object.fromEntries(SECTION_ORDER.map(k => [k, 'idle'])) as Record<SectionKey, SectionStatus>);
    setSectionErrors({});

    // Step 1: Gather context once
    setCurrentSection('whatWeHeard'); // Show loading state
    try {
      const { data: ctx, error: ctxErr } = await supabase.functions.invoke("gather-proposal-context", {
        body: { sessionId },
      });
      if (ctxErr) throw ctxErr;
      if (ctx?.error) throw new Error(ctx.error);
      contextRef.current = ctx;
      if (ctx.clientName && !companyName) setCompanyName(ctx.clientName);
    } catch (e: any) {
      toast.error("Failed to gather client context: " + (e?.message || "Unknown error"));
      setCurrentSection(null);
      return;
    }

    // Step 2: Generate sections sequentially
    let accumulatedData = { ...EMPTY_PROPOSAL };
    for (const sectionKey of SECTION_ORDER) {
      try {
        const sectionData = await generateSection(sectionKey, contextRef.current!, accumulatedData);
        accumulatedData = { ...accumulatedData, [sectionKey]: sectionData };
        setProposalData({ ...accumulatedData });
        setHasGenerated(true);
        setSectionStatuses(prev => ({ ...prev, [sectionKey]: 'complete' }));
        // Incremental save
        await saveProposal(accumulatedData);
      } catch (e: any) {
        console.error(`Section ${sectionKey} failed:`, e);
        setSectionStatuses(prev => ({ ...prev, [sectionKey]: 'error' }));
        setSectionErrors(prev => ({ ...prev, [sectionKey]: e?.message || 'Generation failed' }));
        // Continue to next section
      }
    }
    setCurrentSection(null);
    toast.success("Proposal generation complete");
  }, [sessionId, companyName, saveProposal, generateSection]);

  const retrySection = useCallback(async (sectionKey: SectionKey) => {
    if (!contextRef.current) { toast.error("No context cached. Regenerate the full proposal."); return; }
    try {
      const sectionData = await generateSection(sectionKey, contextRef.current, proposalData);
      const updated = { ...proposalData, [sectionKey]: sectionData };
      setProposalData(updated);
      setSectionStatuses(prev => ({ ...prev, [sectionKey]: 'complete' }));
      await saveProposal(updated);
      toast.success(`${sectionKey} regenerated`);
    } catch (e: any) {
      setSectionStatuses(prev => ({ ...prev, [sectionKey]: 'error' }));
      setSectionErrors(prev => ({ ...prev, [sectionKey]: e?.message || 'Retry failed' }));
    }
    setCurrentSection(null);
  }, [proposalData, generateSection, saveProposal]);

  // ── Empty state ─────────────────────────────────────────────
  if (!hasGenerated && !isGenerating) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border border-border bg-background p-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Generate Client Proposal</h2>
            <p className="text-muted-foreground">
              AI will analyze your client context, discovery notes, and roadmap to generate a complete proposal with strategic positioning, measurement plan, and tailored recommendations.
            </p>

            <div className="grid grid-cols-2 gap-4 text-left max-w-lg mx-auto">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact Name</label>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. Jane Smith" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</label>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. Marketing Director" value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. jane@company.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</label>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. Acme Corp" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
            </div>

            <Button size="lg" className="gap-2" onClick={generateProposal}>
              <Sparkles className="h-4 w-4" />
              Generate Proposal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Section skeleton for progressive rendering ──────────────
  const SectionSkeleton = ({ sectionKey }: { sectionKey: SectionKey }) => (
    <section className="py-12 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">{SECTION_LABELS[sectionKey]}</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-3/4 rounded-full bg-primary/10 animate-pulse" />
          <div className="h-3 w-full rounded-full bg-primary/[0.07] animate-pulse [animation-delay:150ms]" />
          <div className="h-3 w-5/6 rounded-full bg-primary/[0.07] animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    </section>
  );

  const SectionError = ({ sectionKey }: { sectionKey: SectionKey }) => (
    <section className="py-8 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-destructive">Failed to generate: {sectionKey}</p>
          <p className="text-xs text-muted-foreground mt-1">{sectionErrors[sectionKey]}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => retrySection(sectionKey)}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    </section>
  );

  // Helper: should we show a section's content?
  const sectionReady = (key: SectionKey) => {
    const d = proposalData[key];
    if (Array.isArray(d)) return d.length > 0;
    if (typeof d === 'object' && d) return Object.values(d).some(v => v);
    return false;
  };

  // ── Full proposal (progressive rendering) ──────────────────
  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5">
        <p className="text-sm text-muted-foreground">
          Proposal for <strong className="text-foreground">{companyName || domain}</strong>
          {contactName && <> / {contactName}</>}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={generateProposal} disabled={isGenerating}>
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Proposal sections — progressive rendering */}
      <ProposalHero
        domain={domain}
        companyName={companyName}
        contactName={contactName}
        contactTitle={contactTitle}
        contactEmail={contactEmail}
      />
      {sectionStatuses.whatWeHeard === 'generating' && <SectionSkeleton sectionKey="whatWeHeard" />}
      {sectionStatuses.whatWeHeard === 'error' && <SectionError sectionKey="whatWeHeard" />}
      {sectionReady('whatWeHeard') && <WhatWeHeard insights={proposalData.whatWeHeard} />}

      {sectionStatuses.northStar === 'generating' && <SectionSkeleton sectionKey="northStar" />}
      {sectionStatuses.northStar === 'error' && <SectionError sectionKey="northStar" />}
      {sectionReady('northStar') && <NorthStar data={proposalData.northStar} />}

      {sectionStatuses.measurementPlan === 'generating' && <SectionSkeleton sectionKey="measurementPlan" />}
      {sectionStatuses.measurementPlan === 'error' && <SectionError sectionKey="measurementPlan" />}
      {sectionReady('measurementPlan') && <MeasurementPlan kpis={proposalData.measurementPlan} />}

      {sectionStatuses.strategicFoundation === 'generating' && <SectionSkeleton sectionKey="strategicFoundation" />}
      {sectionStatuses.strategicFoundation === 'error' && <SectionError sectionKey="strategicFoundation" />}
      {sectionReady('strategicFoundation') && <StrategicFoundation categories={proposalData.strategicFoundation} />}
      <ProposalGrowthPlan
        items={items}
        offerings={offerings}
        startMonthIndex={startMonthIndex}
        totalMonths={totalMonths}
        onMove={moveItem}
        onResize={resizeItem}
        onRemove={removeItem}
        onDropOffering={dropOffering}
        onRename={renameItem}
        onReorder={reorderItem}
        onSetPrice={setItemPrice}
        onSetAdSpend={setItemAdSpend}
        onSetDiscount={setItemDiscount}
      />
      <ProposalCaseStudies sessionId={sessionId} clientName={companyName} domain={domain} caseStudies={caseStudies} onCaseStudiesChange={setCaseStudies} />
      <ProposalTestimonials />
      <ProposalInvestment
        items={items}
        offerings={offerings}
        sessionId={sessionId}
        savedOutcomes={outcomesData}
        onOutcomesChange={handleOutcomesChange}
      />
      {sectionStatuses.whyGlide === 'generating' && <SectionSkeleton sectionKey="whyGlide" />}
      {sectionStatuses.whyGlide === 'error' && <SectionError sectionKey="whyGlide" />}
      {sectionReady('whyGlide') ? <WhyGlide pillars={proposalData.whyGlide} companyName={companyName} /> : !isGenerating && <WhyGlide pillars={[]} companyName={companyName} />}

      {sectionStatuses.faqs === 'generating' && <SectionSkeleton sectionKey="faqs" />}
      {sectionStatuses.faqs === 'error' && <SectionError sectionKey="faqs" />}
      {sectionReady('faqs') && <ProposalFAQ faqs={proposalData.faqs} />}
      <NextSteps contactEmail={contactEmail} />
    </div>
  );
}
