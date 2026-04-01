import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useServiceOfferings, type Offering } from "@/hooks/useServiceOfferings";
import type { TimelineItem } from "@/types/roadmap";
import { Sparkles, Loader2, FileDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import ProposalHero from "./sections/ProposalHero";
import WhatWeHeard from "./sections/WhatWeHeard";
import NorthStar from "./sections/NorthStar";
import MeasurementPlan from "./sections/MeasurementPlan";
import StrategicFoundation from "./sections/StrategicFoundation";
import ProposalGrowthPlan from "./sections/ProposalGrowthPlan";
import ProposalCaseStudies from "./sections/ProposalCaseStudies";
import ProposalTestimonials from "./sections/ProposalTestimonials";
import ProposalInvestment from "./sections/ProposalInvestment";
import WhyGlide from "./sections/WhyGlide";
import ProposalFAQ from "./sections/ProposalFAQ";
import NextSteps from "./sections/NextSteps";

interface ProposalTabProps {
  sessionId: string;
  domain?: string;
}

export interface ProposalData {
  whatWeHeard: { title: string; quote: string; author: string }[];
  northStar: { position: string; positionDetail: string; project: string; projectDetail: string };
  measurementPlan: { metric: string; baseline: string; target: string; method: string }[];
  strategicFoundation: { category: string; points: string[] }[];
  whyGlide: { number: string; title: string; subtitle: string; items: { label: string; text: string }[] }[];
  faqs: { question: string; answer: string }[];
  stakeholders?: { role: string; jobToBeDone: string; fears: string; metrics: string }[];
}

const EMPTY_PROPOSAL: ProposalData = {
  whatWeHeard: [],
  northStar: { position: "", positionDetail: "", project: "", projectDetail: "" },
  measurementPlan: [],
  strategicFoundation: [],
  whyGlide: [],
  faqs: [],
};

export default function ProposalTab({ sessionId, domain }: ProposalTabProps) {
  const { user } = useAuth();
  const { offerings } = useServiceOfferings();
  const [proposalData, setProposalData] = useState<ProposalData>(EMPTY_PROPOSAL);
  const [roadmapItems, setRoadmapItems] = useState<TimelineItem[]>([]);
  const [roadmapMeta, setRoadmapMeta] = useState<{ startMonth: number; totalMonths: number }>({ startMonth: new Date().getMonth(), totalMonths: 12 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [companyName, setCompanyName] = useState(domain?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "");

  const GEN_STEPS = [
    "Analyzing discovery notes and client context...",
    "Synthesizing what we heard from the client...",
    "Defining the North Star positioning...",
    "Building measurement plan with KPIs...",
    "Running 5C strategic diagnostic...",
    "Crafting 'Why GLIDE' value narrative...",
    "Generating client-specific FAQs...",
    "Assembling final proposal...",
  ];

  // Load roadmap data
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: roadmap } = await supabase
        .from("roadmaps" as any)
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!roadmap) return;
      const rm = roadmap as any;
      setRoadmapMeta({ startMonth: rm.start_month ?? new Date().getMonth(), totalMonths: rm.total_months ?? 12 });
      const { data: items } = await supabase
        .from("roadmap_items" as any)
        .select("*")
        .eq("roadmap_id", rm.id);
      if (items) {
        setRoadmapItems(
          (items as any[]).map((di) => {
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
              discountPercent: di.discount_percent ?? null,
            };
          })
        );
      }
    })();
  }, [sessionId, offerings]);

  // Load saved proposal data
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data } = await supabase
        .from("proposals" as any)
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();
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
      }
    })();
  }, [sessionId]);

  // Save proposal data
  const saveProposal = useCallback(async (data: ProposalData) => {
    await supabase
      .from("proposals" as any)
      .upsert({
        session_id: sessionId,
        user_id: user?.id ?? null,
        proposal_data: data,
        contact_name: contactName,
        contact_title: contactTitle,
        contact_email: contactEmail,
        company_name: companyName,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "session_id" });
  }, [sessionId, user, contactName, contactTitle, contactEmail, companyName]);

  const generateProposal = useCallback(async () => {
    setIsGenerating(true);
    setGenStep(0);
    const interval = setInterval(() => setGenStep((p) => (p + 1) % GEN_STEPS.length), 3500);

    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: { sessionId, domain, companyName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.proposal) {
        setProposalData(data.proposal);
        setHasGenerated(true);
        await saveProposal(data.proposal);
        toast.success("Proposal generated successfully");
      }
    } catch (e: any) {
      console.error("Generate proposal error:", e);
      toast.error(e?.message || "Failed to generate proposal");
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
    }
  }, [sessionId, domain, companyName, saveProposal]);

  // Empty state - no proposal generated yet
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
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Jane Smith"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Marketing Director"
                  value={contactTitle}
                  onChange={(e) => setContactTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="e.g. jane@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Acme Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>

            <Button
              size="lg"
              className="gap-2"
              onClick={generateProposal}
            >
              <Sparkles className="h-4 w-4" />
              Generate Proposal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.04] via-primary/[0.02] to-transparent p-8">
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="flex h-16 w-16 mx-auto items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 104 104" fill="none" className="h-16 w-16 animate-spin [animation-duration:3s]">
                <circle cx="50" cy="49" r="46" stroke="hsl(var(--pillar-is))" strokeWidth="8" strokeDasharray="120 170" opacity="0.9" />
                <circle cx="50" cy="67" r="28" stroke="hsl(var(--pillar-go))" strokeWidth="8" strokeDasharray="80 100" opacity="0.9" />
                <circle cx="50" cy="77" r="18" stroke="hsl(var(--pillar-fb))" strokeWidth="8" strokeDasharray="50 65" opacity="0.9" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-foreground">Generating Proposal</h2>
            <p key={genStep} className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
              {GEN_STEPS[genStep]}
            </p>
            <div className="space-y-2">
              <div className="h-3 w-3/4 mx-auto rounded-full bg-primary/10 animate-pulse" />
              <div className="h-3 w-full rounded-full bg-primary/[0.07] animate-pulse [animation-delay:150ms]" />
              <div className="h-3 w-5/6 mx-auto rounded-full bg-primary/[0.07] animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full proposal render
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

      {/* Proposal sections - presentation mode */}
      <div className="rounded-xl border border-border bg-white dark:bg-background overflow-hidden shadow-sm">
        <ProposalHero
          domain={domain}
          companyName={companyName}
          contactName={contactName}
          contactTitle={contactTitle}
          contactEmail={contactEmail}
        />
        <WhatWeHeard insights={proposalData.whatWeHeard} />
        <NorthStar data={proposalData.northStar} />
        <MeasurementPlan kpis={proposalData.measurementPlan} />
        <StrategicFoundation categories={proposalData.strategicFoundation} />
        <ProposalGrowthPlan
          items={roadmapItems}
          offerings={offerings}
          startMonthIndex={roadmapMeta.startMonth}
          totalMonths={roadmapMeta.totalMonths}
        />
        <ProposalCaseStudies />
        <ProposalTestimonials />
        <ProposalInvestment
          items={roadmapItems}
          offerings={offerings}
        />
        <WhyGlide pillars={proposalData.whyGlide} companyName={companyName} />
        <ProposalFAQ faqs={proposalData.faqs} />
        <NextSteps contactEmail={contactEmail} />
      </div>
    </div>
  );
}
