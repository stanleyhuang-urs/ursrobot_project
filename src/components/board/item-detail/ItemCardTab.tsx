"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@prisma/client";
import { Avatar } from "@/components/ui/Avatar";
import { getStatusOptions } from "@/types/column";
import { listTodoItems } from "@/lib/actions/todo";
import { canEditCellValue } from "@/lib/permissions";
import { isItemAssignedToUser } from "@/lib/itemAssignment";
import { StatusCell } from "../cell-editors/StatusCell";
import { NumberCell } from "../cell-editors/NumberCell";
import type { ColumnData, ItemData, UserOption } from "@/types/board";

export function ItemCardTab({
  boardId,
  item,
  columns,
  users,
  progressColumnId,
  userRole,
  currentUserId,
}: {
  boardId: string;
  item: ItemData;
  columns: ColumnData[];
  users: UserOption[];
  progressColumnId: string | null;
  userRole: UserRole;
  currentUserId: string;
}) {
  const [todoStats, setTodoStats] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todos = await listTodoItems(item.id);
      if (!cancelled) setTodoStats({ done: todos.filter((t) => t.done).length, total: todos.length });
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const valuesByColumn = new Map(item.cellValues.map((cv) => [cv.columnId, cv.value]));
  const usersById = new Map(users.map((u) => [u.id, u]));
  const personColumnIds = columns.filter((c) => c.type === "PERSON").map((c) => c.id);
  const isAssignedToUser = isItemAssignedToUser(item, personColumnIds, currentUserId);

  function renderValue(column: ColumnData) {
    const value = valuesByColumn.get(column.id) ?? null;
    const isProgressColumn = column.id === progressColumnId;

    if (column.type === "STATUS") {
      if (canEditCellValue(userRole, "STATUS", false, isAssignedToUser)) {
        return (
          <StatusCell
            boardId={boardId}
            itemId={item.id}
            columnId={column.id}
            value={typeof value === "string" ? value : null}
            options={column.options}
          />
        );
      }
      if (value === null || value === undefined || value === "") {
        return <span className="text-neutral-300">—</span>;
      }
      const options = getStatusOptions(column.options);
      const option = options.find((o) => o.id === value);
      if (!option) return <span className="text-neutral-300">—</span>;
      return (
        <span
          className="rounded-full px-2 py-0.5 text-xs text-white"
          style={{ backgroundColor: option.color }}
        >
          {option.label}
        </span>
      );
    }
    if (isProgressColumn && column.type === "NUMBER" && canEditCellValue(userRole, "NUMBER", true, isAssignedToUser)) {
      return (
        <NumberCell
          boardId={boardId}
          itemId={item.id}
          columnId={column.id}
          value={typeof value === "number" ? value : null}
          percent
        />
      );
    }
    if (value === null || value === undefined || value === "") {
      return <span className="text-neutral-300">—</span>;
    }
    if (column.type === "PERSON") {
      const user = usersById.get(String(value));
      if (!user) return <span className="text-neutral-300">未指派</span>;
      return (
        <span className="flex items-center gap-2">
          <Avatar name={user.name} avatarUrl={user.avatarUrl} size={20} />
          {user.name}
        </span>
      );
    }
    if (column.type === "NUMBER" && typeof value === "number") {
      return <span>{isProgressColumn ? `${Math.round(value * 100)}%` : Math.round(value * 100) / 100}</span>;
    }
    return <span>{String(value)}</span>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200">
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-400">項目名稱</p>
        <p className="text-sm font-medium text-neutral-900">{item.name}</p>
      </div>
      {columns.map((col) => (
        <div
          key={col.id}
          className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 last:border-b-0"
        >
          <span className="text-xs text-neutral-400">{col.name}</span>
          <span className="w-40 text-sm text-neutral-800">{renderValue(col)}</span>
        </div>
      ))}
      {todoStats && (
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-xs text-neutral-400">待辦事項</span>
          <span className="text-sm text-neutral-800">
            {todoStats.done} / {todoStats.total} 已完成
          </span>
        </div>
      )}
    </div>
  );
}
