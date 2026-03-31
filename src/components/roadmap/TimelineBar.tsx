import { useRef, useCallback, useState, useLayoutEffect, useEffect } from "react";
import type { TimelineItem } from "@/types/roadmap";
import type { Offering } from "@/hooks/useServiceOfferings";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { getMonthLabels } from "@/data/offerings";
import { X, Scissors, DollarSign, Search } from "lucide-react";
import { isPpcOffering, calcPpcManagementFee, getPpcTierLabel, PPC_FLAT_THRESHOLD } from "@/lib/ppcPricing";

interface TimelineBarProps {
  item: TimelineItem;
  offerings: Offering[];
  columnWidth: number;
  totalMonths: number;
  startMonthIndex: number;
  onMove: (sku: number, newStart: number) => void;
  onResize: (sku: number, newStart: number, newDuration: number) => void;
  onRemove: (sku: number) => void;
  onSplit?: (sku: number) => void;
  onRename?: (sku: number, newName: string) => void;
  onReorder?: (sku: number, direction: "up" | "down") => void;
  onSetPrice?: (sku: number, price: number) => void;
  onSetAdSpend?: (sku: number, adSpend: number) => void;
  onSetDiscount?: (sku: number, type: "percent" | "fixed" | null, value: number | null) => void;
  onFocus?: (sku: number) => void;
  rowIndex: number;
  rowCount: number;
}

const BAR_STYLES: Record<string, string> = {
  IS: "bg-pillar-is/85 text-foreground",
  FB: "bg-pillar-fb/85 text-foreground",
  GO: "bg-pillar-go/85 text-foreground",
  TS: "bg-pillar-ts/85 text-foreground",
};

const BAR_HOVER: Record<string, string> = {
  IS: "hover:bg-pillar-is hover:shadow-md",
  FB: "hover:bg-pillar-fb hover:shadow-md",
  GO: "hover:bg-pillar-go hover:shadow-md",
  TS: "hover:bg-pillar-ts hover:shadow-md",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function DiscountSection({
  discountTypeDraft,
  discountValueDraft,
  onTypeChange,
  onValueChange,
}: {
  discountTypeDraft: "percent" | "fixed" | "";
  discountValueDraft: string;
  onTypeChange: (v: "percent" | "fixed" | "") => void;
  onValueChange: (v: string) => void;
}) {
  return (
    <div className="border-t border-border pt-2 space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground">Discount</p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onTypeChange(discountTypeDraft === "percent" ? "" : "percent")}
          className={`rounded px-2 py-0.5 text-xs ${discountTypeDraft === "percent" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
        >
          %
        </button>
        <button
          onClick={() => onTypeChange(discountTypeDraft === "fixed" ? "" : "fixed")}
          className={`rounded px-2 py-0.5 text-xs ${discountTypeDraft === "fixed" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
        >
          $ Off
        </button>
        {discountTypeDraft && (
          <input
            type="text"
            value={discountValueDraft}
            onChange={(e) => onValueChange(e.target.value)}
            className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
            placeholder={discountTypeDraft === "percent" ? "e.g. 10" : "e.g. 500"}
          />
        )}
      </div>
    </div>
  );
}

function getPriceRange(offering: Offering): { min: number; max: number } | null {
  if (offering.minRetainer != null || offering.maxRetainer != null)
    return { min: Number(offering.minRetainer ?? 0), max: Number(offering.maxRetainer ?? offering.minRetainer ?? 0) };
  if (offering.minFixed != null || offering.maxFixed != null)
    return { min: Number(offering.minFixed ?? 0), max: Number(offering.maxFixed ?? offering.minFixed ?? 0) };
  if (offering.minHourly != null || offering.maxHourly != null)
    return { min: Number(offering.minHourly ?? 0), max: Number(offering.maxHourly ?? offering.minHourly ?? 0) };
  return null;
}

export default function TimelineBar({
  item,
  offerings,
  columnWidth,
  totalMonths,
  startMonthIndex,
  onMove,
  onResize,
  onRemove,
  onSplit,
  onRename,
  onReorder,
  onSetPrice,
  onSetAdSpend,
  onSetDiscount,
  onFocus,
  rowIndex,
  rowCount,
}: TimelineBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [dragging, setDragging] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");
  const [adSpendDraft, setAdSpendDraft] = useState("");
  const [discountTypeDraft, setDiscountTypeDraft] = useState<"percent" | "fixed" | "">(item.discountType || "");
  const [discountValueDraft, setDiscountValueDraft] = useState(item.discountValue != null ? String(item.discountValue) : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (priceOpen) {
      setPriceDraft(item.unitPrice != null ? String(item.unitPrice) : "");
      setAdSpendDraft(item.estimatedAdSpend != null ? String(item.estimatedAdSpend) : "");
      setDiscountTypeDraft(item.discountType || "");
      setDiscountValueDraft(item.discountValue != null ? String(item.discountValue) : "");
      setTimeout(() => priceInputRef.current?.focus(), 50);
    }
  }, [priceOpen, item.unitPrice, item.estimatedAdSpend, item.discountType, item.discountValue]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.name && onRename) {
      onRename(item.sku, trimmed);
    } else {
      setDraft(item.name);
    }
  };

  const commitPrice = () => {
    const val = parseFloat(priceDraft.replace(/[^0-9.]/g, ""));
    if (!isNaN(val) && val >= 0 && onSetPrice) {
      onSetPrice(item.sku, val);
    }
  };

  const commitDiscount = () => {
    if (!onSetDiscount) return;
    const val = parseFloat(discountValueDraft.replace(/[^0-9.]/g, ""));
    if (discountTypeDraft && !isNaN(val) && val > 0) {
      onSetDiscount(item.sku, discountTypeDraft as "percent" | "fixed", val);
    } else {
      onSetDiscount(item.sku, null, null);
    }
  };

  const commitAll = () => {
    commitPrice();
    commitDiscount();
    setPriceOpen(false);
  };

  const offering = offerings.find((o) => o.sku === item.sku);
  const priceRange = offering ? getPriceRange(offering) : null;
  const isPpc = offering ? isPpcOffering(offering.name) : false;

  const commitAdSpend = () => {
    const val = parseFloat(adSpendDraft.replace(/[^0-9.]/g, ""));
    if (!isNaN(val) && val >= 0 && onSetAdSpend) {
      onSetAdSpend(item.sku, val);
      if (onSetPrice) {
        onSetPrice(item.sku, calcPpcManagementFee(val));
      }
    }
  };

  const ROW_HEIGHT = 52;

  const handleDragMove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const origStart = item.startMonth;
      let lastRowDelta = 0;
      setDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        const deltaX = Math.round((ev.clientX - startX) / (columnWidth / 2)) / 2;
        if (deltaX !== 0) onMove(item.sku, origStart + deltaX);
        if (onReorder) {
          const deltaY = Math.round((ev.clientY - startY) / ROW_HEIGHT);
          if (deltaY !== lastRowDelta) {
            const dir = deltaY > lastRowDelta ? "down" : "up";
            onReorder(item.sku, dir);
            lastRowDelta = deltaY;
          }
        }
      };

      const onMouseUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [item, columnWidth, onMove, onReorder]
  );

  const handleResizeLeft = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const origStart = item.startMonth;
      const origDuration = item.duration;
      setDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        const delta = Math.round((ev.clientX - startX) / (columnWidth / 2)) / 2;
        const newStart = origStart + delta;
        const newDuration = origDuration - delta;
        if (newDuration >= 0.5 && newStart >= 0) {
          onResize(item.sku, newStart, newDuration);
        }
      };

      const onMouseUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [item, columnWidth, onResize]
  );

  const handleResizeRight = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const origDuration = item.duration;
      setDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        const delta = Math.round((ev.clientX - startX) / (columnWidth / 2)) / 2;
        const newDuration = origDuration + delta;
        if (newDuration >= 0.5 && item.startMonth + newDuration <= totalMonths) {
          onResize(item.sku, item.startMonth, newDuration);
        }
      };

      const onMouseUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [item, columnWidth, onResize]
  );

  const canSplit = offerings.some((o) => o.phaseOf === item.sku);
  const months = getMonthLabels(startMonthIndex, totalMonths);
  const startLabel = months[item.startMonth];
  const endLabel = months[Math.min(item.startMonth + item.duration - 1, totalMonths - 1)];

  const PAD = 4;
  const visibleDuration = Math.min(item.duration, totalMonths - item.startMonth);
  const barLeft = item.startMonth * columnWidth + PAD;
  const barWidth = visibleDuration * columnWidth - PAD * 2;
  const labelText = `${item.name} (${item.duration} mo)`;
  const barEnd = item.startMonth + visibleDuration;
  const nearRightEdge = barEnd >= totalMonths - 1;

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const prev = el.style.cssText;
    el.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:14px;font-weight:500;";
    const textW = el.offsetWidth + 20;
    el.style.cssText = prev;
    const actualBarWidth = Math.max(barWidth, columnWidth * 0.5);
    setOverflows(textW > actualBarWidth);
  }, [barWidth, columnWidth, labelText]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={barRef}
          className={`group absolute top-0 flex h-10 items-center rounded-lg transition-all ${BAR_STYLES[item.pillar]} ${BAR_HOVER[item.pillar]} ${dragging ? "opacity-90 shadow-lg" : ""} ${editing ? "cursor-text" : "cursor-grab"}`}
          style={{
            left: `${barLeft}px`,
            width: `${Math.max(barWidth, columnWidth * 0.5)}px`,
          }}
          onMouseDown={editing ? undefined : handleDragMove}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDraft(item.name);
            setEditing(true);
          }}
        >
          <div
            className="absolute left-0 top-0 h-full w-2 cursor-col-resize rounded-l-lg opacity-0 transition-opacity group-hover:opacity-100"
            onMouseDown={handleResizeLeft}
          />

          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") { setDraft(item.name); setEditing(false); }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={
                overflows
                  ? nearRightEdge
                    ? "absolute right-full z-10 mr-2 border-b border-primary bg-transparent text-sm font-medium text-foreground outline-none"
                    : "absolute left-full z-10 ml-2 border-b border-primary bg-transparent text-sm font-medium text-foreground outline-none"
                  : "flex-1 bg-transparent px-2.5 text-center text-sm font-medium outline-none"
              }
            />
          ) : (
            <span
              ref={textRef}
              className={
                overflows
                  ? nearRightEdge
                    ? "pointer-events-none absolute right-full z-10 mr-2 whitespace-nowrap text-sm font-medium text-foreground"
                    : "pointer-events-none absolute left-full z-10 ml-2 whitespace-nowrap text-sm font-medium text-foreground"
                  : "flex-1 truncate px-2.5 text-center text-sm font-medium"
              }
            >
              {labelText}
            </span>
          )}

          {onSetPrice && (priceRange || isPpc) && (
            <Popover open={priceOpen} onOpenChange={setPriceOpen}>
              <PopoverTrigger asChild>
                <button
                  className="absolute -bottom-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 shadow-sm transition-opacity hover:bg-primary group-hover:opacity-100"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPriceOpen(true);
                  }}
                >
                  <DollarSign className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 p-3"
                side="bottom"
                align="center"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {isPpc ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-foreground">Est. Monthly Ad Spend</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <input
                        ref={priceInputRef}
                        type="text"
                        value={adSpendDraft}
                        onChange={(e) => {
                          setAdSpendDraft(e.target.value);
                          const val = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
                          if (!isNaN(val) && val >= 0) {
                            setPriceDraft(String(calcPpcManagementFee(val)));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { commitAdSpend(); commitAll(); }
                          if (e.key === "Escape") setPriceOpen(false);
                        }}
                        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                        placeholder="e.g. 5000"
                      />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {[5000, 10000, 20000, 35000, 50000].map((v) => (
                        <button
                          key={v}
                          onClick={() => {
                            setAdSpendDraft(String(v));
                            setPriceDraft(String(calcPpcManagementFee(v)));
                          }}
                          className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                        >
                          ${(v / 1000).toFixed(0)}k
                        </button>
                      ))}
                    </div>
                    {adSpendDraft && !isNaN(parseFloat(adSpendDraft)) && (
                      <p className="text-xs text-muted-foreground border-t border-border pt-2">
                        Mgmt fee: <span className="font-medium text-foreground">${priceDraft}/mo</span>
                        <span className="ml-1">({getPpcTierLabel(parseFloat(adSpendDraft.replace(/[^0-9.]/g, "")))})</span>
                      </p>
                    )}
                    <DiscountSection
                      discountTypeDraft={discountTypeDraft}
                      discountValueDraft={discountValueDraft}
                      onTypeChange={setDiscountTypeDraft}
                      onValueChange={setDiscountValueDraft}
                    />
                    <button
                      onClick={() => { commitAdSpend(); commitAll(); }}
                      className="w-full rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Apply
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Set Price {priceRange && `(${formatCurrency(priceRange.min)} – ${formatCurrency(priceRange.max)})`}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <input
                        ref={priceInputRef}
                        type="text"
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitAll();
                          if (e.key === "Escape") setPriceOpen(false);
                        }}
                        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                        placeholder={priceRange ? String(priceRange.min) : ""}
                      />
                    </div>
                    {priceRange && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setPriceDraft(String(priceRange.min)); }}
                          className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                        >
                          Min
                        </button>
                        <button
                          onClick={() => { setPriceDraft(String(Math.round((priceRange.min + priceRange.max) / 2))); }}
                          className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                        >
                          Mid
                        </button>
                        <button
                          onClick={() => { setPriceDraft(String(priceRange.max)); }}
                          className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                        >
                          Max
                        </button>
                      </div>
                    )}
                    <DiscountSection
                      discountTypeDraft={discountTypeDraft}
                      discountValueDraft={discountValueDraft}
                      onTypeChange={setDiscountTypeDraft}
                      onValueChange={setDiscountValueDraft}
                    />
                    <button
                      onClick={commitAll}
                      className="w-full rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}

          {canSplit && onSplit && (
            <button
              className="absolute -left-2 -top-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 shadow-sm transition-opacity hover:bg-primary group-hover:opacity-100"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSplit(item.sku);
              }}
            >
              <Scissors className="h-3 w-3" />
            </button>
          )}

          {onFocus && offering?.steps && offering.steps.length > 0 && (
            <button
              className="absolute -left-2 bottom-0 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 shadow-sm transition-opacity hover:bg-primary group-hover:opacity-100"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFocus(item.sku);
              }}
              title="Zoom into phases & cycles"
            >
              <Search className="h-3 w-3" />
            </button>
          )}

          <button
            className="absolute -right-2 -top-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 shadow-sm transition-opacity hover:bg-destructive group-hover:opacity-100"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(item.sku);
            }}
          >
            <X className="h-3 w-3" />
          </button>

          <div
            className="absolute right-0 top-0 h-full w-2 cursor-col-resize rounded-r-lg opacity-0 transition-opacity group-hover:opacity-100"
            onMouseDown={handleResizeRight}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-semibold">{item.name}</p>
        <p className="text-muted-foreground">
          SKU {item.sku} · {startLabel}–{endLabel} ({item.duration} mo)
          {item.unitPrice != null && ` · ${formatCurrency(item.unitPrice)}/mo`}
          {isPpc && item.estimatedAdSpend != null && ` · Ad spend: ${formatCurrency(item.estimatedAdSpend)}/mo`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
