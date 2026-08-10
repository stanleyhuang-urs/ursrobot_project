"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, Trash2 } from "lucide-react";
import type { GroupData, ColumnData, ItemData, UserOption } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { canManageStructure } from "@/lib/permissions";
import { ItemRow } from "./ItemRow";
import { gridTemplate } from "./gridTemplate";
import { renameGroup, deleteGroup } from "@/lib/actions/group";
import { createItem } from "@/lib/actions/item";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";

export function GroupSection({
  boardId,
  group,
  items,
  columns,
  users,
  progressColumnId,
  userRole,
  currentUserId,
  visibleIds,
}: {
  boardId: string;
  group: GroupData;
  items: ItemData[];
  columns: ColumnData[];
  users: UserOption[];
  progressColumnId: string | null;
  userRole: UserRole;
  currentUserId: string;
  visibleIds: Set<string> | null;
}) {
  const canEditStructure = canManageStructure(userRole);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id, disabled: !canEditStructure });
  const [collapsed, setCollapsed] = useState(false);
  const [name, setName] = useState(group.name);
  const [newItemName, setNewItemName] = useState("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  function saveName() {
    if (name.trim() && name !== group.name) {
      renameGroup(boardId, group.id, name.trim());
    } else {
      setName(group.name);
    }
  }

  async function handleAddItem() {
    if (!newItemName.trim()) return;
    await createItem(boardId, group.id, newItemName.trim());
    setNewItemName("");
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-neutral-200 bg-white"
    >
      <div
        className="flex items-center gap-2 border-b border-neutral-100 px-2 py-2"
        style={{ borderLeft: `4px solid ${group.color}` }}
      >
        {canEditStructure && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-neutral-300 hover:text-neutral-500"
          >
            <GripVertical size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-neutral-500"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
          readOnly={!canEditStructure}
          className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-sm font-semibold text-neutral-800 outline-none hover:bg-neutral-100 focus:bg-white focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-xs text-neutral-400">
          {visibleIds === null
            ? items.length
            : `${items.filter((i) => visibleIds.has(i.id)).length} / ${items.length}`}{" "}
          項目
        </span>
        {canEditStructure && (
          <RowMenu>
            <RowMenuItem danger onSelect={() => deleteGroup(boardId, group.id)}>
              <span className="flex items-center gap-2">
                <Trash2 size={14} /> 刪除分組
              </span>
            </RowMenuItem>
          </RowMenu>
        )}
      </div>

      {!collapsed && (
        <div>
          {items
            .filter((item) => item.parentId === null)
            .filter((item) => visibleIds === null || visibleIds.has(item.id))
            .sort((a, b) => a.order - b.order)
            .map((item) => (
              <ItemRow
                key={item.id}
                boardId={boardId}
                groupId={group.id}
                item={item}
                allGroupItems={items}
                columns={columns}
                users={users}
                progressColumnId={progressColumnId}
                userRole={userRole}
                currentUserId={currentUserId}
                visibleIds={visibleIds}
              />
            ))}
          {canEditStructure && (
            <div
              className="grid w-fit items-center py-1.5"
              style={{ gridTemplateColumns: gridTemplate(columns.length) }}
            >
              <div className="sticky left-0 z-10 bg-white" />
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                onBlur={handleAddItem}
                placeholder="+ 新增項目"
                className="sticky left-8 z-10 rounded bg-white px-2 py-1 text-sm text-neutral-500 outline-none hover:bg-neutral-50 focus:bg-white focus:text-neutral-900 focus:ring-1 focus:ring-blue-400"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
