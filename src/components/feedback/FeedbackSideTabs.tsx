import { useState } from "react";
import { AlertTriangle, Lightbulb } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import FeedbackPanel from "./FeedbackPanel";

export default function FeedbackSideTabs() {
  const { user } = useAuth();
  const [openType, setOpenType] = useState<"bug" | "feature" | null>(null);

  if (!user) return null;

  return (
    <>
      {/* Fixed side tabs - left edge, icon-only with label on hover */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3" data-feedback-tabs>
        <button
          onClick={() => setOpenType("bug")}
          className="group flex items-center gap-0 overflow-hidden rounded-r-lg bg-red-50 dark:bg-red-950/40 pl-2.5 pr-2.5 py-3 shadow-sm transition-all duration-200 hover:pr-4 hover:gap-2 hover:shadow-md hover:bg-red-100 dark:hover:bg-red-950/60"
        >
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <span className="text-xs font-semibold tracking-wider uppercase text-red-600 dark:text-red-400 max-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 group-hover:max-w-[60px]">
            BUG
          </span>
        </button>
        <button
          onClick={() => setOpenType("feature")}
          className="group flex items-center gap-0 overflow-hidden rounded-r-lg bg-muted/60 pl-2.5 pr-2.5 py-3 shadow-sm transition-all duration-200 hover:pr-4 hover:gap-2 hover:shadow-md hover:bg-muted"
        >
          <Lightbulb className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground max-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 group-hover:max-w-[80px]">
            FEATURE
          </span>
        </button>
      </div>

      <FeedbackPanel type={openType} onClose={() => setOpenType(null)} />
    </>
  );
}
