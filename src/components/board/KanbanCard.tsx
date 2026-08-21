"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ItemData } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { canManageStructure } from "@/lib/permissions";
import { isItemAssignedToUser } from "@/lib/itemAssignment";

export function KanbanCard({
  item,
  userRole,
  currentUserId,
  personColumnIds,
}: {
  item: ItemData;
  userRole: UserRole;
  currentUserId: string;
  personColumnIds: string[];
}) {
  const canDrag = canManageStructure(userRole) || isItemAssignedToUser(item, personColumnIds, currentUserId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, data: { type: "card" }, disabled: !canDrag });

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
      title={canDrag ? undefined : "只能移動自己被指派或負責的項目"}
      className={`rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm hover:border-neutral-300 ${
        canDrag ? "cursor-grab" : "cursor-default"
      }`}
    >
      {item.name}
    </div>
  );
}
