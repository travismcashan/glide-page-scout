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
  const sortedSteps = [...activeSteps].sort((a, b) => {
    const order = { done: 0, failed: 1, loading: 2, pending: 3, paused: 4 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });
  const doneCount = activeSteps.filter(s => s.status === 'done' || s.status === 'failed').length;
  const totalCount = activeSteps.length;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const allDone = doneCount === totalCount && totalCount > 0;

  // Two-phase hide: fade out, then collapse height, then remove
  const [phase, setPhase] = useState<'visible' | 'fading' | 'collapsing' | 'hidden'>('visible');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (allDone && phase === 'visible') {
      // Measure current height before starting animation
      if (contentRef.current) {
        setContentHeight(contentRef.current.offsetHeight);
      }
      timerRef.current = setTimeout(() => setPhase('fading'), 3000);
    } else if (!allDone) {
      setPhase('visible');
      setContentHeight(undefined);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [allDone]);

  // After fade completes, start collapsing
  useEffect(() => {
    if (phase === 'fading') {
      const t = setTimeout(() => setPhase('collapsing'), 500);
      return () => clearTimeout(t);
    }
    if (phase === 'collapsing') {
      const t = setTimeout(() => setPhase('hidden'), 400);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'hidden' || totalCount === 0) return null;

  return (
    <div
      className="border-b border-border bg-muted/30 relative overflow-hidden transition-all ease-out"
      style={{
        maxHeight: phase === 'collapsing' ? 0 : contentHeight ?? 'none',
        opacity: phase === 'fading' || phase === 'collapsing' ? 0 : 1,
        transitionDuration: phase === 'collapsing' ? '400ms' : '500ms',
        transitionProperty: 'max-height, opacity',
      }}
      ref={contentRef}
    >
      {/* Progress bar track */}
      <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-border">
        <div
          className="h-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {sortedSteps.map((step) => (
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
