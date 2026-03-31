import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PILLARS } from "@/data/offerings";
import { useServiceOfferings, type Offering } from "@/hooks/useServiceOfferings";
import type { TimelineItem } from "@/types/roadmap";
import ServiceCatalog from "@/components/roadmap/ServiceCatalog";
import TimelineCanvas from "@/components/roadmap/TimelineCanvas";
import InvestmentOptions from "@/components/roadmap/InvestmentOptions";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoadmapTabProps {
  sessionId: string;
  domain?: string;
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

export default function RoadmapTab({ sessionId, domain }: RoadmapTabProps) {
  const { offerings, loading: offeringsLoading } = useServiceOfferings();
  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [startMonthIndex, setStartMonthIndex] = useState(new Date().getMonth());
  const [totalMonths, setTotalMonths] = useState(12);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [catalogVisible, setCatalogVisible] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load or create roadmap for this session
  useEffect(() => {
    if (!sessionId || offeringsLoading) return;
    const init = async () => {
      // Look for existing roadmap tied to this session
      const { data: existing } = await supabase
        .from("roadmaps" as any)
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();

      let roadmap = existing as any;

      if (!roadmap) {
        // Create one, defaulting client_name to domain
        const defaultName = domain
          ? domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
          : "Client";
        const { data: created } = await supabase
          .from("roadmaps" as any)
          .insert({ session_id: sessionId, client_name: defaultName, start_month: new Date().getMonth(), total_months: 12 })
          .select()
          .single();
        roadmap = created as any;
      }

      if (!roadmap) { setLoaded(true); return; }

      setRoadmapId(roadmap.id);
      setStartMonthIndex(roadmap.start_month ?? new Date().getMonth());
      setTotalMonths(roadmap.total_months ?? 12);

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
      setLoaded(true);
    };
    init();
  }, [sessionId, offeringsLoading, offerings, domain]);

  // Auto-save debounced
  const save = useCallback(() => {
    if (!roadmapId || !loaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from("roadmaps" as any)
        .update({ start_month: startMonthIndex, total_months: totalMonths })
        .eq("id", roadmapId);

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
  }, [roadmapId, loaded, startMonthIndex, totalMonths, items, offerings]);

  useEffect(() => {
    save();
  }, [save]);

  const getMinPrice = useCallback((offering: Offering): number | null => {
    if (offering.minRetainer != null) return Number(offering.minRetainer);
    if (offering.minFixed != null) return Number(offering.minFixed);
    if (offering.minHourly != null) {
      const rate = Number(offering.hourlyRateExternal ?? 150);
      return Number(offering.minHourly) * rate;
    }
    return null;
  }, []);

  const getPillarPrecedence = useCallback((code: string): string[] => {
    switch (code) {
      case "FB": return ["IS"];
      case "GO": return ["IS", "FB"];
      case "TS": return ["IS", "FB"];
      default: return [];
    }
  }, []);

  const getAutoStart = useCallback((offering: Offering, currentItems: TimelineItem[]) => {
    const predecessors = getPillarPrecedence(offering.pillar);
    const predItems = currentItems.filter((i) => predecessors.includes(i.pillar));
    let startMonth = 0;
    if (predItems.length > 0) {
      startMonth = Math.max(...predItems.map((i) => i.startMonth + i.duration));
    }
    return Math.min(startMonth, totalMonths - 1);
  }, [getPillarPrecedence, totalMonths]);

  const toggleOffering = useCallback((sku: number) => {
    setItems((prev) => {
      const exists = prev.find((item) => item.sku === sku);
      if (exists) return prev.filter((item) => item.sku !== sku);
      const offering = offerings.find((o) => o.sku === sku);
      if (!offering) return prev;
      const startMonth = getAutoStart(offering, prev);
      const pillarCount = prev.filter((i) => i.pillar === offering.pillar).length;
      const defaultPrice = getMinPrice(offering);
      return [...prev, { sku: offering.sku, name: offering.name, pillar: offering.pillar, startMonth, duration: offering.defaultDuration, sortOrder: pillarCount, unitPrice: defaultPrice }];
    });
  }, [getAutoStart, offerings, getMinPrice]);

  const removeItem = useCallback((sku: number) => {
    setItems((prev) => prev.filter((i) => i.sku !== sku));
  }, []);

  const renameItem = useCallback((sku: number, newName: string) => {
    setItems((prev) => prev.map((item) => (item.sku === sku ? { ...item, name: newName } : item)));
  }, []);

  const splitItem = useCallback((sku: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.sku === sku);
      if (!item) return prev;
      const phases = offerings.filter((o) => o.phaseOf === sku);
      if (phases.length < 2) return prev;
      const without = prev.filter((i) => i.sku !== sku);
      const p1 = phases.find((p) => p.phase === 1)!;
      const p2 = phases.find((p) => p.phase === 2)!;
      return [
        ...without,
        { sku: p1.sku, name: p1.name, pillar: p1.pillar, startMonth: item.startMonth, duration: p1.defaultDuration, sortOrder: item.sortOrder, unitPrice: item.unitPrice },
        { sku: p2.sku, name: p2.name, pillar: p2.pillar, startMonth: item.startMonth + p1.defaultDuration, duration: p2.defaultDuration, sortOrder: item.sortOrder + 0.5, unitPrice: item.unitPrice },
      ];
    });
  }, [offerings]);

  const dropOffering = useCallback((sku: number, startMonth: number) => {
    setItems((prev) => {
      if (prev.some((i) => i.sku === sku)) return prev;
      const offering = offerings.find((o) => o.sku === sku);
      if (!offering) return prev;
      const clamped = Math.max(0, Math.min(startMonth, totalMonths - offering.defaultDuration));
      const pillarCount = prev.filter((i) => i.pillar === offering.pillar).length;
      const defaultPrice = getMinPrice(offering);
      return [...prev, { sku: offering.sku, name: offering.name, pillar: offering.pillar, startMonth: clamped, duration: offering.defaultDuration, sortOrder: pillarCount, unitPrice: defaultPrice }];
    });
  }, [totalMonths, offerings, getMinPrice]);

  const moveItem = useCallback((sku: number, newStartMonth: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.sku !== sku) return item;
        const snapped = Math.round(newStartMonth * 2) / 2;
        return { ...item, startMonth: Math.max(0, Math.min(snapped, totalMonths - item.duration)) };
      })
    );
  }, [totalMonths]);

  const resizeItem = useCallback((sku: number, newStartMonth: number, newDuration: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.sku !== sku) return item;
        const duration = Math.max(0.5, newDuration);
        const start = Math.max(0, newStartMonth);
        return { ...item, startMonth: start, duration: Math.min(duration, totalMonths - start) };
      })
    );
  }, [totalMonths]);

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

  const isSelected = useCallback((sku: number) => items.some((i) => i.sku === sku), [items]);
  const getCountForPillar = useCallback((code: string) => items.filter((i) => i.pillar === code).length, [items]);

  if (!loaded || offeringsLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading roadmap…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Timeline editor */}
      <div>
        <div className="flex overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          {catalogVisible && (
            <div className="w-[300px] shrink-0 max-h-[calc(100vh-200px)]">
              <ServiceCatalog
                offerings={offerings}
                showAll={showAll}
                onShowAllChange={setShowAll}
                isSelected={isSelected}
                onToggle={toggleOffering}
                getCountForPillar={getCountForPillar}
                onCollapse={() => setCatalogVisible(false)}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {!catalogVisible && (
              <div className="flex items-center border-b border-border px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-muted-foreground"
                  onClick={() => setCatalogVisible(true)}
                >
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                  Show Catalog
                </Button>
              </div>
            )}
            <TimelineCanvas
              items={items}
              offerings={offerings}
              startMonthIndex={startMonthIndex}
              totalMonths={totalMonths}
              onMove={moveItem}
              onResize={resizeItem}
              onRemove={removeItem}
              onSplit={splitItem}
              onDropOffering={dropOffering}
              onRename={renameItem}
              onReorder={reorderItem}
              onSetPrice={setItemPrice}
              onSetAdSpend={setItemAdSpend}
              onSetDiscount={setItemDiscount}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 px-6 py-3">
          {PILLARS.map((p) => (
            <div key={p.code} className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${{ IS: "bg-pillar-is", FB: "bg-pillar-fb", GO: "bg-pillar-go", TS: "bg-pillar-ts" }[p.code]}`}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {p.name} ({p.code})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Investment Options */}
      <div>
        <h2 className="mb-5 text-2xl font-bold tracking-tight text-foreground">Investment Options</h2>
        <InvestmentOptions items={items} offerings={offerings} />
      </div>
    </div>
  );
}
