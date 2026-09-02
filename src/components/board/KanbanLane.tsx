"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ItemData } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { KanbanCard } from "./KanbanCard";

export function KanbanLane({
  laneId,
  label,
  color,
  items,
  userRole,
  currentUserId,
  personColumnIds,
}: {
  laneId: string;
  label: string;
  color: string;
  items: ItemData[];
  userRole: UserRole;
  currentUserId: string;
  personColumnIds: string[];
}) {
  const { setNodeRef } = useDroppable({ id: laneId, data: { type: "lane" } });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-neutral-100 dark:bg-neutral-800">
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {label}
        <span className="ml-auto text-xs opacity-80">{items.length}</span>
      </div>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="flex min-h-[60px] flex-col gap-2 p-2">
          {items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              userRole={userRole}
              currentUserId={currentUserId}
              personColumnIds={personColumnIds}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
