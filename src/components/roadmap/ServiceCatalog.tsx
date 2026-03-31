import { PILLARS } from "@/data/offerings";
import type { Offering } from "@/hooks/useServiceOfferings";
import { Switch } from "@/components/ui/switch";
import { Check, ChevronDown, PanelLeftClose } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface ServiceCatalogProps {
  offerings: Offering[];
  showAll: boolean;
  onShowAllChange: (v: boolean) => void;
  isSelected: (sku: number) => boolean;
  onToggle: (sku: number) => void;
  getCountForPillar: (code: string) => number;
  onCollapse?: () => void;
}

const PILLAR_STYLES: Record<string, { chip: string; chipSelected: string }> = {
  IS: {
    chip: "border-pillar-is/20 hover:bg-pillar-is-light",
    chipSelected: "bg-pillar-is-light border-pillar-is/40 text-pillar-is-foreground",
  },
  FB: {
    chip: "border-pillar-fb/20 hover:bg-pillar-fb-light",
    chipSelected: "bg-pillar-fb-light border-pillar-fb/40 text-pillar-fb-foreground",
  },
  GO: {
    chip: "border-pillar-go/20 hover:bg-pillar-go-light",
    chipSelected: "bg-pillar-go-light border-pillar-go/40 text-pillar-go-foreground",
  },
  TS: {
    chip: "border-pillar-ts/20 hover:bg-pillar-ts-light",
    chipSelected: "bg-pillar-ts-light border-pillar-ts/40 text-pillar-ts-foreground",
  },
};

const DOT_COLORS: Record<string, string> = {
  IS: "bg-pillar-is",
  FB: "bg-pillar-fb",
  GO: "bg-pillar-go",
  TS: "bg-pillar-ts",
};

export default function ServiceCatalog({
  offerings,
  showAll,
  onShowAllChange,
  isSelected,
  onToggle,
  getCountForPillar,
  onCollapse,
}: ServiceCatalogProps) {
  return (
    <aside className="flex h-full flex-col border-r border-border bg-background">
      <div className="flex h-11 items-center justify-between border-b border-border px-5">
        <h2 className="text-sm font-semibold text-foreground">Service Catalog</h2>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapse}
            className="h-7 w-7 text-muted-foreground"
            title="Hide catalog"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {PILLARS.map((p) => {
          const pillarOfferings = offerings.filter(
            (o) => o.pillar === p.code && !o.phaseOf && (showAll || o.roadmapGrade)
          );
          const count = getCountForPillar(p.code);

          return (
            <Collapsible key={p.code} defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-1 py-2 text-left hover:bg-accent/50">
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_COLORS[p.code]}`} />
                <span className="flex-1 text-xs font-semibold text-foreground">
                  {p.name} ({p.code})
                </span>
                {count > 0 && (
                  <span
                    className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-primary-foreground ${DOT_COLORS[p.code]}`}
                  >
                    {count}
                  </span>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-col gap-1 pb-2 pl-6">
                  {pillarOfferings.map((o) => {
                    const selected = isSelected(o.sku);
                    const styles = PILLAR_STYLES[p.code];
                    return (
                      <button
                        key={o.sku}
                        draggable={!selected}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/sku", String(o.sku));
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => onToggle(o.sku)}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                          selected ? styles.chipSelected : `${styles.chip} cursor-grab active:cursor-grabbing`
                        }`}
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {o.sku}
                        </span>
                        <span className="flex-1 truncate font-medium">{o.name}</span>
                        {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                        {!o.roadmapGrade && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            catalog
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {pillarOfferings.length === 0 && (
                    <p className="py-2 text-xs text-muted-foreground">
                      No offerings in this category
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <span className="text-xs text-muted-foreground">Show all offerings</span>
        <Switch checked={showAll} onCheckedChange={onShowAllChange} />
      </div>
    </aside>
  );
}
