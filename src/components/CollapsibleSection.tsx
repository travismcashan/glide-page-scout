import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Props = {
  title: string;
  children: React.ReactNode;
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  className?: string;
};

export function CollapsibleSection({ title, children, collapsed: controlledCollapsed, onToggle, className }: Props) {
  const [internal, setInternal] = useState(false);
  const isCollapsed = controlledCollapsed ?? internal;

  const toggle = () => {
    const next = !isCollapsed;
    if (onToggle) onToggle(next);
    else setInternal(next);
  };

  return (
    <div className={className}>
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left group mt-16 mb-6 first:mt-0"
        onClick={toggle}
      >
        {isCollapsed
          ? <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          : <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        }
        <h2 className="text-4xl font-light tracking-tight text-foreground group-hover:text-foreground/80 transition-colors">
          {title}
        </h2>
      </button>
      {!isCollapsed && children}
    </div>
  );
}
