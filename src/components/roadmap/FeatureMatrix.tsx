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

const PILLAR_BORDER: Record<string, string> = {
  IS: "border-l-pillar-is",
  FB: "border-l-pillar-fb",
  GO: "border-l-pillar-go",
  TS: "border-l-pillar-ts",
};

const OPTION_LABELS = ["Option 1", "Option 2", "Option 3"];
const OPTION_NAMES = ["Foundation & Build", "Growth & Optimization", "12-Month Growth Plan"];
const OPTION_HEADER_STYLES = [
  "bg-pillar-fb text-black",
  "bg-pillar-go text-black",
  "border border-foreground/30 text-foreground",
];

function isInOption(pillar: string, optionIdx: number): boolean {
  if (optionIdx === 2) return true;
  if (optionIdx === 0) return pillar === "IS" || pillar === "FB";
  if (optionIdx === 1) return pillar === "GO" || pillar === "TS";
  return false;
}

const BUNDLE_PERKS: Array<{ name: string; tip: string; value?: string; options: number[] }> = [
  { name: "Priority Onboarding", tip: "Skip the queue. Bundle clients get priority scheduling for kickoff, discovery, and first deliverables.", options: [2] },
  { name: "Dedicated Slack Channel", tip: "Real-time access to your entire team in a shared Slack channel. No tickets, no wait times.", options: [2] },
  { name: "Monthly Performance Snapshot", tip: "Monthly report covering KPIs, progress against goals, and recommended next steps across all active services.", options: [1, 2] },
  { name: "Quarterly Strategic Review", tip: "Your dedicated senior team meets quarterly to review performance, adjust priorities, and align your roadmap with business goals.", value: "$1,800/yr value", options: [2] },
];

export default function FeatureMatrix({ items, offerings }: FeatureMatrixProps) {
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set());

  const activeSkus = new Set(items.map((i) => i.sku));
  const activeOfferings = offerings.filter((o) => activeSkus.has(o.sku));

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

  const COL = "grid-cols-[1fr_minmax(140px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)]";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      {/* Sticky header */}
      <div className={`grid ${COL} border-b-2 border-border bg-muted/30`}>
        <div className="px-6 py-5">
          <p className="text-sm font-bold text-foreground">What's Included</p>
        </div>
        {OPTION_LABELS.map((label, i) => (
          <div key={label} className="flex flex-col items-center justify-center gap-1 border-l border-border px-4 py-5">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${OPTION_HEADER_STYLES[i]}`}>
              {label}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{OPTION_NAMES[i]}</span>
          </div>
        ))}
      </div>

      {/* Pillar groups */}
      {groupedByPillar.map((group) => (
        <div key={group.pillar.code}>
          {/* Pillar section header */}
          <div className={`grid ${COL} border-b border-border ${PILLAR_BG[group.pillar.code]}`}>
            <div className="flex items-center gap-2.5 px-6 py-3">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${PILLAR_DOT[group.pillar.code]}`} />
              <span className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
                {group.pillar.name}
              </span>
            </div>
            {[0, 1, 2].map((optIdx) => (
              <div key={optIdx} className="border-l border-border" />
            ))}
          </div>

          {/* Service rows */}
          {group.services.map((service) => {
            const isExpanded = expandedServices.has(service.sku);
            const steps = service.steps || [];
            const phases = steps.filter((s) => s.stepType === "phase").sort((a, b) => a.sortOrder - b.sortOrder);
            const cycles = steps.filter((s) => s.stepType === "cycle").sort((a, b) => a.sortOrder - b.sortOrder);
            const hasSteps = steps.length > 0;
            const item = items.find((i) => i.sku === service.sku);

            return (
              <div key={service.sku}>
                <div
                  className={`grid ${COL} border-b border-border ${hasSteps ? "cursor-pointer hover:bg-muted/30" : ""} transition-colors`}
                  onClick={() => hasSteps && toggleService(service.sku)}
                >
                  <div className={`flex items-center gap-2 px-6 py-3.5 border-l-2 ${PILLAR_BORDER[service.pillar]}`}>
                    {hasSteps && (
                      isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium text-foreground">{service.name}</span>
                    {item && item.duration > 0 && (
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/60">
                        {item.duration} mo
                      </span>
                    )}
                  </div>
                  {[0, 1, 2].map((optIdx) => (
                    <div key={optIdx} className="flex items-center justify-center border-l border-border px-4 py-3.5">
                      {isInOption(service.pillar, optIdx) ? (
                        <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
                      ) : (
                        <span className="text-sm text-muted-foreground/30">—</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Expanded phases + cycles */}
                {isExpanded && (
                  <div>
                    {phases.map((step) => (
                      <StepRow key={step.id} step={step} pillar={service.pillar} label="Phase" col={COL} />
                    ))}
                    {cycles.map((step) => (
                      <StepRow key={step.id} step={step} pillar={service.pillar} label={step.frequency === "quarterly" ? "Quarterly" : "Monthly"} col={COL} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Bundle Exclusive section */}
      <div className={`grid ${COL} border-b border-border bg-primary/5`}>
        <div className="flex items-center gap-2.5 px-6 py-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
            Included Extras
          </span>
        </div>
        {[0, 1, 2].map((optIdx) => (
          <div key={optIdx} className="border-l border-border" />
        ))}
      </div>
      {BUNDLE_PERKS.map((perk, i) => (
        <div key={perk.name} className={`grid ${COL} border-b border-border ${i === BUNDLE_PERKS.length - 1 ? "border-b-0" : ""}`}>
          <div className="flex items-center gap-2 px-6 py-3.5 pl-8 border-l-2 border-l-primary">
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
            <div key={optIdx} className="flex items-center justify-center border-l border-border px-4 py-3.5">
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

function StepRow({ step, pillar, label, col }: { step: ServiceStep; pillar: string; label: string; col: string }) {
  return (
    <div className={`grid ${col} border-b border-border/40 bg-muted/5`}>
      <div className={`flex items-center gap-2 px-6 py-2.5 pl-14 border-l-2 ${PILLAR_BORDER[pillar]}`}>
        <span className="text-[13px] text-muted-foreground">{step.name}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60">{label}</span>
      </div>
      {[0, 1, 2].map((optIdx) => (
        <div key={optIdx} className="flex items-center justify-center border-l border-border/40 px-4 py-2.5">
          {isInOption(pillar, optIdx) ? (
            <Check className="h-3.5 w-3.5 text-emerald-500/60" strokeWidth={2.5} />
          ) : (
            <span className="text-sm text-muted-foreground/20">—</span>
          )}
        </div>
      ))}
    </div>
  );
}
