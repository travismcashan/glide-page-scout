import { useRef, useState, useCallback, useLayoutEffect, useEffect } from "react";
import type { TimelineItem, ServiceStep } from "@/types/roadmap";
import type { Offering } from "@/hooks/useServiceOfferings";
import { MONTH_NAMES } from "@/data/offerings";
import { ArrowLeft, Zap, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimelineBarDetailProps {
  item: TimelineItem;
  offering: Offering | undefined;
  startMonthIndex: number;
  totalMonths: number;
  onBack: () => void;
}

const PILLAR_BG: Record<string, string> = {
  IS: "bg-pillar-is/85",
  FB: "bg-pillar-fb/85",
  GO: "bg-pillar-go/85",
  TS: "bg-pillar-ts/85",
};

const PILLAR_BG_HOVER: Record<string, string> = {
  IS: "hover:bg-pillar-is hover:shadow-md",
  FB: "hover:bg-pillar-fb hover:shadow-md",
  GO: "hover:bg-pillar-go hover:shadow-md",
  TS: "hover:bg-pillar-ts hover:shadow-md",
};

const PILLAR_LIGHT: Record<string, string> = {
  IS: "bg-pillar-is/15",
  FB: "bg-pillar-fb/15",
  GO: "bg-pillar-go/15",
  TS: "bg-pillar-ts/15",
};

const PILLAR_DOT: Record<string, string> = {
  IS: "bg-pillar-is",
  FB: "bg-pillar-fb",
  GO: "bg-pillar-go",
  TS: "bg-pillar-ts",
};

const PILLAR_TEXT: Record<string, string> = {
  IS: "text-pillar-is",
  FB: "text-pillar-fb",
  GO: "text-pillar-go",
  TS: "text-pillar-ts",
};

const WEEKS_PER_MONTH = 4.33;

function buildWeekColumns(itemMonths: number, itemStartAbsMonth: number) {
  const totalWeeks = Math.round(itemMonths * WEEKS_PER_MONTH);
  const weeks: { weekNum: number; monthIdx: number; isMonthBoundary: boolean }[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const monthFloat = w / WEEKS_PER_MONTH;
    const monthIdx = Math.floor(monthFloat);
    const prevMonthIdx = w > 0 ? Math.floor((w - 1) / WEEKS_PER_MONTH) : -1;
    weeks.push({
      weekNum: w + 1,
      monthIdx,
      isMonthBoundary: w > 0 && monthIdx !== prevMonthIdx,
    });
  }
  return { weeks, totalWeeks };
}

function buildMonthSpans(itemMonths: number, itemStartAbsMonth: number) {
  const { weeks } = buildWeekColumns(itemMonths, itemStartAbsMonth);
  const currentYear = new Date().getFullYear();
  const spans: { label: string; year: number; count: number }[] = [];

  for (const w of weeks) {
    const absMonth = (itemStartAbsMonth + w.monthIdx) % 12;
    const yearOffset = Math.floor((itemStartAbsMonth + w.monthIdx) / 12);
    const label = MONTH_NAMES[absMonth];
    const year = currentYear + yearOffset;
    const key = `${label}-${year}`;
    if (spans.length > 0 && `${spans[spans.length - 1].label}-${spans[spans.length - 1].year}` === key) {
      spans[spans.length - 1].count++;
    } else {
      spans.push({ label, year, count: 1 });
    }
  }
  return spans;
}

function PhaseBar({
  phase,
  pillar,
  leftPct,
  widthPct,
  widthWeeks,
  top,
  height,
  totalWeeks,
  containerRef,
  onResize,
  isLast,
}: {
  phase: ServiceStep;
  pillar: string;
  leftPct: number;
  widthPct: number;
  widthWeeks: number;
  top: number;
  height: number;
  totalWeeks: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onResize: (phaseId: string, side: "left" | "right", deltaWeeks: number) => void;
  isLast: boolean;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [dragging, setDragging] = useState(false);

  const labelText = `${phase.name} (${widthWeeks}w)`;
  const nearRightEdge = leftPct + widthPct > 85;

  useLayoutEffect(() => {
    const el = textRef.current;
    const bar = barRef.current;
    if (!el || !bar) return;
    const prev = el.style.cssText;
    el.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:13px;font-weight:500;";
    const textW = el.offsetWidth + 16;
    el.style.cssText = prev;
    setOverflows(textW > bar.offsetWidth);
  }, [widthPct, labelText]);

  const handleResize = useCallback(
    (side: "left" | "right", e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const weekWidth = containerWidth / totalWeeks;
      const startX = e.clientX;
      setDragging(true);
      let lastDelta = 0;

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const deltaWeeks = Math.round(dx / weekWidth);
        if (deltaWeeks !== lastDelta) {
          onResize(phase.id, side, deltaWeeks - lastDelta);
          lastDelta = deltaWeeks;
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
    [containerRef, totalWeeks, phase.id, onResize]
  );

  return (
    <div
      ref={barRef}
      className={`group absolute flex items-center rounded-lg ${PILLAR_BG[pillar]} ${PILLAR_BG_HOVER[pillar]} text-foreground transition-all ${dragging ? "opacity-90 shadow-lg" : ""}`}
      style={{
        left: `${leftPct}%`,
        width: `${Math.max(widthPct, 2)}%`,
        top: `${top}px`,
        height: `${height}px`,
      }}
    >
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-col-resize rounded-l-lg opacity-0 transition-opacity group-hover:opacity-100"
        onMouseDown={(e) => handleResize("left", e)}
      />

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

      {phase.isOnramp && (
        <span className="absolute -top-1.5 left-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[8px] font-semibold text-primary z-10">
          On-ramp
        </span>
      )}

      <div
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize rounded-r-lg opacity-0 transition-opacity group-hover:opacity-100"
        onMouseDown={(e) => handleResize("right", e)}
      />
    </div>
  );
}

export default function TimelineBarDetail({
  item,
  offering,
  startMonthIndex,
  totalMonths,
  onBack,
}: TimelineBarDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const steps = offering?.steps || [];
  const phases = steps.filter((s) => s.stepType === "phase");
  const cycles = steps.filter((s) => s.stepType === "cycle");
  const pillar = item.pillar;

  const itemMonths = item.duration;
  const itemStartAbs = startMonthIndex + item.startMonth;
  const { weeks, totalWeeks } = buildWeekColumns(itemMonths, itemStartAbs);
  const monthSpans = buildMonthSpans(itemMonths, itemStartAbs);

  const [phaseLayout, setPhaseLayout] = useState<{ id: string; startWeek: number; widthWeeks: number }[]>([]);

  useEffect(() => {
    if (phases.length === 0) {
      setPhaseLayout([]);
      return;
    }
    const weeksPerPhase = totalWeeks / phases.length;
    setPhaseLayout(
      phases.map((p, idx) => ({
        id: p.id,
        startWeek: Math.round(idx * weeksPerPhase),
        widthWeeks: Math.round((idx + 1) * weeksPerPhase) - Math.round(idx * weeksPerPhase),
      }))
    );
  }, [phases.length, totalWeeks]);

  const handlePhaseResize = useCallback(
    (phaseId: string, side: "left" | "right", deltaWeeks: number) => {
      setPhaseLayout((prev) => {
        const idx = prev.findIndex((p) => p.id === phaseId);
        if (idx === -1) return prev;
        const next = prev.map((p) => ({ ...p }));
        const curr = next[idx];

        if (side === "left") {
          const newStart = curr.startWeek + deltaWeeks;
          const newWidth = curr.widthWeeks - deltaWeeks;
          if (newWidth < 1 || newStart < 0) return prev;
          if (idx > 0 && newStart < next[idx - 1].startWeek + 1) return prev;
          curr.startWeek = newStart;
          curr.widthWeeks = newWidth;
          if (idx > 0) {
            const prevPhase = next[idx - 1];
            const prevEnd = prevPhase.startWeek + prevPhase.widthWeeks;
            if (prevEnd > newStart) {
              prevPhase.widthWeeks = newStart - prevPhase.startWeek;
              if (prevPhase.widthWeeks < 1) return prev;
            }
          }
        } else {
          const newWidth = curr.widthWeeks + deltaWeeks;
          if (newWidth < 1) return prev;
          const newEnd = curr.startWeek + newWidth;
          if (newEnd > totalWeeks) return prev;
          curr.widthWeeks = newWidth;
          if (idx < next.length - 1) {
            const nextPhase = next[idx + 1];
            if (newEnd > nextPhase.startWeek) {
              const diff = newEnd - nextPhase.startWeek;
              nextPhase.startWeek += diff;
              nextPhase.widthWeeks -= diff;
              if (nextPhase.widthWeeks < 1) return prev;
            }
          }
        }

        return next;
      });
    },
    [totalWeeks]
  );

  const BAR_HEIGHT = 40;
  const BAR_GAP = 8;
  const LANE_PAD = 6;

  // Pack phases into lanes — overlapping phases get separate lanes
  const packIntoLanes = useCallback(
    (layout: { id: string; startWeek: number; widthWeeks: number }[]) => {
      const lanes: number[][] = []; // each lane is an array of phase indices
      const laneAssignment: number[] = [];

      for (let i = 0; i < layout.length; i++) {
        const pl = layout[i];
        const end = pl.startWeek + pl.widthWeeks;
        let placed = false;

        for (let lane = 0; lane < lanes.length; lane++) {
          const canFit = lanes[lane].every((idx) => {
            const other = layout[idx];
            const otherEnd = other.startWeek + other.widthWeeks;
            return end <= other.startWeek || pl.startWeek >= otherEnd;
          });
          if (canFit) {
            lanes[lane].push(i);
            laneAssignment[i] = lane;
            placed = true;
            break;
          }
        }

        if (!placed) {
          laneAssignment[i] = lanes.length;
          lanes.push([i]);
        }
      }

      return { laneAssignment, laneCount: lanes.length };
    },
    []
  );

  const { laneAssignment, laneCount } = packIntoLanes(phaseLayout);

  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-3 border-b border-border px-4 py-3 ${PILLAR_LIGHT[pillar]}`}>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Timeline
        </Button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-full ${PILLAR_DOT[pillar]}`} />
          <span className="text-sm font-bold text-foreground">{item.name}</span>
          <span className="text-xs text-muted-foreground">
            ({item.duration} month{item.duration !== 1 ? "s" : ""} · {totalWeeks} week{totalWeeks !== 1 ? "s" : ""})
          </span>
        </div>
      </div>

      <div className="flex flex-col border-b border-border">
        <div className="flex h-7 bg-foreground">
          {monthSpans.map((span, i) => (
            <div
              key={i}
              className="flex items-center justify-center border-r border-foreground/20 last:border-r-0"
              style={{ flex: span.count }}
            >
              <span className="text-[11px] font-bold text-background">{span.label}</span>
              <span className="ml-1 text-[9px] text-background/50">{span.year}</span>
            </div>
          ))}
        </div>
        <div className="flex h-6 bg-foreground/90">
          {weeks.map((w, i) => (
            <div
              key={i}
              className="flex-1 flex items-center justify-center border-r border-foreground/15 last:border-r-0"
            >
              <span className="text-[9px] font-semibold text-background/70">W{w.weekNum}</span>
            </div>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative py-3">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">No phases or cycles defined for this service.</p>
            <p className="text-xs text-muted-foreground mt-1">Add them from the Service Catalog editor.</p>
          </div>
        ) : (
          <>
            {phaseLayout.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 px-4 mb-2">
                  <Zap className={`h-3.5 w-3.5 ${PILLAR_TEXT[pillar]}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phases</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex pointer-events-none">
                    {weeks.map((w, i) => (
                      <div
                        key={i}
                        className={`flex-1 last:border-r-0 ${
                          w.isMonthBoundary ? "border-r border-border" : "border-r border-border/30"
                        }`}
                      />
                    ))}
                  </div>
                  <div
                    className="relative"
                    style={{ height: `${LANE_PAD + laneCount * (BAR_HEIGHT + BAR_GAP) + LANE_PAD}px` }}
                  >
                    {phaseLayout.map((pl, idx) => {
                      const phase = phases.find((p) => p.id === pl.id);
                      if (!phase) return null;
                      const lane = laneAssignment[idx] ?? 0;
                      const leftPct = (pl.startWeek / totalWeeks) * 100;
                      const widthPct = (pl.widthWeeks / totalWeeks) * 100;
                      return (
                        <PhaseBar
                          key={phase.id}
                          phase={phase}
                          pillar={pillar}
                          leftPct={leftPct}
                          widthPct={widthPct}
                          widthWeeks={pl.widthWeeks}
                          top={LANE_PAD + lane * (BAR_HEIGHT + BAR_GAP)}
                          height={BAR_HEIGHT}
                          totalWeeks={totalWeeks}
                          containerRef={containerRef}
                          onResize={handlePhaseResize}
                          isLast={idx === phaseLayout.length - 1}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {cycles.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-4 mb-2">
                  <RotateCw className={`h-3.5 w-3.5 ${PILLAR_TEXT[pillar]}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Recurring Cycles
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex pointer-events-none">
                    {weeks.map((w, i) => (
                      <div
                        key={i}
                        className={`flex-1 last:border-r-0 ${
                          w.isMonthBoundary ? "border-r border-border" : "border-r border-border/30"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="space-y-1 py-1">
                    {cycles.map((cycle) => {
                      const isQuarterly = cycle.frequency === "quarterly";
                      const intervalWeeks = isQuarterly ? Math.round(3 * WEEKS_PER_MONTH) : Math.round(WEEKS_PER_MONTH);
                      return (
                        <div key={cycle.id} className="flex items-center gap-1">
                          <div className="w-44 shrink-0 pr-2 text-right px-4">
                            <p className="text-[10px] font-medium text-foreground truncate">{cycle.name}</p>
                            <p className={`text-[9px] font-mono ${PILLAR_TEXT[pillar]} opacity-60`}>
                              {isQuarterly ? "Quarterly" : "Monthly"}
                            </p>
                          </div>
                          <div className="flex flex-1 gap-px">
                            {weeks.map((_, weekIdx) => {
                              const isActive = weekIdx % intervalWeeks === 0;
                              return (
                                <div key={weekIdx} className="flex-1 flex items-center justify-center">
                                  {isActive ? (
                                    <div className={`h-5 w-full rounded-sm ${PILLAR_DOT[pillar]} opacity-70 transition-opacity hover:opacity-100`} />
                                  ) : (
                                    <div className="h-5 w-full rounded-sm bg-muted/20" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
