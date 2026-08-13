"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Target, Trash2 } from "lucide-react";
import type { BoardWithData, ColumnData, ItemData, UserOption } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { canManageStructure } from "@/lib/permissions";
import { computeVisibleItemIds, type ActiveFilter } from "@/lib/filter";
import { computeAncestorIds } from "@/lib/wbs";
import { GroupSection } from "./GroupSection";
import { FilterBar } from "./FilterBar";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";
import {
  gridTemplate,
  DEFAULT_NAME_COLUMN_WIDTH,
  MIN_NAME_COLUMN_WIDTH,
  MAX_NAME_COLUMN_WIDTH,
  AUTO_FIT_MAX_NAME_COLUMN_WIDTH,
} from "./gridTemplate";
import { createGroup, reorderGroups } from "@/lib/actions/group";
import { deleteColumn, setProgressColumn, reorderColumns } from "@/lib/actions/column";

const NAME_CELL_CHROME_WIDTH = 132; // input padding + 留言/指派/更多操作 icons + gaps + measurement margin

function SortableColumnHeader({
  col,
  canEditStructure,
  isProgressColumn,
  onSetProgressColumn,
  onDelete,
}: {
  col: ColumnData;
  canEditStructure: boolean;
  isProgressColumn: boolean;
  onSetProgressColumn: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
    disabled: !canEditStructure,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between px-1">
      <span className="flex min-w-0 items-center gap-1">
        {canEditStructure && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab text-neutral-300 hover:text-neutral-500"
          >
            <GripVertical size={12} />
          </button>
        )}
        <span className="truncate">{col.name}</span>
      </span>
      {canEditStructure && (
        <RowMenu>
          {col.type === "NUMBER" && (
            <RowMenuItem onSelect={onSetProgressColumn}>
              <span className="flex items-center gap-2">
                <Target size={14} />
                {isProgressColumn ? "取消進度欄位" : "設為進度欄位"}
              </span>
            </RowMenuItem>
          )}
          <RowMenuItem danger onSelect={onDelete}>
            <span className="flex items-center gap-2">
              <Trash2 size={14} /> 刪除欄位
            </span>
          </RowMenuItem>
        </RowMenu>
      )}
    </div>
  );
}

export function BoardTable({
  board,
  users,
  userRole,
  currentUserId,
  onAddColumn,
  highlightItemId,
}: {
  board: BoardWithData;
  users: UserOption[];
  userRole: UserRole;
  currentUserId: string;
  onAddColumn: () => void;
  highlightItemId?: string | null;
}) {
  const canEditStructure = canManageStructure(userRole);
  const [groupOrder, setGroupOrder] = useState(board.groups.map((g) => g.id));
  const [columnOrder, setColumnOrder] = useState(board.columns.map((c) => c.id));
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [nameWidth, setNameWidth] = useState(DEFAULT_NAME_COLUMN_WIDTH);
  const hasAutoSizedRef = useRef(false);
  const visibleIds = useMemo(
    () => computeVisibleItemIds(board.items, filters),
    [board.items, filters]
  );
  const expandIds = useMemo(
    () => computeAncestorIds(board.items, highlightItemId),
    [board.items, highlightItemId]
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const groupsById = new Map(board.groups.map((g) => [g.id, g]));
  const columnsById = new Map(board.columns.map((c) => [c.id, c]));
  const orderedColumns = columnOrder
    .map((id) => columnsById.get(id))
    .filter((c): c is ColumnData => c !== undefined);
  const itemsByGroup = new Map<string, ItemData[]>();
  for (const item of board.items) {
    const list = itemsByGroup.get(item.groupId) ?? [];
    list.push(item);
    itemsByGroup.set(item.groupId, list);
  }

  useEffect(() => {
    if (hasAutoSizedRef.current) return;
    const timer = setTimeout(() => {
      if (hasAutoSizedRef.current) return;
      hasAutoSizedRef.current = true;
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return;
      ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const itemsById = new Map(board.items.map((i) => [i.id, i]));
      let maxWidth = 0;
      for (const item of board.items) {
        let depth = 0;
        let current = item;
        while (current.parentId) {
          const parent = itemsById.get(current.parentId);
          if (!parent) break;
          depth++;
          current = parent;
        }
        const width = ctx.measureText(item.name).width + depth * 20 + NAME_CELL_CHROME_WIDTH;
        if (width > maxWidth) maxWidth = width;
      }
      if (maxWidth > 0) {
        setNameWidth(
          Math.min(AUTO_FIT_MAX_NAME_COLUMN_WIDTH, Math.max(DEFAULT_NAME_COLUMN_WIDTH, Math.ceil(maxWidth)))
        );
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [board.items]);

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

  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((ids) => {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      const next = arrayMove(ids, oldIndex, newIndex);
      reorderColumns(board.id, next);
      return next;
    });
  }

  async function handleAddGroup() {
    await createGroup(board.id, "新分組");
  }

  function startNameColumnResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = nameWidth;
    function onMove(ev: PointerEvent) {
      const next = startWidth + (ev.clientX - startX);
      setNameWidth(Math.min(MAX_NAME_COLUMN_WIDTH, Math.max(MIN_NAME_COLUMN_WIDTH, next)));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div>
      <FilterBar columns={orderedColumns} users={users} filters={filters} onChange={setFilters} />

      <DndContext
        id="board-columns-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleColumnDragEnd}
      >
        <div
          className="mb-2 grid w-fit items-center text-xs font-medium text-neutral-500"
          style={{ gridTemplateColumns: gridTemplate(orderedColumns.length, nameWidth) }}
        >
          <div className="sticky left-0 z-10 bg-neutral-50" />
          <div className="sticky left-8 z-10 relative bg-neutral-50 px-2">
            項目名稱
            <div
              onPointerDown={startNameColumnResize}
              className="absolute right-0 top-0 z-20 h-full w-1 cursor-col-resize hover:bg-blue-400"
            />
          </div>
          <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
            {orderedColumns.map((col) => (
              <SortableColumnHeader
                key={col.id}
                col={col}
                canEditStructure={canEditStructure}
                isProgressColumn={board.progressColumnId === col.id}
                onSetProgressColumn={() =>
                  setProgressColumn(board.id, board.progressColumnId === col.id ? null : col.id)
                }
                onDelete={() => deleteColumn(board.id, col.id)}
              />
            ))}
          </SortableContext>
          {canEditStructure && (
            <button
              type="button"
              onClick={onAddColumn}
              className="flex items-center justify-center text-neutral-400 hover:text-neutral-700"
              aria-label="新增欄位"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </DndContext>

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
                  columns={orderedColumns}
                  users={users}
                  progressColumnId={board.progressColumnId}
                  userRole={userRole}
                  currentUserId={currentUserId}
                  visibleIds={visibleIds}
                  nameWidth={nameWidth}
                  highlightItemId={highlightItemId}
                  expandIds={expandIds}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {canEditStructure && (
        <button
          type="button"
          onClick={handleAddGroup}
          className="mt-4 flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
        >
          <Plus size={14} /> 新增分組
        </button>
      )}
    </div>
  );
}
