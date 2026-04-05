import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Minus } from 'lucide-react';
import { GradeBadge } from '@/components/GradeBadge';
import type { LetterGrade, ScoreSignal } from '@/lib/siteScore';

type Props = {
  title: string;
  children: React.ReactNode;
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  className?: string;
  /** DOM id for scroll-to and IntersectionObserver targeting */
  id?: string;
  grade?: LetterGrade;
  score?: number;
  /** AI-generated or template insight for this category */
  categoryInsight?: string;
  /** Strengths and gaps for inline display */
  strengths?: ScoreSignal[];
  gaps?: ScoreSignal[];
};

export function CollapsibleSection({ title, children, collapsed: controlledCollapsed, onToggle, className, id, grade, score, categoryInsight, strengths, gaps }: Props) {
  const [internal, setInternal] = useState(false);
  const isCollapsed = controlledCollapsed ?? internal;

  const toggle = () => {
    const next = !isCollapsed;
    if (onToggle) onToggle(next);
    else setInternal(next);
  };

  const hasSignals = (strengths && strengths.length > 0) || (gaps && gaps.length > 0);
  const isScored = grade != null && score != null;

  return (
    <div className={className} id={id}>
      {/* Section header */}
      <div className="mt-14 mb-6 first:mt-0">
        <button
          type="button"
          className="flex items-center gap-2 w-full text-left group"
          onClick={toggle}
        >
          {isCollapsed
            ? <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            : <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          }
          <h2 className="text-2xl font-semibold tracking-tight text-foreground group-hover:text-foreground/80 transition-colors">
            {title}
          </h2>
          {isScored && (
            <GradeBadge grade={grade} score={score} size="md" />
          )}
        </button>

        {/* Category insight + signals (only when expanded and scored) */}
        {!isCollapsed && isScored && (categoryInsight || hasSignals) && (
          <div className="ml-7 mt-2 space-y-2">
            {categoryInsight && (
              <p className="text-sm text-muted-foreground leading-relaxed">{categoryInsight}</p>
            )}
            {hasSignals && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {strengths?.map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {s.label} {s.score}
                  </span>
                ))}
                {gaps?.map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {s.label} {s.score}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!isCollapsed && children}
    </div>
  );
}
