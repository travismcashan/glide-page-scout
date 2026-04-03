import { Badge } from '@/components/ui/badge';
import { Layers, Link2, Shield, Sparkles, Check } from 'lucide-react';

export type PhaseStatus = 'pending' | 'active' | 'complete' | 'skipped';

type Props = {
  activePhase: number;
  phaseStatuses: PhaseStatus[];
  phaseCounts: (number | undefined)[];
  onPhaseClick: (phase: number) => void;
};

const STEPS: { label: string; icon: any }[] = [
  { label: 'Map', icon: Link2 },
  { label: 'Deduplicate', icon: Layers },
  { label: 'Validate', icon: Shield },
  { label: 'Enrich', icon: Sparkles },
];

export default function CleanupStepper({ activePhase, phaseStatuses, phaseCounts, onPhaseClick }: Props) {
  return (
    <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, i) => {
        const status = phaseStatuses[i];
        const isActive = i === activePhase;
        const isComplete = status === 'complete';
        const isClickable = isComplete || isActive;
        const Icon = isComplete ? Check : step.icon;

        return (
          <div key={i} className="flex items-center">
            {i > 0 && (
              <div className={`w-6 h-px mx-1 ${isComplete || (i <= activePhase) ? 'bg-primary/50' : 'bg-border'}`} />
            )}
            <button
              onClick={() => isClickable && onPhaseClick(i)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/30 font-medium'
                  : isComplete
                  ? 'bg-green-500/10 text-green-600 border border-green-500/20 cursor-pointer hover:bg-green-500/15'
                  : 'bg-muted/50 text-muted-foreground border border-transparent'
              }`}
            >
              <Icon className={`h-4 w-4 ${isComplete ? 'text-green-600' : ''}`} />
              <span>{step.label}</span>
              {phaseCounts[i] !== undefined && (
                <Badge
                  variant="outline"
                  className={`text-[10px] py-0 px-1.5 ${
                    isComplete ? 'text-green-600 border-green-500/30' :
                    isActive ? 'text-primary border-primary/30' :
                    'text-muted-foreground'
                  }`}
                >
                  {phaseCounts[i]}
                </Badge>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
