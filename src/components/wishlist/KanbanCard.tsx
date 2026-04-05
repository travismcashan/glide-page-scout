import { useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Sparkles, Bug, Lightbulb, FileText, Trash2, Loader2, Paperclip, MessageCircle, Copy, Check } from 'lucide-react';

export type WishlistItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  effort_estimate: string | null;
  created_at: string;
  submitted_by: string | null;
  page_url: string | null;
  element_selector: string | null;
  source: string | null;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
  attachment_count?: number;
  comment_count?: number;
  cover_image_url?: string | null;
  plan_content?: { research: string; steps: { text: string; done: boolean }[]; affected_files: string[]; dependencies: string[] } | null;
};

const CATEGORY_TAG: Record<string, { label: string; icon: typeof Sparkles; bg: string; text: string }> = {
  feature: { label: 'Feature', icon: Sparkles, bg: 'bg-primary/10', text: 'text-primary' },
  bug: { label: 'Bug', icon: Bug, bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
  idea: { label: 'Idea', icon: Lightbulb, bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
  plan: { label: 'Plan', icon: FileText, bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' },
};

const EFFORT_TAG: Record<string, { label: string; bg: string; text: string }> = {
  small: { label: 'Small', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' },
  medium: { label: 'Medium', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
  large: { label: 'Large', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
};

const PRIORITY_INDICATOR: Record<string, string> = {
  high: 'text-red-500',
  medium: 'text-amber-500',
  low: 'text-green-500',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ageColor(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days > 30) return 'text-destructive';
  if (days > 14) return 'text-amber-500';
  return 'text-muted-foreground';
}

type KanbanCardProps = {
  item: WishlistItem;
  onDelete: (id: string) => void;
  onCardClick?: (item: WishlistItem) => void;
  deleting: string | null;
  overlay?: boolean;
};

export function KanbanCard({ item, onDelete, onCardClick, deleting, overlay }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { status: item.status },
  });

  const cat = CATEGORY_TAG[item.category] || CATEGORY_TAG.feature;
  const CatIcon = cat.icon;
  const effort = item.effort_estimate ? EFFORT_TAG[item.effort_estimate] : null;
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const style = overlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
      };

  return (
    <div
      id={overlay ? undefined : `card-${item.id}`}
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : { ...listeners, ...attributes })}
      onMouseDown={(e) => { pointerStart.current = { x: e.clientX, y: e.clientY }; }}
      onMouseUp={(e) => {
        if (!pointerStart.current || !onCardClick) return;
        const dx = Math.abs(e.clientX - pointerStart.current.x);
        const dy = Math.abs(e.clientY - pointerStart.current.y);
        if (dx < 5 && dy < 5) onCardClick(item);
        pointerStart.current = null;
      }}
      className={`
        group relative rounded-xl bg-card border border-border/50
        p-4 cursor-grab active:cursor-grabbing
        hover:shadow-md hover:border-border
        transition-all duration-150
        ${overlay ? 'shadow-xl ring-1 ring-black/5 rotate-[1deg] scale-[1.03]' : 'shadow-sm'}
        ${isDragging ? 'z-50' : ''}
      `}
    >
      {/* Title */}
      <h4 className="text-[15px] font-semibold leading-snug text-foreground pr-8">
        {item.title}
      </h4>

      {/* Floating action icons — absolute so they don't affect layout */}
      <div
        className="absolute top-3 right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="p-1.5 rounded-md bg-card/90 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shadow-sm"
          title="Copy prompt"
          onClick={(e) => {
            e.stopPropagation();
            const prompt = [
              `Implement the following wishlist item:`,
              ``,
              `**${item.title}**`,
              item.description || null,
              ``,
              `Category: ${item.category} | Priority: ${item.priority} | Effort: ${item.effort_estimate || 'unknown'}`,
              `Status: ${item.status}`,
              ``,
              `First, move this card to "in-progress" on the Kanban board. When complete, move it to "done".`,
            ].filter(Boolean).join('\n');
            navigator.clipboard.writeText(prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </button>
        <button
          className="p-1.5 rounded-md bg-card/90 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shadow-sm"
          title="Delete item"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${item.title.slice(0, 60)}"?`)) {
              onDelete(item.id);
            }
          }}
          disabled={deleting === item.id}
        >
          {deleting === item.id
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Trash2 className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Cover image — shown for large effort items with a generated image */}
      {item.cover_image_url && item.effort_estimate === 'large' && (
        <div className="mt-2.5 -mx-1 rounded-lg overflow-hidden">
          <img
            src={item.cover_image_url}
            alt=""
            className="w-full h-28 object-cover rounded-lg"
          />
        </div>
      )}

      {/* Description — hidden for small effort items to keep cards compact */}
      {item.description && item.effort_estimate !== 'small' && (
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
          {item.description}
        </p>
      )}

      {/* Tags */}
      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cat.bg} ${cat.text}`}>
          <CatIcon className="h-3 w-3" />
          {cat.label}
        </span>
        {effort && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${effort.bg} ${effort.text}`}>
            {effort.label}
          </span>
        )}
        {item.source === 'claude' && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
            AI
          </span>
        )}
      </div>

      {/* Footer: avatar + date */}
      <div className="flex items-center gap-2 mt-3">
        {item.profiles?.display_name ? (
          item.profiles.avatar_url ? (
            <img
              src={item.profiles.avatar_url}
              alt={item.profiles.display_name}
              title={item.profiles.display_name}
              className="h-6 w-6 rounded-full ring-2 ring-card"
            />
          ) : (
            <span
              className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground ring-2 ring-card"
              title={item.profiles.display_name}
            >
              {item.profiles.display_name.charAt(0).toUpperCase()}
            </span>
          )
        ) : (
          <span className="h-6 w-6 rounded-full bg-muted ring-2 ring-card" />
        )}
        <div className="flex items-center gap-3 ml-auto">
          {(item.attachment_count ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              {item.attachment_count}
            </span>
          )}
          {(item.comment_count ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              {item.comment_count}
            </span>
          )}
          <span className={`text-xs ${ageColor(item.created_at)}`}>
            {formatDate(item.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function KanbanCardOverlay({ item, onDelete, deleting }: Omit<KanbanCardProps, 'overlay'>) {
  return <KanbanCard item={item} onDelete={onDelete} deleting={deleting} overlay />;
}
