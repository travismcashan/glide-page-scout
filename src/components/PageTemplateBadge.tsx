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

type TypeOption = { template: PageTemplateType; variant?: PageTemplateVariant; label: string };

const TYPE_OPTIONS: TypeOption[] = [
  { template: 'custom', label: 'Custom Page' },
  { template: 'template', variant: 'list', label: 'Template — List' },
  { template: 'template', variant: 'detail', label: 'Template — Detail' },
  { template: 'toolkit', label: 'Toolkit Page' },
];

interface Props {
  tag?: PageTag;
  onChange?: (template: PageTemplateType, variant?: PageTemplateVariant) => void;
  onLabelChange?: (label: string) => void;
  readOnly?: boolean;
}

export function PageTemplateBadge({ tag, onChange, onLabelChange, readOnly }: Props) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const typeRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!typeOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [typeOpen]);

  useEffect(() => {
    if (editingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [editingLabel]);

  if (!tag) return null;

  const style = templateStyles[tag.template];
  const typeLabel = templateLabels[tag.template];
  const interactive = !readOnly && onChange;
  const labelEditable = !readOnly && onLabelChange;

  const templateName = tag.label || tag.contentType || (tag.variant ? variantLabel[tag.variant] : null);

  const commitLabel = () => {
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== (tag.label || '')) {
      onLabelChange?.(trimmed);
    }
    setEditingLabel(false);
  };

  return (
    <div className="shrink-0 flex items-center gap-1">
      {/* Type badge (clickable dropdown) */}
      <div ref={typeRef} className="relative">
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 ${style} ${interactive ? 'cursor-pointer' : ''}`}
          onClick={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            setTypeOpen(!typeOpen);
          }}
        >
          {typeLabel}{tag.variant ? ` · ${variantLabel[tag.variant]}` : ''}
        </Badge>
        {typeOpen && interactive && (
          <div className="absolute z-50 top-full mt-1 left-0 bg-popover border border-border rounded-md shadow-md py-1 min-w-[160px]">
            {TYPE_OPTIONS.map((opt) => {
              const isActive = tag.template === opt.template && tag.variant === opt.variant;
              return (
                <button
                  key={opt.label}
                  className={`w-full text-left text-xs px-3 py-1.5 hover:bg-muted transition-colors ${isActive ? 'font-semibold text-primary' : 'text-foreground'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.template, opt.variant);
                    setTypeOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Template name badge (clickable inline edit) */}
      {editingLabel ? (
        <input
          ref={labelInputRef}
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitLabel();
            if (e.key === 'Escape') setEditingLabel(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] px-1.5 py-0 h-[18px] w-[100px] rounded-full border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
        />
      ) : templateName ? (
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 bg-muted/50 text-muted-foreground border-border ${labelEditable ? 'cursor-pointer hover:bg-muted' : ''}`}
          onClick={(e) => {
            if (!labelEditable) return;
            e.stopPropagation();
            setLabelDraft(tag.label || tag.contentType || '');
            setEditingLabel(true);
          }}
        >
          {templateName}
        </Badge>
      ) : labelEditable ? (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 bg-muted/50 text-muted-foreground/50 border-dashed border-border cursor-pointer hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            setLabelDraft('');
            setEditingLabel(true);
          }}
        >
          + label
        </Badge>
      ) : null}
    </div>
  );
}
