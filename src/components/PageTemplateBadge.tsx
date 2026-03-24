import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { getTemplateCategory, getTemplateCategoryFromBaseType, getTemplateOptions, addCustomTemplate, type PageTag, type TemplateCategory, type BaseType } from '@/lib/pageTags';

const categoryStyles: Record<TemplateCategory, string> = {
  custom: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20',
  template: 'bg-sky-500/10 text-sky-600 border-sky-500/30 hover:bg-sky-500/20',
  toolkit: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30 hover:bg-zinc-500/20',
};

const baseTypeStyles: Record<BaseType, string> = {
  Page: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Post: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CPT: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Archive: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

const categoryLabels: Record<TemplateCategory, string> = {
  custom: 'Custom Page',
  template: 'Template Page',
  toolkit: 'Toolkit Page',
};

interface Props {
  tag?: PageTag;
  onChange?: (template: string) => void;
  readOnly?: boolean;
  hideBaseType?: boolean;
}

export function PageTemplateBadge({ tag, onChange, readOnly, hideBaseType }: Props) {
  const [open, setOpen] = useState(false);
  const [addingCategory, setAddingCategory] = useState<TemplateCategory | null>(null);
  const [customName, setCustomName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAddingCategory(null);
        setCustomName('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (addingCategory && inputRef.current) {
      inputRef.current.focus();
    }
  }, [addingCategory]);

  if (!tag) return null;

  const baseType = tag.baseType;
  const category = baseType ? getTemplateCategoryFromBaseType(baseType) : getTemplateCategory(tag.template);
  const style = baseType ? (baseTypeStyles[baseType] || categoryStyles[category]) : categoryStyles[category];
  const interactive = !readOnly && onChange;

  const handleAddCustom = (cat: TemplateCategory) => {
    setAddingCategory(cat);
    setCustomName('');
  };

  const submitCustomName = () => {
    const trimmed = customName.trim();
    if (trimmed && onChange && addingCategory) {
      addCustomTemplate(trimmed, addingCategory);
      onChange(trimmed);
      setOpen(false);
      setAddingCategory(null);
      setCustomName('');
    }
  };

  return (
    <div ref={ref} className="relative shrink-0 flex items-center gap-1">
      {/* Base Type badge (Level 1) */}
      {!hideBaseType && baseType && (
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 ${baseTypeStyles[baseType]} cursor-default`}
        >
          {baseType}
        </Badge>
      )}
      {/* Template badge (Level 2) */}
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 ${style} ${interactive ? 'cursor-pointer' : ''}`}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setOpen(!open);
          if (open) {
            setAddingCategory(null);
            setCustomName('');
          }
        }}
      >
        {tag.template}
      </Badge>

      {open && interactive && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-popover border border-border rounded-md shadow-md py-1 min-w-[200px] max-h-[360px] overflow-y-auto">
          {getTemplateOptions().map((group) => (
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
                      setAddingCategory(null);
                    }}
                  >
                    {tmpl}
                  </button>
                );
              })}

              {addingCategory === group.category ? (
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitCustomName();
                      if (e.key === 'Escape') {
                        setAddingCategory(null);
                        setCustomName('');
                      }
                    }}
                    placeholder={`New ${categoryLabels[group.category]}…`}
                    className="flex-1 text-xs border border-input rounded px-2 py-1 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    disabled={!customName.trim()}
                    onClick={(e) => {
                      e.stopPropagation();
                      submitCustomName();
                    }}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted transition-colors text-muted-foreground flex items-center gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddCustom(group.category);
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Add {categoryLabels[group.category]}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
