import { useEffect, useState, useRef } from 'react';
import { Check, Loader2, AlertTriangle } from 'lucide-react';


type IntegrationStep = {
  key: string;
  label: string;
  status: 'done' | 'loading' | 'failed' | 'paused' | 'pending';
};

type Props = {
  steps: IntegrationStep[];
};

export function GlobalProgressBar({ steps }: Props) {
  const activeSteps = steps.filter(s => s.status !== 'paused');
  const doneCount = activeSteps.filter(s => s.status === 'done' || s.status === 'failed').length;
  const totalCount = activeSteps.length;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const currentStep = activeSteps.find(s => s.status === 'loading');
  const allDone = doneCount === totalCount && totalCount > 0;

  // Auto-hide after all done with a brief delay
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (allDone) {
      hideTimer.current = setTimeout(() => setVisible(false), 4000);
    } else {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [allDone]);

  if (!visible || totalCount === 0) return null;

  // Show the scrolling ticker of completed + current items
  const recentDone = activeSteps.filter(s => s.status === 'done');
  const failedSteps = activeSteps.filter(s => s.status === 'failed');

  return (
    <div className="border-b border-border bg-muted/30 relative">
      {/* Progress bar track */}
      <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-border">
        <div
          className="h-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
        {/* Status text */}
        <div className="flex items-center gap-2 shrink-0">
          {allDone ? (
            <Check className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          )}
          <span className="text-xs font-medium text-foreground tabular-nums">
            {allDone ? 'All complete' : `${doneCount}/${totalCount}`}
          </span>
        </div>

        {/* Scrollable step ticker */}
        <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
          {activeSteps.map((step) => (
            <span
              key={step.key}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap shrink-0 transition-all duration-300 ${
                step.status === 'done'
                  ? 'bg-primary/10 text-primary'
                  : step.status === 'loading'
                  ? 'bg-accent text-accent-foreground ring-1 ring-primary/30'
                  : step.status === 'failed'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground/50'
              }`}
            >
              {step.status === 'done' && <Check className="h-2.5 w-2.5" />}
              {step.status === 'loading' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {step.status === 'failed' && <AlertTriangle className="h-2.5 w-2.5" />}
              {step.label}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
