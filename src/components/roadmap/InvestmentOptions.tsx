import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TimelineItem } from "@/types/roadmap";
import type { Offering } from "@/hooks/useServiceOfferings";
import { isPpcOffering, getPpcTierLabel } from "@/lib/ppcPricing";

interface InvestmentOptionsProps {
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

function isRecurring(offering: Offering): boolean {
  return (
    offering.billingType === "Retainer" ||
    (offering.billingType === "T&M" &&
      offering.minRetainer == null &&
      offering.maxRetainer == null &&
      (offering.minHourly != null || offering.maxHourly != null))
  );
}

type PriceMode = "total" | "monthly" | "monthly-blended";

function applyItemDiscount(price: number, item: TimelineItem): number {
  if (!item.discountType || item.discountValue == null || item.discountValue <= 0) return price;
  if (item.discountType === "percent") return price * (1 - item.discountValue / 100);
  if (item.discountType === "fixed") return Math.max(0, price - item.discountValue);
  return price;
}

function computePriceRaw(
  scopeItems: TimelineItem[],
  offerings: Offering[],
  mode: PriceMode
): number | null {
  let totalFixed = 0;
  let totalMonthly = 0;
  let totalRecurringCost = 0;
  let hasData = false;

  for (const item of scopeItems) {
    if (item.unitPrice == null) continue;
    const offering = offerings.find((o) => o.sku === item.sku);
    const discountedPrice = applyItemDiscount(item.unitPrice, item);
    hasData = true;
    if (offering && isRecurring(offering)) {
      if (mode === "total") {
        totalFixed += discountedPrice * item.duration;
      } else if (mode === "monthly") {
        totalMonthly += discountedPrice;
      } else {
        totalRecurringCost += discountedPrice * item.duration;
      }
    } else {
      totalFixed += discountedPrice;
    }
  }

  if (!hasData) return null;

  if (mode === "monthly") return totalMonthly;
  if (mode === "monthly-blended") return (totalFixed + totalRecurringCost) / 12;
  return totalFixed + totalMonthly;
}

function computePrice(
  scopeItems: TimelineItem[],
  offerings: Offering[],
  mode: PriceMode
): string {
  const raw = computePriceRaw(scopeItems, offerings, mode);
  if (raw == null) return "—";
  const suffix = mode === "monthly" || mode === "monthly-blended" ? "/mo" : "";
  return `${formatCurrency(raw)}${suffix}`;
}

interface OptionDef {
  label: string;
  name: string;
  terms: string[];
  scopeItems: TimelineItem[];
  priceMode: PriceMode;
}

function CollapsedCard({ option, onClick }: { option: OptionDef; onClick: () => void }) {
  const [word, number] = option.label.split(" ");
  return (
    <div
      className="flex h-full cursor-pointer flex-col items-center justify-start rounded-xl border border-border bg-background px-1 pt-6 pb-4 transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <p className="text-sm font-semibold tracking-wide text-muted-foreground">
        {number}
      </p>
      <p className="mt-4 text-2xl font-bold text-foreground [writing-mode:vertical-lr] whitespace-nowrap">
        {option.name}
      </p>
    </div>
  );
}

function ExpandedCard({ option, offerings, outcomes, outcomesLoading, discount, onDiscountChange }: {
  option: OptionDef;
  offerings: Offering[];
  outcomes: string[];
  outcomesLoading: boolean;
  discount?: { percent: number } | null;
  onDiscountChange?: (discount: { percent: number } | null) => void;
}) {
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState("");

  const rawPrice = computePriceRaw(option.scopeItems, offerings, option.priceMode);
  const isMonthly = option.priceMode === "monthly" || option.priceMode === "monthly-blended";
  const hasDiscount = discount && discount.percent > 0 && rawPrice != null;
  const displayPrice = hasDiscount
    ? `${formatCurrency(rawPrice * (1 - discount.percent / 100))}${isMonthly ? "/mo" : ""}`
    : computePrice(option.scopeItems, offerings, option.priceMode);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-background">
      <div className="px-6 py-6">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground">
          {option.label}
        </p>
        <h3 className="mt-1 text-2xl font-bold text-foreground">
          {option.name}
        </h3>
      </div>
      <div className="bg-foreground px-6 py-5">
        {onDiscountChange ? (
          <Popover open={discountOpen} onOpenChange={setDiscountOpen}>
            <PopoverTrigger asChild>
              <button
                className="text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  setDiscountInput(discount?.percent?.toString() || "");
                  setDiscountOpen(true);
                }}
              >
                <p className="text-3xl font-bold text-background cursor-pointer hover:text-background/80 transition-colors">
                  {displayPrice}
                  {hasDiscount && (
                    <span className="ml-2 text-lg font-medium text-background/60">
                      ({discount.percent}% discount)
                    </span>
                  )}
                </p>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Discount %</p>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 10"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const val = parseFloat(discountInput);
                      if (!isNaN(val) && val > 0 && val <= 100) {
                        onDiscountChange({ percent: val });
                      } else {
                        onDiscountChange(null);
                      }
                      setDiscountOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onDiscountChange(null);
                      setDiscountOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <p className="text-3xl font-bold text-background">
            {displayPrice}
          </p>
        )}
        <p className="mt-1 text-sm text-background/60">
          {option.terms.join(" | ")}
        </p>
      </div>

      <div className="border-b border-border px-6 py-5">
        <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground">
          OUTCOMES
        </p>
        {outcomesLoading ? (
          <p className="text-sm italic text-muted-foreground">Generating outcomes…</p>
        ) : outcomes.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Add services to generate outcomes</p>
        ) : (
          <ul className="space-y-2.5">
            {outcomes.map((outcome, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-medium text-foreground">{outcome}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-6 py-5">
        <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground">
          SCOPE OF WORK
        </p>
        {option.scopeItems.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            Add services to the timeline to populate
          </p>
        ) : (
          <ul className="space-y-2.5">
            {option.scopeItems.map((si) => {
              const offering = offerings.find((o) => o.sku === si.sku);
              const recurring = offering && isRecurring(offering);
              const isPpc = offering ? isPpcOffering(offering.name) : false;
              return (
                <li key={si.sku} className="flex flex-col gap-1 break-inside-avoid">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                    <span className="text-sm font-medium text-foreground">
                      {si.name}
                      {offering?.billingType === "T&M" && si.unitPrice == null ? (
                        <span className="ml-1.5 text-muted-foreground">
                          (T&M at {formatCurrency(offering.hourlyRateExternal ?? 150)}/hr)
                        </span>
                      ) : si.unitPrice != null ? (
                        <span className="ml-1.5 text-muted-foreground">
                          {(() => {
                            const discounted = applyItemDiscount(si.unitPrice, si);
                            const hasItemDiscount = si.discountType && si.discountValue && si.discountValue > 0;
                            const discountLabel = hasItemDiscount
                              ? si.discountType === "percent"
                                ? ` (${si.discountValue}% off)`
                                : ` (${formatCurrency(si.discountValue)} off)`
                              : "";
                            if (isPpc) {
                              return `(${formatCurrency(discounted)}/mo${discountLabel} — ${si.estimatedAdSpend ? getPpcTierLabel(si.estimatedAdSpend) : "flat fee"})`;
                            }
                            if (recurring) {
                              if (option.priceMode === "monthly-blended") {
                                return `(${formatCurrency(discounted)}/mo × ${si.duration} mo = ${formatCurrency(discounted * si.duration)}${discountLabel})`;
                              }
                              return `(${formatCurrency(discounted)}/mo${discountLabel})`;
                            }
                            return `(${formatCurrency(discounted)}${discountLabel})`;
                          })()}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {isPpc && si.estimatedAdSpend != null && si.estimatedAdSpend > 0 && (
                    <div className="ml-5 flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                      <span className="text-xs text-muted-foreground">
                        Est. ad spend: {formatCurrency(si.estimatedAdSpend)}/mo
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function InvestmentOptions({ items, offerings }: InvestmentOptionsProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [option3Discount, setOption3Discount] = useState<{ percent: number } | null>(null);

  const sortByTimeline = (a: TimelineItem, b: TimelineItem) =>
    a.startMonth - b.startMonth || a.sortOrder - b.sortOrder;

  const option1Items = items.filter((i) => i.pillar === "IS" || i.pillar === "FB").sort(sortByTimeline);
  const option2Items = items.filter((i) => i.pillar === "GO" || i.pillar === "TS").sort(sortByTimeline);
  const option3Items = [...items].sort(sortByTimeline);

  const option1Months = option1Items.length > 0
    ? Math.max(...option1Items.map((i) => i.startMonth + i.duration)) - Math.min(...option1Items.map((i) => i.startMonth))
    : 0;
  const option1WeeksLow = Math.max(1, Math.round(option1Months * 4.33) - 1);
  const option1WeeksHigh = Math.round(option1Months * 4.33) + 1;

  const options: OptionDef[] = [
    {
      label: "Option 1",
      name: "Foundation & Build",
      terms: option1Months > 0
        ? [`${option1WeeksLow}–${option1WeeksHigh} wks`, "Milestone Deposits"]
        : ["Project-Based", "Milestone Deposits"],
      scopeItems: option1Items,
      priceMode: "total",
    },
    {
      label: "Option 2",
      name: "Growth & Optimization",
      terms: ["Monthly", "6-month min.", "30-day cancel"],
      scopeItems: option2Items,
      priceMode: "monthly",
    },
    (() => {
      let totalFixed = 0;
      let totalRecurringCost = 0;
      for (const item of option3Items) {
        if (item.unitPrice == null) continue;
        const offering = offerings.find((o) => o.sku === item.sku);
        if (offering && isRecurring(offering)) {
          totalRecurringCost += item.unitPrice * item.duration;
        } else {
          totalFixed += item.unitPrice;
        }
      }
      const blended = (totalFixed + totalRecurringCost) / 12;
      const minMonths = blended > 0 && totalFixed > 0
        ? Math.ceil(totalFixed / blended)
        : 6;
      return {
        label: "Option 3",
        name: "12-Month Growth Plan",
        terms: ["12-months", `${minMonths}-month min.`, "30-day cancel"],
        scopeItems: option3Items,
        priceMode: "monthly-blended" as PriceMode,
      };
    })(),
  ];

  const [outcomesByIdx, setOutcomesByIdx] = useState<Record<number, string[]>>({});
  const [loadingByIdx, setLoadingByIdx] = useState<Record<number, boolean>>({});
  const [cacheKeys, setCacheKeys] = useState<Record<number, string>>({});

  const fetchOutcomes = useCallback(async (idx: number, option: OptionDef) => {
    const serviceNames = option.scopeItems.map((si) => si.name);
    if (serviceNames.length === 0) return;

    const cacheKey = [...serviceNames].sort().join("|");
    if (cacheKeys[idx] === cacheKey) return;

    setLoadingByIdx((prev) => ({ ...prev, [idx]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-outcomes", {
        body: { optionName: option.name, serviceNames },
      });
      if (!error && data?.outcomes) {
        setOutcomesByIdx((prev) => ({ ...prev, [idx]: data.outcomes }));
        setCacheKeys((prev) => ({ ...prev, [idx]: cacheKey }));
      }
    } catch (e) {
      console.error("Failed to fetch outcomes:", e);
    } finally {
      setLoadingByIdx((prev) => ({ ...prev, [idx]: false }));
    }
  }, [cacheKeys]);

  useEffect(() => {
    options.forEach((option, idx) => {
      if (option.scopeItems.length > 0) {
        fetchOutcomes(idx, option);
      }
    });
  }, [items, offerings, fetchOutcomes]);

  if (expandedIdx === null) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {options.map((option, idx) => (
          <div
            key={option.label}
            className="cursor-pointer"
            onClick={() => setExpandedIdx(idx)}
          >
            <ExpandedCard
              option={option}
              offerings={offerings}
              outcomes={outcomesByIdx[idx] || []}
              outcomesLoading={!!loadingByIdx[idx]}
              discount={idx === 2 ? option3Discount : undefined}
              onDiscountChange={idx === 2 ? setOption3Discount : undefined}
            />
          </div>
        ))}
      </div>
    );
  }

  const stripWidth = 'calc((33.333% - 1rem) / 2)';
  const singleCardWidth = 'calc((33.333% - 1rem) / 4)';

  const makeCollapsedStrip = (indices: number[]) => (
    <div className="flex gap-6" style={{ width: indices.length > 1 ? stripWidth : singleCardWidth }}>
      {indices.map((i) => (
        <div key={options[i].label} className="flex-1">
          <CollapsedCard option={options[i]} onClick={() => setExpandedIdx(i)} />
        </div>
      ))}
    </div>
  );

  const expandedCard = (
    <div className="flex-1 min-w-0">
      <div className="cursor-pointer" onClick={() => setExpandedIdx(null)}>
        <ExpandedCard
          option={options[expandedIdx]}
          offerings={offerings}
          outcomes={outcomesByIdx[expandedIdx] || []}
          outcomesLoading={!!loadingByIdx[expandedIdx]}
          discount={expandedIdx === 2 ? option3Discount : undefined}
          onDiscountChange={expandedIdx === 2 ? setOption3Discount : undefined}
        />
      </div>
    </div>
  );

  if (expandedIdx === 0) {
    return (
      <div className="flex gap-6">
        {expandedCard}
        {makeCollapsedStrip([1, 2])}
      </div>
    );
  }

  if (expandedIdx === 1) {
    return (
      <div className="flex gap-6">
        {makeCollapsedStrip([0])}
        {expandedCard}
        {makeCollapsedStrip([2])}
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {makeCollapsedStrip([0, 1])}
      {expandedCard}
    </div>
  );
}
