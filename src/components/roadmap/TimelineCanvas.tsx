import { useRef, useState, useEffect, useCallback } from "react";
import { PILLARS, getMonthLabels, getMonthYearLabels } from "@/data/offerings";
import type { Offering } from "@/hooks/useServiceOfferings";
import type { TimelineItem } from "@/types/roadmap";
import TimelineBar from "@/components/roadmap/TimelineBar";
import TimelineBarDetail from "@/components/roadmap/TimelineBarDetail";
import { LayoutGrid } from "lucide-react";

interface TimelineCanvasProps {
  items: TimelineItem[];
  offerings: Offering[];
  startMonthIndex: number;
  totalMonths: number;
  onMove: (sku: number, newStart: number) => void;
  onResize: (sku: number, newStart: number, newDuration: number) => void;
  onRemove: (sku: number) => void;
  onSplit?: (sku: number) => void;
  onDropOffering: (sku: number, startMonth: number) => void;
  onRename?: (sku: number, newName: string) => void;
  onReorder?: (sku: number, direction: "up" | "down") => void;
  onSetPrice?: (sku: number, price: number) => void;
  onSetAdSpend?: (sku: number, adSpend: number) => void;
  onSetDiscount?: (sku: number, type: "percent" | "fixed" | null, value: number | null) => void;
  showLastBorder?: boolean;
}

const LANE_LABEL_COLORS: Record<string, string> = {
  IS: "text-pillar-is",
  FB: "text-pillar-fb",
  GO: "text-pillar-go",
  TS: "text-pillar-ts",
};

const PILLAR_DOT_COLORS: Record<string, string> = {
  IS: "bg-pillar-is",
  FB: "bg-pillar-fb",
  GO: "bg-pillar-go",
  TS: "bg-pillar-ts",
};

export default function TimelineCanvas({
  items,
  offerings,
  startMonthIndex,
  totalMonths,
  onMove,
  onResize,
  onRemove,
  onSplit,
  onDropOffering,
  onRename,
  onReorder,
  onSetPrice,
  onSetAdSpend,
  onSetDiscount,
  showLastBorder,
}: TimelineCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnWidth, setColumnWidth] = useState(80);
  const [dropMonth, setDropMonth] = useState<number | null>(null);
  const [focusedSku, setFocusedSku] = useState<number | null>(null);

  useEffect(() => {
    if (focusedSku != null) return;
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.offsetWidth;
      setColumnWidth(w / totalMonths);
    };
    requestAnimationFrame(measure);

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [totalMonths, focusedSku]);

  const getMonthFromX = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      return Math.max(0, Math.min(totalMonths - 1, Math.round((x / columnWidth) * 2) / 2));
    },
    [columnWidth, totalMonths]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("application/sku")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDropMonth(getMonthFromX(e.clientX));
    },
    [getMonthFromX]
  );

  const handleDragLeave = useCallback(() => {
    setDropMonth(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const skuStr = e.dataTransfer.getData("application/sku");
      if (!skuStr) return;
      const sku = Number(skuStr);
      const month = getMonthFromX(e.clientX);
      onDropOffering(sku, month);
      setDropMonth(null);
    },
    [getMonthFromX, onDropOffering]
  );

  const months = getMonthLabels(startMonthIndex, totalMonths);
  const monthYears = getMonthYearLabels(startMonthIndex, totalMonths);
  const activePillars = PILLARS.filter((p) =>
    items.some((i) => i.pillar === p.code)
  );

  const focusedItem = focusedSku != null ? items.find((i) => i.sku === focusedSku) : null;
  const focusedOffering = focusedItem ? offerings.find((o) => o.sku === focusedItem.sku) : undefined;

  if (focusedItem) {
    return (
      <div className="flex flex-col bg-background">
        <TimelineBarDetail
          item={focusedItem}
          offering={focusedOffering}
          startMonthIndex={startMonthIndex}
          totalMonths={totalMonths}
          onBack={() => setFocusedSku(null)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Month headers */}
      <div ref={containerRef} className="flex h-16 border-b border-border bg-foreground">
        {monthYears.map((my, i) => {
          const isYearEnd = i < monthYears.length - 1 && monthYears[i].year !== monthYears[i + 1].year;
          return (
            <div
              key={i}
              className={`flex-1 flex flex-col items-center justify-center border-r transition-colors last:border-r-0 ${
                isYearEnd ? "border-background/40" : "border-foreground/20"
              } ${dropMonth === i ? "bg-accent" : ""}`}
            >
              <span className="text-base font-bold text-background">{my.month}</span>
              <span className="text-xs font-normal text-background/60">{my.year}</span>
            </div>
          );
        })}
      </div>

      {/* Swim lanes */}
      <div className="relative overflow-y-auto overflow-x-hidden">
        {dropMonth !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-20 border-l-2 border-dashed border-primary/40 bg-primary/5"
            style={{
              left: `${dropMonth * columnWidth}px`,
              width: `${columnWidth}px`,
            }}
          />
        )}

        {activePillars.length === 0 && (
          <div className="flex h-48 flex-col items-center justify-center gap-3 px-8 text-center">
            <LayoutGrid className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {dropMonth !== null
                ? "Drop here to place the offering"
                : "Select offerings from the catalog — or drag them onto the timeline"}
            </p>
          </div>
        )}

        {activePillars.map((pillar, pillarIdx) => {
          const pillarItems = items.filter((i) => i.pillar === pillar.code).sort((a, b) => a.sortOrder - b.sortOrder);
          const barHeight = 40;
          const gap = 9;
          const laneHeight = gap + pillarItems.length * (barHeight + gap);
          const isLastPillar = pillarIdx === activePillars.length - 1;
          const showBorder = !isLastPillar || showLastBorder;

          return (
            <div key={pillar.code} className={`relative ${showBorder ? "border-b border-foreground/10" : ""}`}>
              <div className="relative">
                <div className="absolute inset-0 flex">
                  {months.map((_, i) => (
                    <div key={i} className="flex-1 border-r border-foreground/10 last:border-r-0" />
                  ))}
                </div>
                <div className="relative" style={{ height: `${laneHeight}px` }}>
                  {pillarItems.map((item, idx) => (
                    <div
                      key={item.sku}
                      className="absolute left-0 right-0"
                      style={{ top: `${gap + idx * (barHeight + gap)}px` }}
                    >
                      <TimelineBar
                        item={item}
                        offerings={offerings}
                        columnWidth={columnWidth}
                        totalMonths={totalMonths}
                        startMonthIndex={startMonthIndex}
                        onMove={onMove}
                        onResize={onResize}
                        onRemove={onRemove}
                        onSplit={onSplit}
                        onRename={onRename}
                        onReorder={onReorder}
                        onSetPrice={onSetPrice}
                        onSetAdSpend={onSetAdSpend}
                        onSetDiscount={onSetDiscount}
                        onFocus={setFocusedSku}
                        rowIndex={idx}
                        rowCount={pillarItems.length}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
