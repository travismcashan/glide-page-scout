import type { TimelineItem } from "@/types/roadmap";
import type { Offering } from "@/hooks/useServiceOfferings";

function getMinPrice(offering: Offering): number | null {
  if (offering.minFixed != null) return offering.minFixed;
  if (offering.minRetainer != null) return offering.minRetainer;
  if (offering.minHourly != null) return offering.minHourly;
  return null;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function isRecurring(offering: Offering): boolean {
  return offering.billingType === "Retainer" || (offering.billingType === "T&M" && offering.minRetainer == null && offering.maxRetainer == null && (offering.minHourly != null || offering.maxHourly != null));
}

interface ProposalInvestmentProps {
  items: TimelineItem[];
  offerings: Offering[];
}

export default function ProposalInvestment({ items, offerings }: ProposalInvestmentProps) {
  if (!items.length) {
    return (
      <section className="py-20 px-8 lg:px-16 bg-white dark:bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
            <span className="font-bold">Investment</span>{" "}
            <span className="font-light">Options</span>
          </h2>
          <hr className="border-t-2 border-foreground mt-8 mb-8" />
          <p className="text-muted-foreground italic">No services configured yet. Add services to the Roadmap tab to populate pricing.</p>
        </div>
      </section>
    );
  }

  // Split into one-time and recurring
  const oneTime: { name: string; price: number; duration: number }[] = [];
  const recurring: { name: string; monthlyPrice: number; duration: number }[] = [];
  let totalOneTime = 0;
  let totalMonthlyRecurring = 0;

  items.forEach((item) => {
    const offering = offerings.find((o) => o.sku === item.sku);
    const price = item.unitPrice ?? (offering ? getMinPrice(offering) : null);
    if (!price || !offering) return;

    if (isRecurring(offering)) {
      recurring.push({ name: item.name, monthlyPrice: price, duration: item.duration });
      totalMonthlyRecurring += price;
    } else {
      oneTime.push({ name: item.name, price, duration: item.duration });
      totalOneTime += price;
    }
  });

  return (
    <section className="py-20 px-8 lg:px-16 bg-white dark:bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
              <span className="font-bold">Investment</span>{" "}
              <span className="font-light">Options</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-3xl">
              Transparent pricing built around the services in your growth plan.
            </p>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="hidden lg:block lg:col-span-1" />
          <div className="lg:col-span-2 space-y-8">
            {/* One-time services */}
            {oneTime.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4">One-Time Services</h3>
                <div className="space-y-3">
                  {oneTime.map((s, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-foreground">{s.name}</span>
                      <span className="text-sm font-semibold text-foreground">{fmt(s.price)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-base font-bold text-foreground">Total One-Time</span>
                    <span className="text-base font-bold text-foreground">{fmt(totalOneTime)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recurring services */}
            {recurring.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4">Monthly Recurring Services</h3>
                <div className="space-y-3">
                  {recurring.map((s, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-border">
                      <div>
                        <span className="text-sm text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({s.duration} mo)</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{fmt(s.monthlyPrice)}/mo</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-base font-bold text-foreground">Total Monthly</span>
                    <span className="text-base font-bold text-foreground">{fmt(totalMonthlyRecurring)}/mo</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
