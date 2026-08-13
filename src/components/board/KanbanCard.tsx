"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ItemData } from "@/types/board";

export function KanbanCard({ item }: { item: ItemData }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, data: { type: "card" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-kanban-card
      className="cursor-grab rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm hover:border-neutral-300"
    >
      {item.name}
    </div>
  );
}
