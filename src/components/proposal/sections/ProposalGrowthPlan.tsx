import type { TimelineItem } from "@/types/roadmap";
import type { Offering } from "@/hooks/useServiceOfferings";
import { MONTH_NAMES } from "@/data/offerings";

const PILLAR_COLORS: Record<string, string> = {
  IS: "bg-pillar-is",
  FB: "bg-pillar-fb",
  GO: "bg-pillar-go",
  TS: "bg-pillar-ts",
};

const PILLAR_NAMES: Record<string, string> = {
  IS: "Intelligent Strategy",
  FB: "Foundation & Build",
  GO: "Growth & Optimization",
  TS: "Technology & Systems",
};

interface ProposalGrowthPlanProps {
  items: TimelineItem[];
  offerings: Offering[];
  startMonthIndex: number;
  totalMonths: number;
}

export default function ProposalGrowthPlan({ items, offerings, startMonthIndex, totalMonths }: ProposalGrowthPlanProps) {
  if (!items.length) {
    return (
      <section className="py-20 px-8 lg:px-16 bg-white dark:bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
            <span className="font-bold">Digital</span>{" "}
            <span className="font-light">Growth Plan</span>
          </h2>
          <hr className="border-t-2 border-foreground mt-8 mb-8" />
          <p className="text-muted-foreground italic">No roadmap configured yet. Add services to the Roadmap tab to populate this section.</p>
        </div>
      </section>
    );
  }

  const months = Array.from({ length: totalMonths }, (_, i) => {
    const idx = (startMonthIndex + i) % 12;
    return MONTH_NAMES[idx].slice(0, 3);
  });

  // Group by pillar
  const pillarOrder = ["IS", "FB", "GO", "TS"];
  const grouped = pillarOrder
    .map((p) => ({ pillar: p, items: items.filter((it) => it.pillar === p).sort((a, b) => a.sortOrder - b.sortOrder) }))
    .filter((g) => g.items.length > 0);

  return (
    <section className="py-20 px-8 lg:px-16 bg-white dark:bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
              <span className="font-bold">Digital</span>{" "}
              <span className="font-light">Growth Plan</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-3xl">
              A phased {totalMonths}-month engagement plan, sequenced to maximize impact across strategy, build, growth, and support.
            </p>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="lg:col-span-3 overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Month headers */}
              <div className="flex">
                <div className="w-48 shrink-0" />
                {months.map((m, i) => (
                  <div key={i} className="flex-1 text-center text-xs font-medium text-muted-foreground py-2 border-l border-border">
                    {m}
                  </div>
                ))}
              </div>

              {/* Pillar rows */}
              {grouped.map((group) => (
                <div key={group.pillar} className="mb-4">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    {PILLAR_NAMES[group.pillar]}
                  </div>
                  {group.items.map((item) => (
                    <div key={item.sku} className="flex items-center mb-1.5">
                      <div className="w-48 shrink-0 text-sm text-foreground font-medium truncate pr-3">{item.name}</div>
                      <div className="flex-1 relative h-8">
                        <div
                          className={`absolute top-0.5 h-7 rounded-md ${PILLAR_COLORS[item.pillar]} opacity-80`}
                          style={{
                            left: `${(item.startMonth / totalMonths) * 100}%`,
                            width: `${(item.duration / totalMonths) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center justify-center gap-5 mt-6 pt-4 border-t border-border">
                {pillarOrder.map((code) => (
                  <div key={code} className="flex items-center gap-1.5">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${PILLAR_COLORS[code]}`} />
                    <span className="text-xs text-muted-foreground">{PILLAR_NAMES[code]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
