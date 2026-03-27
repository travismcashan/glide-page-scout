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

      <div className="max-w-6xl mx-auto px-12 py-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {activeSteps.map((step) => (
            <span
              key={step.key}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-300 ${
                step.status === 'done'
                  ? 'bg-green-600/20 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                  : step.status === 'loading'
                  ? 'bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                  : step.status === 'failed'
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-muted text-muted-foreground/60'
              }`}
            >
              {step.status === 'done' && <Check className="h-3 w-3" />}
              {step.status === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
              {step.status === 'failed' && <AlertTriangle className="h-3 w-3" />}
              {step.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
