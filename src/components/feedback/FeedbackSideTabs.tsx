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
      {/* Fixed side tabs - left edge */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-px" data-feedback-tabs>
        <button
          onClick={() => setOpenType("bug")}
          className="group flex items-center gap-2 rounded-r-md border border-l-0 border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-2 py-4 shadow-sm transition-all hover:px-3 hover:shadow-md hover:bg-red-100 dark:hover:bg-red-950/60"
          style={{ writingMode: "vertical-lr" }}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 rotate-90" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-red-600 dark:text-red-400">BUG</span>
        </button>
        <button
          onClick={() => setOpenType("feature")}
          className="group flex items-center gap-2 rounded-r-md border border-l-0 border-border bg-muted/50 px-2 py-4 shadow-sm transition-all hover:px-3 hover:shadow-md hover:bg-muted"
          style={{ writingMode: "vertical-lr" }}
        >
          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground rotate-90" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">FEATURE</span>
        </button>
      </div>

      <FeedbackPanel type={openType} onClose={() => setOpenType(null)} />
    </>
  );
}
