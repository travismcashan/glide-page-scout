import { useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { PILLARS } from "@/data/offerings";
import type { TimelineItem } from "@/types/roadmap";
import type { Offering } from "@/hooks/useServiceOfferings";
import type { ServiceStep } from "@/types/roadmap";

interface FeatureMatrixProps {
  items: TimelineItem[];
  offerings: Offering[];
}

const PILLAR_DOT: Record<string, string> = {
  IS: "bg-pillar-is",
  FB: "bg-pillar-fb",
  GO: "bg-pillar-go",
  TS: "bg-pillar-ts",
};

const OPTION_HEADER_STYLES = [
  "bg-pillar-fb text-foreground",
  "bg-pillar-go text-foreground",
  "border border-foreground/30 text-foreground",
];

const OPTION_LABELS = ["Option 1", "Option 2", "Option 3"];
const OPTION_NAMES = ["Foundation & Build", "Growth & Optimization", "12-Month Digital Growth Plan"];

function isInOption(pillar: string, optionIdx: number): boolean {
  if (optionIdx === 2) return true; // Option 3 includes everything
  if (optionIdx === 0) return pillar === "IS" || pillar === "FB";
  if (optionIdx === 1) return pillar === "GO" || pillar === "TS";
  return false;
}

export default function FeatureMatrix({ items, offerings }: FeatureMatrixProps) {
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set());

  // Only show services that are on the timeline
  const activeSkus = new Set(items.map((i) => i.sku));
  const activeOfferings = offerings.filter((o) => activeSkus.has(o.sku) && o.steps && o.steps.length > 0);

  // Group by pillar
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

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_100px_100px_100px] border-b border-border bg-muted/30">
        <div className="px-6 py-4">
          <p className="text-sm font-semibold text-foreground">What's Included</p>
        </div>
        {OPTION_LABELS.map((label, i) => (
          <div key={label} className="flex flex-col items-center justify-center px-2 py-4">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${OPTION_HEADER_STYLES[i]}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Pillar groups */}
      {groupedByPillar.map((group) => (
        <div key={group.pillar.code}>
          {/* Pillar header */}
          <div className="grid grid-cols-[1fr_100px_100px_100px] border-b border-border bg-muted/15">
            <div className="flex items-center gap-2 px-6 py-3">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${PILLAR_DOT[group.pillar.code]}`} />
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.pillar.name}
              </span>
            </div>
            {[0, 1, 2].map((optIdx) => (
              <div key={optIdx} className="flex items-center justify-center px-2 py-3">
                {/* Empty — pillar-level check not needed */}
              </div>
            ))}
          </div>

          {/* Services */}
          {group.services.map((service) => {
            const isExpanded = expandedServices.has(service.sku);
            const steps = service.steps || [];
            const phases = steps.filter((s) => s.stepType === "phase").sort((a, b) => a.sortOrder - b.sortOrder);
            const cycles = steps.filter((s) => s.stepType === "cycle").sort((a, b) => a.sortOrder - b.sortOrder);
            const hasSteps = steps.length > 0;

            return (
              <div key={service.sku}>
                {/* Service row */}
                <div
                  className={`grid grid-cols-[1fr_100px_100px_100px] border-b border-border ${hasSteps ? "cursor-pointer hover:bg-muted/20" : ""} transition-colors`}
                  onClick={() => hasSteps && toggleService(service.sku)}
                >
                  <div className="flex items-center gap-2 px-6 py-3">
                    {hasSteps && (
                      isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium text-foreground">{service.name}</span>
                  </div>
                  {[0, 1, 2].map((optIdx) => (
                    <div key={optIdx} className="flex items-center justify-center px-2 py-3">
                      {isInOption(service.pillar, optIdx) ? (
                        <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Expanded steps */}
                {isExpanded && (
                  <div className="bg-muted/5">
                    {phases.length > 0 && phases.map((step) => (
                      <StepRow key={step.id} step={step} pillar={service.pillar} label="Phase" />
                    ))}
                    {cycles.length > 0 && cycles.map((step) => (
                      <StepRow key={step.id} step={step} pillar={service.pillar} label={step.frequency === "quarterly" ? "Quarterly" : "Monthly"} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Quarterly Strategic Review — bundle exclusive */}
      <div className="grid grid-cols-[1fr_100px_100px_100px] border-b border-border bg-muted/10">
        <div className="flex items-center gap-2 px-6 py-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Bundle Exclusive
          </span>
        </div>
        {[0, 1, 2].map((optIdx) => (
          <div key={optIdx} className="flex items-center justify-center px-2 py-3" />
        ))}
      </div>
      <div className="grid grid-cols-[1fr_100px_100px_100px] border-b border-border last:border-b-0">
        <div className="flex items-center gap-2 px-6 py-3 pl-8">
          <span className="text-sm font-medium text-foreground">Quarterly Strategic Review</span>
          <span className="text-xs text-muted-foreground">($1,800/yr value)</span>
        </div>
        {[0, 1, 2].map((optIdx) => (
          <div key={optIdx} className="flex items-center justify-center px-2 py-3">
            {optIdx === 2 ? (
              <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
            ) : (
              <span className="text-muted-foreground/30">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepRow({ step, pillar, label }: { step: ServiceStep; pillar: string; label: string }) {
  return (
    <div className="grid grid-cols-[1fr_100px_100px_100px] border-b border-border/50">
      <div className="flex items-center gap-2 px-6 py-2 pl-12">
        <span className="text-xs text-muted-foreground">{step.name}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground/70">{label}</span>
      </div>
      {[0, 1, 2].map((optIdx) => (
        <div key={optIdx} className="flex items-center justify-center px-2 py-2">
          {isInOption(pillar, optIdx) ? (
            <Check className="h-3.5 w-3.5 text-emerald-500/70" strokeWidth={2.5} />
          ) : (
            <span className="text-muted-foreground/20">—</span>
          )}
        </div>
      ))}
    </div>
  );
}
