"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@prisma/client";
import { listTodoItems } from "@/lib/actions/todo";
import { renameItem } from "@/lib/actions/item";
import { canEditCellValue, canManageStructure, canModifyItemSchedule } from "@/lib/permissions";
import { isItemAssignedToUser } from "@/lib/itemAssignment";
import type { ScheduleLock } from "@/lib/predecessorLink";
import { CellEditor } from "../cell-editors/CellEditor";
import type { ColumnData, ItemData, UserOption } from "@/types/board";

export function ItemCardTab({
  boardId,
  item,
  columns,
  users,
  progressColumnId,
  ganttStartColumnId,
  ganttDurationColumnId,
  ganttEndColumnId,
  lockedScheduleFields,
  userRole,
  currentUserId,
}: {
  boardId: string;
  item: ItemData;
  columns: ColumnData[];
  users: UserOption[];
  progressColumnId: string | null;
  ganttStartColumnId: string | null;
  ganttDurationColumnId: string | null;
  ganttEndColumnId: string | null;
  lockedScheduleFields?: Map<string, ScheduleLock>;
  userRole: UserRole;
  currentUserId: string;
}) {
  const [todoStats, setTodoStats] = useState<{ done: number; total: number } | null>(null);
  const [name, setName] = useState(item.name);
  // Resync the local draft when a different item's name arrives (switching
  // items, or another user's rename) — adjusted during render, not an
  // effect, so it doesn't fight the field while the user is mid-edit.
  const [prevItemName, setPrevItemName] = useState({ id: item.id, name: item.name });
  if (prevItemName.id !== item.id || prevItemName.name !== item.name) {
    setPrevItemName({ id: item.id, name: item.name });
    setName(item.name);
  }

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

  const valuesByColumn = new Map(
    item.cellValues.map((cv) => [cv.columnId, cv.value as string | number | null])
  );
  const canEditStructure = canManageStructure(userRole);
  const canModifySchedule = canModifyItemSchedule(userRole, item.createdById, currentUserId);
  const personColumnIds = columns.filter((c) => c.type === "PERSON").map((c) => c.id);
  const isAssignedToUser = isItemAssignedToUser(item, personColumnIds, currentUserId);
  const lock = lockedScheduleFields?.get(item.id);

  function saveName() {
    if (name.trim() && name !== item.name) {
      renameItem(boardId, item.id, name.trim());
    } else {
      setName(item.name);
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200">
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="mb-1 text-xs text-neutral-400">項目名稱</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
          readOnly={!canEditStructure}
          className="w-full rounded px-1 py-0.5 text-sm font-medium text-neutral-900 outline-none hover:bg-neutral-100 focus:bg-white focus:ring-1 focus:ring-blue-400"
        />
      </div>
      {columns.map((col) => {
        const isScheduleColumn =
          col.id === ganttStartColumnId || col.id === ganttDurationColumnId || col.id === ganttEndColumnId;
        const isLockedField =
          (col.id === ganttStartColumnId && lock?.startLocked) ||
          (col.id === ganttEndColumnId && lock?.endLocked) ||
          (col.id === ganttDurationColumnId && lock?.daysLocked);
        const canEdit =
          canEditCellValue(userRole, col.type, col.id === progressColumnId, isAssignedToUser) &&
          (!isScheduleColumn || canModifySchedule) &&
          !isLockedField;
        const scheduleBlockedReason =
          isScheduleColumn && !canEdit
            ? !canModifySchedule
              ? "權限不足:僅建立者或管理者可以修改此項目的時程"
              : isLockedField
                ? "此日期由前置依賴、子項目統計或里程碑規則自動計算,請改天數、前置依賴或子項目設定"
                : null
            : null;
        return (
          <div
            key={col.id}
            className={`flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 last:border-b-0 ${
              scheduleBlockedReason ? "cursor-not-allowed" : ""
            }`}
            title={isLockedField ? "由前置依賴或子項目統計自動計算" : undefined}
            onClick={scheduleBlockedReason ? () => alert(scheduleBlockedReason) : undefined}
          >
            <span className="text-xs text-neutral-400">{col.name}</span>
            <span className="w-40 text-sm text-neutral-800">
              <CellEditor
                boardId={boardId}
                itemId={item.id}
                column={col}
                value={valuesByColumn.get(col.id) ?? null}
                users={users}
                canEdit={canEdit}
                isProgressColumn={col.id === progressColumnId}
              />
            </span>
          </div>
        );
      })}
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
