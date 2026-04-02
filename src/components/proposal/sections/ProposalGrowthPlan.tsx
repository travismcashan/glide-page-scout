import { useMemo } from "react";
import type { TimelineItem } from "@/types/roadmap";
import type { Offering } from "@/hooks/useServiceOfferings";
import { PILLARS, getMonthLabels } from "@/data/offerings";
import TimelineCanvas from "@/components/roadmap/TimelineCanvas";

interface ProposalGrowthPlanProps {
  items: TimelineItem[];
  offerings: Offering[];
  startMonthIndex: number;
  totalMonths: number;
  onMove: (sku: number, newStart: number) => void;
  onResize: (sku: number, newStart: number, newDuration: number) => void;
  onRemove: (sku: number) => void;
  onDropOffering: (sku: number, startMonth: number) => void;
  onRename?: (sku: number, newName: string) => void;
  onReorder?: (sku: number, direction: "up" | "down") => void;
  onSetPrice?: (sku: number, price: number) => void;
  onSetAdSpend?: (sku: number, adSpend: number) => void;
  onSetDiscount?: (sku: number, type: "percent" | "fixed" | null, value: number | null) => void;
  digitalDifference?: string;
}

const PILLAR_DOT: Record<string, string> = {
  IS: "bg-pillar-is",
  FB: "bg-pillar-fb",
  GO: "bg-pillar-go",
  TS: "bg-pillar-ts",
};

export default function ProposalGrowthPlan({
  items,
  offerings,
  startMonthIndex,
  totalMonths,
  onMove,
  onResize,
  onRemove,
  onDropOffering,
  onRename,
  onReorder,
  onSetPrice,
  onSetAdSpend,
  onSetDiscount,
  digitalDifference,
}: ProposalGrowthPlanProps) {
  // Only show pillars that have items
  const activePillarCodes = useMemo(() => {
    const codes = new Set(items.map(i => i.pillar));
    return PILLARS.filter(p => codes.has(p.code));
  }, [items]);

  // Auto-generate a Digital Difference description from the roadmap structure
  const autoDescription = useMemo(() => {
    if (!items.length) return '';
    const months = getMonthLabels(startMonthIndex, totalMonths);
    const sorted = [...items].sort((a, b) => a.startMonth - b.startMonth);
    const firstItem = sorted[0];
    const startMonth = months[firstItem.startMonth];

    const fbItems = items.filter(i => i.pillar === 'FB');
    const goItems = items.filter(i => i.pillar === 'GO');
    const tsItems = items.filter(i => i.pillar === 'TS');

    const parts: string[] = [];
    if (fbItems.length && goItems.length) {
      parts.push(`We diagnose the search landscape and technical debt in parallel with the build \u2014 not after it \u2014 so the site launches already optimized for the keywords your competitors are winning on.`);
    }
    if (goItems.length) {
      parts.push(`Post-launch, we systematically scale organic visibility while providing continuous maintenance and on-demand support,`);
    }
    if (tsItems.length) {
      parts.push(`ensuring your digital presence keeps pace with business milestones driving full market adoption.`);
    }
    return parts.join(' ') || `A phased rollout beginning ${startMonth}, establishing a modern digital foundation before scaling search-driven growth and ongoing technical support.`;
  }, [items, startMonthIndex, totalMonths]);

  if (!items.length) {
    return (
      <section className="py-20 px-8 lg:px-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
            <span className="font-bold">12-Month Digital</span>{" "}
            <span className="font-light">Roadmap</span>
          </h2>
          <hr className="border-t-2 border-foreground mt-8 mb-8" />
          <p className="text-muted-foreground italic">No roadmap configured yet. Add services to the Roadmap tab to populate this section.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-8 lg:px-16 bg-white">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
          <span className="font-bold">12-Month Digital</span>{" "}
          <span className="font-light">Roadmap</span>
        </h2>
        <hr className="border-t-2 border-foreground mt-8 mb-6" />

        {/* White card wrapping the roadmap */}
        <div className="rounded-xl border border-border bg-white shadow-sm p-6">
          {/* Timeline */}
          <TimelineCanvas
            items={items}
            offerings={offerings}
            startMonthIndex={startMonthIndex}
            totalMonths={totalMonths}
            viewOffset={0}
            onMove={onMove}
            onResize={onResize}
            onRemove={onRemove}
            onDropOffering={onDropOffering}
            onRename={onRename}
            onReorder={onReorder}
            onSetPrice={onSetPrice}
            onSetAdSpend={onSetAdSpend}
            onSetDiscount={onSetDiscount}
          />

          {/* Divider */}
          <hr className="border-t border-border mt-4 mb-4" />

          {/* Legend */}
          <div className="flex items-center justify-center gap-5">
            {activePillarCodes.map((p) => (
              <div key={p.code} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${PILLAR_DOT[p.code]}`} />
                <span className="text-sm font-normal text-muted-foreground">
                  {p.name} ({p.code})
                </span>
              </div>
            ))}
          </div>

          {/* The Digital Difference */}
          <div className="mt-6 rounded-lg bg-foreground/[0.04] px-6 py-5 text-center">
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              <span className="font-bold not-italic text-foreground">The Digital Difference: </span>
              {digitalDifference || autoDescription}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
