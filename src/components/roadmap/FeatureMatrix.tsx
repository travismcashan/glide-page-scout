import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { PILLARS } from "@/data/offerings";
import type { TimelineItem } from "@/types/roadmap";
import type { Offering } from "@/hooks/useServiceOfferings";
import type { ServiceStep } from "@/types/roadmap";

interface FeatureMatrixProps {
  items: TimelineItem[];
  offerings: Offering[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function isRecurringOffering(offering: Offering): boolean {
  return (
    offering.billingType === "Retainer" ||
    (offering.billingType === "T&M" &&
      offering.minRetainer == null &&
      offering.maxRetainer == null &&
      (offering.minHourly != null || offering.maxHourly != null))
  );
}

const PILLAR_BG: Record<string, string> = {
  IS: "bg-pillar-is/10",
  FB: "bg-pillar-fb/10",
  GO: "bg-pillar-go/10",
  TS: "bg-pillar-ts/10",
};

const PILLAR_DOT: Record<string, string> = {
  IS: "bg-pillar-is",
  FB: "bg-pillar-fb",
  GO: "bg-pillar-go",
  TS: "bg-pillar-ts",
};

const OPTION_LABELS = ["Option 1", "Option 2", "Option 3"];
const OPTION_NAMES = ["Foundation & Build", "Growth & Optimization", "12-Month Growth Plan"];
const OPTION_HEADER_STYLES = [
  "bg-pillar-fb text-black",
  "bg-pillar-go text-black",
  "text-black animate-gradient-shift bg-[length:200%_200%] bg-gradient-to-r from-pillar-fb via-pillar-go to-pillar-is",
];

function isInOption(pillar: string, optionIdx: number): boolean {
  if (optionIdx === 2) return true;
  if (optionIdx === 0) return pillar === "IS" || pillar === "FB";
  if (optionIdx === 1) return pillar === "GO" || pillar === "TS";
  return false;
}

/** Short descriptions for sub-items (phases & cycles) — used in info tooltips */
const STEP_DESCRIPTIONS: Record<string, string> = {
  // Technical Discovery
  "Strategy & Planning": "Stakeholder interviews, competitive analysis, and project roadmap definition.",
  "Technical Audit": "Deep-dive into your current tech stack, performance bottlenecks, and integration architecture.",
  "Content Audit": "Inventory and evaluation of existing content for quality, relevance, and SEO value.",
  "Analytics Review": "Assessment of tracking setup, data accuracy, and actionable insights from current analytics.",

  // Website Design
  "UX Strategy": "User journey mapping, wireframes, and information architecture to maximize engagement.",
  "Visual Design": "High-fidelity mockups, brand-aligned UI design, and interactive prototypes.",
  "Design QA": "Pixel-perfect review ensuring designs translate accurately across devices and browsers.",

  // Website Development
  "Frontend Development": "Responsive HTML/CSS/JS build with performance optimization and accessibility compliance.",
  "CMS Integration": "Content management system setup, custom fields, templates, and editorial workflows.",
  "Backend Development": "Server-side logic, API integrations, database architecture, and business logic.",
  "QA & Launch": "Cross-browser testing, performance validation, and managed launch with rollback plan.",

  // SEO
  "Technical SEO": "Site speed, crawlability, schema markup, and indexation improvements.",
  "On-Page SEO": "Keyword optimization, meta tags, internal linking, and content structure enhancements.",
  "Content Strategy": "Keyword research-driven content calendar and topic cluster development.",
  "Link Building": "Strategic outreach and high-quality backlink acquisition to build domain authority.",
  "SEO Reporting": "Monthly ranking, traffic, and conversion reports with actionable recommendations.",

  // PPC
  "Campaign Setup": "Account structure, keyword research, ad copy, and conversion tracking configuration.",
  "Campaign Optimization": "Bid management, A/B testing, negative keywords, and quality score improvements.",
  "PPC Reporting": "Performance dashboards with ROAS, CPA, and conversion metrics.",

  // Continuous Improvement
  "Performance Analysis": "Data-driven analysis of user behavior, conversion funnels, and engagement patterns.",
  "UX Optimization": "A/B testing, heatmap analysis, and iterative design improvements based on real data.",
  "Conversion Optimization": "Landing page optimization, CTA testing, and funnel refinement to boost conversions.",

  // Quarterly Maintenance
  "Security Updates": "CMS core, plugin, and dependency updates with vulnerability patching.",
  "Performance Check": "Page speed audit, caching review, and server response optimization.",
  "Backup & Recovery": "Automated backup verification and disaster recovery testing.",

  // On-Demand Support
  "Development Support": "Ad-hoc feature development, bug fixes, and technical troubleshooting.",
  "Design Support": "On-demand design updates, asset creation, and UI refinements.",
  "Support SLA": "Guaranteed response times and priority support for critical issues.",

  // Quarterly Maintenance
  "CMS Updates": "Core platform updates, plugin patches, and compatibility testing.",
  "Uptime Monitoring": "24/7 monitoring with automated alerts for downtime or performance issues.",

  // Generic
  "Project Initiation": "Kickoff meeting, timeline alignment, access setup, and team introductions.",
  "Research & Analysis": "Market research, competitor analysis, and data-driven insights to guide strategy.",
  "Strategy & Recommendations": "Actionable strategic recommendations based on research findings.",
  "Reporting & Insights": "Clear, visual reporting with key metrics and next-step recommendations.",
};

const BUNDLE_PERKS: Array<{ name: string; tip: string; value?: string; options: number[] }> = [
  { name: "Monthly Performance Snapshot", tip: "Monthly report covering KPIs, progress against goals, and recommended next steps across all active services.", options: [1, 2] },
  { name: "Quarterly Strategic Review", tip: "Your dedicated senior team meets quarterly to review performance, adjust priorities, and align your roadmap with business goals.", value: "$1,800/yr value", options: [2] },
  { name: "Dedicated Slack Channel", tip: "Real-time access to your entire team in a shared Slack channel. No tickets, no wait times.", options: [2] },
  { name: "Priority Onboarding", tip: "Skip the queue. Bundle clients get priority scheduling for kickoff, discovery, and first deliverables.", options: [2] },
];

export default function FeatureMatrix({ items, offerings }: FeatureMatrixProps) {
  const activeSkus = new Set(items.map((i) => i.sku));
  const activeOfferings = offerings.filter((o) => activeSkus.has(o.sku));

  // Default all services expanded
  const [expandedServices, setExpandedServices] = useState<Set<number>>(() => {
    const allSkus = new Set<number>();
    activeOfferings.forEach((o) => allSkus.add(o.sku));
    return allSkus;
  });

  const pillarOrder = ["IS", "FB", "GO", "TS"];
  const groupedByPillar = pillarOrder
    .map((code) => ({
      pillar: PILLARS.find((p) => p.code === code)!,
      services: activeOfferings.filter((o) => o.pillar === code),
    }))
    .filter((g) => g.services.length > 0);

  if (groupedByPillar.length === 0) return null;

  const toggleService = (sku: number) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  // Compute option prices for header
  const option1Items = items.filter((i) => i.pillar === "IS" || i.pillar === "FB");
  const option2Items = items.filter((i) => i.pillar === "GO" || i.pillar === "TS");

  const computeOptionPrice = (scopeItems: TimelineItem[], mode: "total" | "monthly" | "monthly-blended"): string => {
    let totalFixed = 0;
    let totalMonthly = 0;
    let totalRecurringCost = 0;
    let hasData = false;

    for (const item of scopeItems) {
      if (item.unitPrice == null) continue;
      const offering = offerings.find((o) => o.sku === item.sku);
      hasData = true;
      if (offering && isRecurringOffering(offering)) {
        if (mode === "total") totalFixed += item.unitPrice * item.duration;
        else if (mode === "monthly") totalMonthly += item.unitPrice;
        else totalRecurringCost += item.unitPrice * item.duration;
      } else {
        totalFixed += item.unitPrice;
      }
    }

    if (!hasData) return "—";
    let raw: number;
    if (mode === "monthly") raw = totalMonthly;
    else if (mode === "monthly-blended") raw = (totalFixed + totalRecurringCost) / 12;
    else raw = totalFixed + totalMonthly;

    // Round
    if (mode === "monthly-blended") raw = Math.floor(raw / 500) * 500;
    else if (mode === "monthly") raw = Math.round(raw / 250) * 250;
    else raw = Math.round(raw / 1000) * 1000;

    const suffix = mode === "monthly" || mode === "monthly-blended" ? "/mo" : "";
    return `${formatCurrency(raw)}${suffix}`;
  };

  const optionPrices = [
    computeOptionPrice(option1Items, "total"),
    computeOptionPrice(option2Items, "monthly"),
    computeOptionPrice(items, "monthly-blended"),
  ];

  const COL = "grid-cols-[1.5fr_1fr_1fr_1fr]";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      {/* Sticky header */}
      <div className={`sticky top-0 z-10 grid ${COL} border-b-2 border-border bg-muted/95 backdrop-blur-sm`}>
        <div className="px-6 py-5" />
        {OPTION_LABELS.map((label, i) => (
          <div key={label} className="flex flex-col items-start justify-center gap-1.5 border-l border-border px-4 py-4">
            <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-bold tracking-wide ${OPTION_HEADER_STYLES[i]}`}>
              {label}
            </span>
            <span className="text-2xl font-bold text-foreground">{optionPrices[i]}</span>
          </div>
        ))}
      </div>

      {/* Pillar groups */}
      {groupedByPillar.map((group) => (
        <div key={group.pillar.code}>
          {/* Pillar section header */}
          <div className={`sticky top-[88px] z-[5] flex items-center gap-2.5 px-6 py-3 border-b border-border backdrop-blur-sm ${PILLAR_BG[group.pillar.code]}`}>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${PILLAR_DOT[group.pillar.code]}`} />
            <span className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
              {group.pillar.name}
            </span>
          </div>

          {/* Service rows */}
          {group.services.map((service) => {
            const isExpanded = expandedServices.has(service.sku);
            const steps = service.steps || [];
            const phases = steps.filter((s) => s.stepType === "phase").sort((a, b) => a.sortOrder - b.sortOrder);
            const cycles = steps.filter((s) => s.stepType === "cycle").sort((a, b) => a.sortOrder - b.sortOrder);
            const hasSteps = steps.length > 0;

            return (
              <div key={service.sku}>
                {isExpanded ? (
                  /* Expanded: full-width header, no checkmark columns */
                  <div
                    className="flex items-center gap-2 px-6 py-3 border-b border-border cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleService(service.sku)}
                  >
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{service.name}</span>
                  </div>
                ) : (
                  /* Collapsed: grid with checkmark columns */
                  <div
                    className={`grid ${COL} border-b border-border ${hasSteps ? "cursor-pointer hover:bg-muted/30" : ""} transition-colors`}
                    onClick={() => hasSteps && toggleService(service.sku)}
                  >
                    <div className="flex items-center gap-2 px-6 py-3">
                      {hasSteps && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium text-foreground">{service.name}</span>
                    </div>
                    {[0, 1, 2].map((optIdx) => (
                      <div key={optIdx} className="flex items-center border-l border-border px-4 py-3">
                        {isInOption(service.pillar, optIdx) ? (
                          <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
                        ) : (
                          <span className="text-sm text-muted-foreground/30">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Expanded phases + cycles */}
                {isExpanded && (
                  <div>
                    {phases.map((step) => (
                      <StepRow key={step.id} step={step} pillar={service.pillar} col={COL} />
                    ))}
                    {cycles.map((step) => (
                      <StepRow key={step.id} step={step} pillar={service.pillar} col={COL} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Included Extras section */}
      <div className="flex items-center gap-2.5 px-6 py-3 border-b border-border bg-primary/5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
        <span className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
          Included Extras
        </span>
      </div>
      {BUNDLE_PERKS.map((perk, i) => (
        <div key={perk.name} className={`grid ${COL} border-b border-border ${i === BUNDLE_PERKS.length - 1 ? "border-b-0" : ""}`}>
          <div className="flex items-center gap-2 px-6 py-3 pl-8">
            <span className="text-sm font-medium text-foreground">{perk.name}</span>
            {perk.value && (
              <span className="text-[11px] text-muted-foreground/60">{perk.value}</span>
            )}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button className="shrink-0 p-0.5" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                  <Info className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-help" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px]">
                <p className="text-xs">{perk.tip}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          {[0, 1, 2].map((optIdx) => (
            <div key={optIdx} className="flex items-center border-l border-border px-4 py-3">
              {perk.options.includes(optIdx) ? (
                <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
              ) : (
                <span className="text-sm text-muted-foreground/30">—</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StepRow({ step, pillar, col }: { step: ServiceStep; pillar: string; col: string }) {
  const description = STEP_DESCRIPTIONS[step.name];
  return (
    <div className={`grid ${col} border-b border-border/40 bg-muted/5`}>
      <div className="flex items-center gap-2 px-6 py-3">
        <span className="text-xs text-muted-foreground">{step.name}</span>
        {description && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button className="shrink-0 p-0.5" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <Info className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-help" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px]">
              <p className="text-xs">{description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {[0, 1, 2].map((optIdx) => (
        <div key={optIdx} className="flex items-center border-l border-border/40 px-4 py-3">
          {isInOption(pillar, optIdx) ? (
            <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
          ) : (
            <span className="text-sm text-muted-foreground/20">—</span>
          )}
        </div>
      ))}
    </div>
  );
}
