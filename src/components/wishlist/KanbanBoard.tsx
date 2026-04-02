import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCardOverlay, type WishlistItem } from './KanbanCard';

const STATUSES = ['wishlist', 'planned', 'in-progress', 'done'] as const;

type KanbanBoardProps = {
  items: WishlistItem[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onCardClick?: (item: WishlistItem) => void;
  deleting: string | null;
};

export function KanbanBoard({ items, onStatusChange, onDelete, onCardClick, deleting }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const grouped = Object.fromEntries(
    STATUSES.map((s) => [s, items.filter((i) => i.status === s)])
  );

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const newStatus = over.id as string;
    const currentStatus = (active.data.current as any)?.status;

    if (currentStatus !== newStatus && STATUSES.includes(newStatus as any)) {
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
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <KanbanCardOverlay item={activeItem} onDelete={onDelete} deleting={deleting} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
