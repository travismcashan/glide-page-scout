import { useDroppable } from '@dnd-kit/core';
import { KanbanCard, type WishlistItem } from './KanbanCard';

const STATUS_CONFIG: Record<string, { label: string; bg: string; accent: string }> = {
  wishlist: { label: 'Wishlist', bg: 'bg-muted/30', accent: 'bg-muted-foreground/30' },
  planned: { label: 'Planned', bg: 'bg-blue-500/[0.03]', accent: 'bg-blue-500/50' },
  'in-progress': { label: 'In Progress', bg: 'bg-amber-500/[0.03]', accent: 'bg-amber-500/50' },
  done: { label: 'Done', bg: 'bg-green-600/[0.03]', accent: 'bg-green-600/50' },
};

type KanbanColumnProps = {
  status: string;
  items: WishlistItem[];
  onDelete: (id: string) => void;
  onCardClick?: (item: WishlistItem) => void;
  deleting: string | null;
  activeId: string | null;
};

export function KanbanColumn({ status, items, onDelete, onCardClick, deleting, activeId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.wishlist;
  const isWip = status === 'in-progress' && items.length > 3;
  const isDragging = activeId !== null;
  const isDraggingFromHere = isDragging && items.some((i) => i.id === activeId);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-xl transition-colors duration-200
        ${config.bg}
        ${isOver ? 'ring-2 ring-primary/30 bg-primary/[0.04]' : ''}
      `}
    >
      {/* Sticky column header */}
      <div className="flex items-center gap-2.5 px-3 pt-3.5 pb-3 sticky top-0 z-10 rounded-t-xl backdrop-blur-sm">
        <div className={`h-2.5 w-2.5 rounded-full ${config.accent}`} />
        <h3 className="text-base font-bold text-foreground">
          {config.label}
        </h3>
        <span className={`
          text-base font-bold ml-auto
          ${isWip
            ? 'text-amber-600'
            : 'text-muted-foreground/40'
          }
        `}>
          {items.length}
          {isWip && <span className="text-sm font-medium text-amber-500">/3</span>}
        </span>
      </div>

      {/* Scrollable cards area */}
      <div className="flex-1 px-2 pb-2 space-y-2.5 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
        {items.map((item) => (
          <KanbanCard key={item.id} item={item} onDelete={onDelete} onCardClick={onCardClick} deleting={deleting} />
        ))}

        {/* Drop placeholder — shows when dragging over this column from another column */}
        {isOver && !isDraggingFromHere && (
          <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/[0.02] p-4 min-h-[80px] transition-all duration-200" />
        )}

        {/* Empty state — only when column is truly empty and not dragging */}
        {items.length === 0 && !isOver && (
          <div className={`
            rounded-xl border-2 border-dashed min-h-[80px]
            transition-colors duration-200
            ${isDragging
              ? 'border-border/50'
              : 'border-border/20'
            }
          `} />
        )}
      </div>
    </div>
  );
}
