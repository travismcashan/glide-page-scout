import { useEffect, useState, useRef } from 'react';
import { Check, Loader2, AlertTriangle, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';


type IntegrationStep = {
  key: string;
  label: string;
  status: 'done' | 'loading' | 'failed' | 'paused' | 'pending';
  /** Override the data-section-id to scroll to. Defaults to key. */
  cardId?: string;
};

type Props = {
  steps: IntegrationStep[];
  onStop?: () => void;
  stopped?: boolean;
};

export function GlobalProgressBar({ steps, onStop, stopped }: Props) {
  // Elapsed time counter
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, []);

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
      className="bg-muted/30 relative overflow-hidden transition-all ease-out"
      style={{
        maxHeight: phase === 'collapsing' ? 0 : contentHeight ?? 'none',
        opacity: phase === 'fading' || phase === 'collapsing' ? 0 : 1,
        transitionDuration: phase === 'collapsing' ? '400ms' : '500ms',
        transitionProperty: 'max-height, opacity',
      }}
      ref={contentRef}
    >
      {/* Progress bar track — Rainbow Signature Moment accent */}
      <div className="absolute top-0 left-0 right-0 h-[4px] bg-border overflow-hidden">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)',
            backgroundSize: '200% auto',
            animation: `rainbow-shift ${allDone ? '20s' : '8s'} linear infinite`,
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-5 py-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {sortedSteps.map((step) => (
            <span
              key={step.key}
              onClick={() => {
                const targetId = step.cardId ?? step.key;
                const el = document.querySelector(`[data-section-id="${targetId}"]`);
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 80;
                  window.scrollTo({ top, behavior: 'smooth' });
                }
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-300 cursor-pointer hover:brightness-110 active:scale-95 ${
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
          {onStop && !allDone && !stopped && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onStop}
              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full shrink-0"
            >
              <Square className="h-3 w-3 mr-1 fill-current" />
              Stop
            </Button>
          )}
          {stopped && !allDone && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground bg-muted shrink-0">
              <Square className="h-3 w-3 fill-current" />
              Stopped
            </span>
          )}
          {!allDone && (
            <span className="text-xs text-muted-foreground/50 tabular-nums shrink-0">{elapsed}s</span>
          )}
        </div>
      </div>
    </div>
  );
}
