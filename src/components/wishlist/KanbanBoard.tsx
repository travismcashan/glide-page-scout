import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCardOverlay, type WishlistItem } from './KanbanCard';
import { toast } from 'sonner';

const STATUSES = ['wishlist', 'planned', 'in-progress', 'done'] as const;

type KanbanBoardProps = {
  items: WishlistItem[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onCardClick?: (item: WishlistItem) => void;
  deleting: string | null;
};

const WIP_LIMIT = 3;

export function KanbanBoard({ items, onStatusChange, onDelete, onCardClick, deleting }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragHeight, setDragHeight] = useState<number>(80);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const grouped = Object.fromEntries(
    STATUSES.map((s) => [s, items.filter((i) => i.status === s)])
  );

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    const el = document.getElementById(`card-${event.active.id}`);
    if (el) setDragHeight(el.getBoundingClientRect().height);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const newStatus = over.id as string;
    const currentStatus = (active.data.current as any)?.status;

    if (currentStatus !== newStatus && STATUSES.includes(newStatus as any)) {
      if (newStatus === 'in-progress') {
        const inProgressCount = items.filter((i) => i.status === 'in-progress').length;
        if (inProgressCount >= WIP_LIMIT) {
          toast.error(`WIP limit reached (${WIP_LIMIT})`, { description: 'Finish something in progress before starting new work.' });
          return;
        }
      }
      onStatusChange(itemId, newStatus);
    }
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={grouped[status]}
            onDelete={onDelete}
            onCardClick={onCardClick}
            deleting={deleting}
            activeId={activeId}
            dragHeight={dragHeight}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeItem ? (
          <KanbanCardOverlay item={activeItem} onDelete={onDelete} deleting={deleting} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
