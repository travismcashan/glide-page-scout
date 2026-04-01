import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PILLARS } from "@/data/offerings";
import { useServiceOfferings, type Offering } from "@/hooks/useServiceOfferings";
import type { TimelineItem } from "@/types/roadmap";
import ServiceCatalog from "@/components/roadmap/ServiceCatalog";
import TimelineCanvas from "@/components/roadmap/TimelineCanvas";
import InvestmentOptions from "@/components/roadmap/InvestmentOptions";
import FeatureMatrix from "@/components/roadmap/FeatureMatrix";
import { PanelLeftOpen, Sparkles, Loader2, Share2, Calendar, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES } from "@/data/offerings";

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
  const { user } = useAuth();
  const { offerings, loading: offeringsLoading } = useServiceOfferings();
  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [startMonthIndex, setStartMonthIndex] = useState(new Date().getMonth());
  const [totalMonths, setTotalMonths] = useState(12);
  const [loaded, setLoaded] = useState(false);
  const [viewOffset, setViewOffset] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [catalogVisible, setCatalogVisible] = useState(true);
  const [outcomesData, setOutcomesData] = useState<Record<number, string[]>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const outcomesTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const generateOutcomesRef = useRef<(() => Promise<void>) | null>(null);
  const [generatingOutcomes, setGeneratingOutcomes] = useState(false);
  const [showCTAs, setShowCTAs] = useState(true);

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
          .insert({ session_id: sessionId, user_id: user?.id ?? null, client_name: defaultName, start_month: new Date().getMonth(), total_months: 12 })
          .select()
          .single();
        roadmap = created as any;
      }

      if (!roadmap) { setLoaded(true); return; }

      setRoadmapId(roadmap.id);
      setStartMonthIndex(roadmap.start_month ?? new Date().getMonth());
      setTotalMonths(roadmap.total_months ?? 12);
      if (roadmap.outcomes_data && typeof roadmap.outcomes_data === "object") {
        setOutcomesData(roadmap.outcomes_data as Record<number, string[]>);
      }

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
      const duration = Math.min(offering.defaultDuration, totalMonths - startMonth);
      return [...prev, { sku: offering.sku, name: offering.name, pillar: offering.pillar, startMonth, duration, sortOrder: pillarCount, unitPrice: defaultPrice }];
    });
  }, [getAutoStart, offerings, getMinPrice, totalMonths]);

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
      const p1Duration = Math.min(p1.defaultDuration, totalMonths - item.startMonth);
      const p2Start = item.startMonth + p1Duration;
      const p2Duration = Math.min(p2.defaultDuration, totalMonths - p2Start);
      return [
        ...without,
        { sku: p1.sku, name: p1.name, pillar: p1.pillar, startMonth: item.startMonth, duration: p1Duration, sortOrder: item.sortOrder, unitPrice: item.unitPrice },
        { sku: p2.sku, name: p2.name, pillar: p2.pillar, startMonth: p2Start, duration: p2Duration, sortOrder: item.sortOrder + 0.5, unitPrice: item.unitPrice },
      ];
    });
  }, [offerings]);

  const dropOffering = useCallback((sku: number, startMonth: number) => {
    setItems((prev) => {
      if (prev.some((i) => i.sku === sku)) return prev;
      const offering = offerings.find((o) => o.sku === sku);
      if (!offering) return prev;
      const clamped = Math.max(0, Math.min(startMonth, totalMonths - 1));
      const duration = Math.min(offering.defaultDuration, totalMonths - clamped);
      const pillarCount = prev.filter((i) => i.pillar === offering.pillar).length;
      const defaultPrice = getMinPrice(offering);
      return [...prev, { sku: offering.sku, name: offering.name, pillar: offering.pillar, startMonth: clamped, duration, sortOrder: pillarCount, unitPrice: defaultPrice }];
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
    setItems((prev) => {
      const resized = prev.find((i) => i.sku === sku);
      if (!resized) return prev;

      const duration = Math.max(0.5, newDuration);
      const start = Math.max(0, newStartMonth);
      const clampedDuration = Math.min(duration, totalMonths - start);
      const newEnd = start + clampedDuration;
      const oldEnd = resized.startMonth + resized.duration;
      const delta = newEnd - oldEnd;

      // If an IS/FB bar grew, push GO/TS bars forward by the same amount
      const isFB = resized.pillar === "IS" || resized.pillar === "FB";

      return prev.map((item) => {
        if (item.sku === sku) {
          return { ...item, startMonth: start, duration: clampedDuration };
        }
        // Cascade: only push GO/TS bars whose start the new end actually overlaps
        if (isFB && delta > 0 && (item.pillar === "GO" || item.pillar === "TS") && newEnd > item.startMonth) {
          const pushed = newEnd;
          const newItemDuration = Math.min(item.duration, totalMonths - pushed);
          if (pushed < totalMonths) {
            return { ...item, startMonth: pushed, duration: Math.max(0.5, newItemDuration) };
          }
        }
        return item;
      });
    });
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

  const handleOutcomesChange = useCallback((outcomes: Record<number, string[]>) => {
    setOutcomesData(outcomes);
    if (!roadmapId) return;
    if (outcomesTimeoutRef.current) clearTimeout(outcomesTimeoutRef.current);
    outcomesTimeoutRef.current = setTimeout(async () => {
      await supabase.from("roadmaps" as any).update({ outcomes_data: outcomes }).eq("id", roadmapId);
    }, 500);
  }, [roadmapId]);

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
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-4xl font-bold tracking-tight text-foreground">12-Month Digital Growth Plan</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-foreground">Start</label>
              <Select
                value={String(startMonthIndex)}
                onValueChange={(v) => { setStartMonthIndex(Number(v)); setViewOffset(0); }}
              >
                <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m} {new Date().getFullYear() + (i < new Date().getMonth() ? 1 : 0)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-foreground">Duration</label>
              <Select
                value={String(totalMonths)}
                onValueChange={(v) => { setTotalMonths(Number(v)); setViewOffset(0); }}
              >
                <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[6, 9, 12, 18, 24].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} months</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied to clipboard");
                } catch {
                  toast.error("Failed to copy link");
                }
              }}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
            <Button
              variant={showCTAs ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setShowCTAs(!showCTAs)}
            >
              {showCTAs ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {showCTAs ? "CTAs On" : "CTAs Off"}
            </Button>
          </div>
        </div>
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
                  Show Services Catalog
                </Button>
              </div>
            )}
            <TimelineCanvas
              items={items}
              offerings={offerings}
              startMonthIndex={startMonthIndex}
              totalMonths={totalMonths}
              viewOffset={viewOffset}
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
              showLastBorder={catalogVisible}
              onViewOffsetChange={(delta) => {
                setViewOffset((prev) => Math.max(0, prev + delta));
              }}
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
      <div className="-mx-6 rounded-2xl bg-muted/40 px-6 py-8 ring-1 ring-border/50">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-4xl font-bold tracking-tight text-foreground">Investment Options</h2>
          {items.length > 0 && (
            <Button
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
              disabled={generatingOutcomes}
              onClick={async () => {
                if (!generateOutcomesRef.current) return;
                setGeneratingOutcomes(true);
                try {
                  await generateOutcomesRef.current();
                } finally {
                  setGeneratingOutcomes(false);
                }
              }}
            >
              {generatingOutcomes ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {generatingOutcomes ? "Generating..." : "Generate Outcomes"}
            </Button>
          )}
        </div>
        <InvestmentOptions
          items={items}
          offerings={offerings}
          sessionId={sessionId}
          onGenerateRef={(fn) => { generateOutcomesRef.current = fn; }}
          savedOutcomes={outcomesData}
          onOutcomesChange={handleOutcomesChange}
          showCTAs={showCTAs}
        />
      </div>

      {/* GLIDE Guarantee */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-6 py-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">The GLIDE Guarantee</span>
            {" — "}If you're unhappy for any reason within 90 days, we'll make it right or give you your money back.
          </p>
        </div>
      )}

      {/* Feature Comparison Matrix */}
      {items.length > 0 && (
        <div>
          <h2 className="mb-5 text-4xl font-bold tracking-tight text-foreground">What's Included</h2>
          <FeatureMatrix items={items} offerings={offerings} />
        </div>
      )}
    </div>
  );
}
