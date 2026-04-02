import type { TimelineItem } from "@/types/roadmap";
import type { Offering } from "@/hooks/useServiceOfferings";
import { PILLARS } from "@/data/offerings";
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
}: ProposalGrowthPlanProps) {
  if (!items.length) {
    return (
      <section className="py-20 px-8 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
            <span className="font-bold">12-Month Digital</span>{" "}
            <span className="font-light">Growth Plan</span>
          </h2>
          <hr className="border-t-2 border-foreground mt-8 mb-8" />
          <p className="text-muted-foreground italic">No roadmap configured yet. Add services to the Roadmap tab to populate this section.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
          <span className="font-bold">12-Month Digital</span>{" "}
          <span className="font-light">Growth Plan</span>
        </h2>
        <hr className="border-t-2 border-foreground mt-8 mb-6" />

        {/* Fully interactive timeline — identical to Roadmap tab */}
        <div>
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
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 px-6 py-3 mt-2">
          {PILLARS.map((p) => (
            <div key={p.code} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${PILLAR_DOT[p.code]}`} />
              <span className="text-sm font-normal text-muted-foreground">
                {p.name} ({p.code})
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
