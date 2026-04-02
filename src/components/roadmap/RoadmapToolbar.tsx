import { Sparkles, Share2, Eye, EyeOff, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES } from "@/data/offerings";

interface RoadmapToolbarProps {
  startMonthIndex: number;
  onStartMonthChange: (value: number) => void;
  totalMonths: number;
  onTotalMonthsChange: (value: number) => void;
  showCTAs: boolean;
  onShowCTAsChange: (value: boolean) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  hasItems: boolean;
  catalogVisible?: boolean;
  onShowCatalog?: () => void;
}

export default function RoadmapToolbar({
  startMonthIndex,
  onStartMonthChange,
  totalMonths,
  onTotalMonthsChange,
  showCTAs,
  onShowCTAsChange,
  isGenerating,
  onGenerate,
  hasItems,
  catalogVisible,
  onShowCatalog,
}: RoadmapToolbarProps) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5">
      {/* Left: controls */}
      <div className="flex items-center gap-4">
        {!catalogVisible && onShowCatalog && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={onShowCatalog}>
            <PanelLeftOpen className="h-3.5 w-3.5" />
            Services
          </Button>
        )}
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-foreground">Start</label>
          <Select
            value={String(startMonthIndex)}
            onValueChange={(v) => onStartMonthChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i} value={String(i)}>
                  {m} {new Date().getFullYear() + (i < new Date().getMonth() ? 1 : 0)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-foreground">Duration</label>
          <Select
            value={String(totalMonths)}
            onValueChange={(v) => onTotalMonthsChange(Number(v))}
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
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
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
          onClick={() => onShowCTAsChange(!showCTAs)}
        >
          {showCTAs ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {showCTAs ? "CTAs On" : "CTAs Off"}
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          size="sm"
          className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
          disabled={isGenerating}
          onClick={onGenerate}
        >
          {isGenerating ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 104 104" fill="none" className="h-4 w-4 animate-spin">
              <circle cx="50" cy="49" r="46" stroke="currentColor" strokeWidth="9" strokeDasharray="120 170" />
              <circle cx="50" cy="67" r="28" stroke="currentColor" strokeWidth="9" strokeDasharray="80 100" />
              <circle cx="50" cy="77" r="18" stroke="currentColor" strokeWidth="9" strokeDasharray="50 65" />
            </svg>
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isGenerating ? "Generating..." : "Generate Growth Plan"}
        </Button>
      </div>
    </div>
  );
}
