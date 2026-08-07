"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Plus, Target, Trash2 } from "lucide-react";
import type { BoardWithData, ItemData, UserOption } from "@/types/board";
import { GroupSection } from "./GroupSection";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";
import { gridTemplate } from "./gridTemplate";
import { createGroup, reorderGroups } from "@/lib/actions/group";
import { deleteColumn, setProgressColumn } from "@/lib/actions/column";

export function BoardTable({
  board,
  users,
  onAddColumn,
}: {
  board: BoardWithData;
  users: UserOption[];
  onAddColumn: () => void;
}) {
  const [groupOrder, setGroupOrder] = useState(board.groups.map((g) => g.id));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const groupsById = new Map(board.groups.map((g) => [g.id, g]));
  const itemsByGroup = new Map<string, ItemData[]>();
  for (const item of board.items) {
    const list = itemsByGroup.get(item.groupId) ?? [];
    list.push(item);
    itemsByGroup.set(item.groupId, list);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGroupOrder((ids) => {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      const next = arrayMove(ids, oldIndex, newIndex);
      reorderGroups(board.id, next);
      return next;
    });
  }

  async function handleAddGroup() {
    await createGroup(board.id, "新分組");
  }

  return (
    <div>
      <div
        className="mb-2 grid items-center px-2 text-xs font-medium text-neutral-500"
        style={{ gridTemplateColumns: gridTemplate(board.columns.length) }}
      >
        <div />
        <div>項目名稱</div>
        {board.columns.map((col) => (
          <div key={col.id} className="flex items-center justify-between px-1">
            <span className="truncate">{col.name}</span>
            <RowMenu>
              {col.type === "NUMBER" && (
                <RowMenuItem
                  onSelect={() =>
                    setProgressColumn(
                      board.id,
                      board.progressColumnId === col.id ? null : col.id
                    )
                  }
                >
                  <span className="flex items-center gap-2">
                    <Target size={14} />
                    {board.progressColumnId === col.id
                      ? "取消進度欄位"
                      : "設為進度欄位"}
                  </span>
                </RowMenuItem>
              )}
              <RowMenuItem
                danger
                onSelect={() => deleteColumn(board.id, col.id)}
              >
                <span className="flex items-center gap-2">
                  <Trash2 size={14} /> 刪除欄位
                </span>
              </RowMenuItem>
            </RowMenu>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddColumn}
          className="flex items-center justify-center text-neutral-400 hover:text-neutral-700"
          aria-label="新增欄位"
        >
          <Plus size={16} />
        </button>
      </div>

      <DndContext
        id="board-groups-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={groupOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {groupOrder.map((groupId) => {
              const group = groupsById.get(groupId);
              if (!group) return null;
              return (
                <GroupSection
                  key={group.id}
                  boardId={board.id}
                  group={group}
                  items={itemsByGroup.get(group.id) ?? []}
                  columns={board.columns}
                  users={users}
                  progressColumnId={board.progressColumnId}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={handleAddGroup}
        className="mt-4 flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <Plus size={14} /> 新增分組
      </button>
    </div>
  );
}
