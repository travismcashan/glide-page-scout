import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import FeedbackPanel from "./FeedbackPanel";

export default function FeedbackSideTabs() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40" data-feedback-tabs>
        <button
          onClick={() => setOpen(true)}
          className="group flex items-center flex-row-reverse gap-0 overflow-hidden rounded-l-lg bg-primary pl-3 pr-3 py-3.5 shadow-md transition-all duration-200 hover:pl-4 hover:gap-2 hover:shadow-lg hover:bg-primary/90"
        >
          <MessageSquarePlus className="h-5 w-5 text-primary-foreground shrink-0" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-primary-foreground max-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 group-hover:max-w-[90px] relative -top-[2px]">
            FEEDBACK
          </span>
        </button>
      </div>

      <FeedbackPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
