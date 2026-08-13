"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { getStatusOptions } from "@/types/column";
import { listTodoItems } from "@/lib/actions/todo";
import type { ColumnData, ItemData, UserOption } from "@/types/board";

export function ItemCardTab({
  item,
  columns,
  users,
}: {
  item: ItemData;
  columns: ColumnData[];
  users: UserOption[];
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

  function renderValue(column: ColumnData) {
    const value = valuesByColumn.get(column.id) ?? null;
    if (value === null || value === undefined || value === "") {
      return <span className="text-neutral-300">—</span>;
    }
    if (column.type === "STATUS") {
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
      return <span>{Math.round(value * 100) / 100}</span>;
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
          <span className="text-sm text-neutral-800">{renderValue(col)}</span>
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
