import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import type { PageTag, PageTemplateType, PageTemplateVariant } from '@/lib/pageTags';

const templateStyles: Record<PageTemplateType, string> = {
  custom: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20',
  template: 'bg-sky-500/10 text-sky-600 border-sky-500/30 hover:bg-sky-500/20',
  toolkit: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30 hover:bg-zinc-500/20',
};

const templateLabels: Record<PageTemplateType, string> = {
  custom: 'Custom',
  template: 'Template',
  toolkit: 'Toolkit',
};

const variantLabel: Record<PageTemplateVariant, string> = {
  list: 'List',
  detail: 'Detail',
};

type Option = { template: PageTemplateType; variant?: PageTemplateVariant; label: string };

const OPTIONS: Option[] = [
  { template: 'custom', label: 'Custom Page' },
  { template: 'template', variant: 'list', label: 'Template — List' },
  { template: 'template', variant: 'detail', label: 'Template — Detail' },
  { template: 'toolkit', label: 'Toolkit Page' },
];

interface Props {
  tag?: PageTag;
  onChange?: (template: PageTemplateType, variant?: PageTemplateVariant) => void;
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

  const style = templateStyles[tag.template];
  const label = templateLabels[tag.template];
  const variant = tag.variant ? variantLabel[tag.variant] : null;
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
        {label}{variant ? ` · ${variant}` : ''}
      </Badge>
      {open && interactive && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-popover border border-border rounded-md shadow-md py-1 min-w-[160px]">
          {OPTIONS.map((opt) => {
            const isActive = tag.template === opt.template && tag.variant === opt.variant;
            return (
              <button
                key={opt.label}
                className={`w-full text-left text-xs px-3 py-1.5 hover:bg-muted transition-colors ${isActive ? 'font-semibold text-primary' : 'text-foreground'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.template, opt.variant);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
