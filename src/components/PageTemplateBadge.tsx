import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { getTemplateCategory, TEMPLATE_OPTIONS, type PageTag, type TemplateCategory } from '@/lib/pageTags';

const categoryStyles: Record<TemplateCategory, string> = {
  custom: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20',
  template: 'bg-sky-500/10 text-sky-600 border-sky-500/30 hover:bg-sky-500/20',
  toolkit: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30 hover:bg-zinc-500/20',
};

interface Props {
  tag?: PageTag;
  onChange?: (template: string) => void;
  readOnly?: boolean;
}

export function PageTemplateBadge({ tag, onChange, readOnly }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!tag) return null;

  const category = getTemplateCategory(tag.template);
  const style = categoryStyles[category];
  const interactive = !readOnly && onChange;

  return (
    <div ref={ref} className="relative shrink-0">
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 ${style} ${interactive ? 'cursor-pointer' : ''}`}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        {tag.template}
      </Badge>

      {open && interactive && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-popover border border-border rounded-md shadow-md py-1 min-w-[180px] max-h-[320px] overflow-y-auto">
          {TEMPLATE_OPTIONS.map((group) => (
            <div key={group.category}>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              {group.templates.map((tmpl) => {
                const isActive = tag.template === tmpl;
                return (
                  <button
                    key={tmpl}
                    className={`w-full text-left text-xs px-3 py-1.5 hover:bg-muted transition-colors ${isActive ? 'font-semibold text-primary' : 'text-foreground'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange!(tmpl);
                      setOpen(false);
                    }}
                  >
                    {tmpl}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
