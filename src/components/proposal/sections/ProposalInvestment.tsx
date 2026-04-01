import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { TimelineItem } from "@/types/roadmap";
import type { Offering } from "@/hooks/useServiceOfferings";
import InvestmentOptions from "@/components/roadmap/InvestmentOptions";
import FeatureMatrix from "@/components/roadmap/FeatureMatrix";

interface ProposalInvestmentProps {
  items: TimelineItem[];
  offerings: Offering[];
  sessionId?: string;
  savedOutcomes?: Record<number, string[]>;
  onOutcomesChange?: (outcomes: Record<number, string[]>) => void;
}

export default function ProposalInvestment({ items, offerings, sessionId, savedOutcomes, onOutcomesChange }: ProposalInvestmentProps) {
  const [featureExpanded, setFeatureExpanded] = useState(false);

  if (!items.length) {
    return (
      <section className="py-20 px-8 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
            <span className="font-bold">Investment</span>{" "}
            <span className="font-light">Options</span>
          </h2>
          <hr className="border-t-2 border-foreground mt-8 mb-8" />
          <p className="text-muted-foreground italic">No services configured yet. Add services to the Roadmap tab to populate pricing.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
          <span className="font-bold">Investment</span>{" "}
          <span className="font-light">Options</span>
        </h2>
        <hr className="border-t-2 border-foreground mt-8 mb-6" />

        {/* Exact same 3-column investment cards from Roadmap tab */}
        <InvestmentOptions
          items={items}
          offerings={offerings}
          sessionId={sessionId}
          savedOutcomes={savedOutcomes}
          onOutcomesChange={onOutcomesChange}
          showCTAs={false}
        />

        {/* Expandable What's Included */}
        {items.length > 0 && (
          <div className="mt-8">
            <button
              className="mx-auto flex items-center gap-1.5 rounded-lg border border-border bg-background px-5 py-2.5 text-[13px] font-semibold tracking-widest text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground"
              onClick={() => setFeatureExpanded(!featureExpanded)}
            >
              {featureExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {featureExpanded ? "HIDE WHAT'S INCLUDED" : "SHOW WHAT'S INCLUDED"}
            </button>
            {featureExpanded && (
              <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <FeatureMatrix items={items} offerings={offerings} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
