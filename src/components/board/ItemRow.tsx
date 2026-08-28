"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import type { ItemData, ColumnData, UserOption } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { canManageStructure, canEditCellValue, canModifyItemSchedule } from "@/lib/permissions";
import { isItemAssignedToUser } from "@/lib/itemAssignment";
import { CellEditor } from "./cell-editors/CellEditor";
import { ItemDetailModal } from "./ItemDetailModal";
import { AssignmentModal } from "./AssignmentModal";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";
import { renameItem, deleteItem, createItem, insertItem } from "@/lib/actions/item";
import { computeItemProgress } from "@/lib/progress";
import { gridTemplate, frozenPaneWidth } from "./gridTemplate";

export function ItemRow({
  pane,
  boardId,
  groupId,
  item,
  allGroupItems,
  depth = 0,
  columns,
  users,
  progressColumnId,
  ganttStartColumnId,
  ganttDurationColumnId,
  ganttEndColumnId,
  lockedScheduleFields,
  userRole,
  currentUserId,
  visibleIds,
  nameWidth,
  wbsCodes,
  highlightItemId,
  expandIds,
  levelColors,
  collapsedIds,
  onToggleCollapse,
}: {
  pane: "frozen" | "data";
  boardId: string;
  groupId: string;
  item: ItemData;
  allGroupItems: ItemData[];
  depth?: number;
  columns: ColumnData[];
  users: UserOption[];
  progressColumnId: string | null;
  ganttStartColumnId: string | null;
  ganttDurationColumnId: string | null;
  ganttEndColumnId: string | null;
  lockedScheduleFields: Map<string, { startLocked: boolean; endLocked: boolean }>;
  userRole: UserRole;
  currentUserId: string;
  visibleIds: Set<string> | null;
  nameWidth: number;
  wbsCodes?: Map<string, string>;
  highlightItemId?: string | null;
  expandIds?: Set<string>;
  levelColors?: string[];
  collapsedIds: Set<string>;
  onToggleCollapse: (itemId: string) => void;
}) {
  const canEditStructure = canManageStructure(userRole);
  const canModifySchedule = canModifyItemSchedule(userRole, item.createdById, currentUserId);
  const personColumnIds = columns.filter((c) => c.type === "PERSON").map((c) => c.id);
  const isAssignedToCurrentUser = isItemAssignedToUser(item, personColumnIds, currentUserId);
  const [name, setName] = useState(item.name);
  const isAncestorOfHighlight = expandIds?.has(item.id) ?? false;
  const expanded = !collapsedIds.has(item.id) || isAncestorOfHighlight;
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const isHighlighted = item.id === highlightItemId;
  const [flash, setFlash] = useState(false);
  const levelColor = levelColors?.[depth]?.trim() || undefined;
  const rowBackground = flash ? "#fecaca" : levelColor;

  useEffect(() => {
    if (!isHighlighted || !rowRef.current) return;
    rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 2000);
    return () => clearTimeout(timer);
  }, [isHighlighted]);

  const children = allGroupItems
    .filter((i) => i.parentId === item.id)
    .filter((i) => visibleIds === null || visibleIds.has(i.id))
    .sort((a, b) => a.order - b.order);
  const hasChildren = children.length > 0;
  const commentCount = item._count.comments;

  const valuesByColumn = new Map(
    item.cellValues.map((cv) => [cv.columnId, cv.value as string | number | null])
  );

  function saveName() {
    if (name.trim() && name !== item.name) {
      renameItem(boardId, item.id, name.trim());
    } else {
      setName(item.name);
    }
  }

  async function handleAddSubitem() {
    if (collapsedIds.has(item.id)) onToggleCollapse(item.id);
    await createItem(boardId, groupId, "新子項目", item.id);
  }

  async function handleInsert(position: "before" | "after") {
    await insertItem(boardId, groupId, item.parentId, item.id, position);
  }

  const childRows = expanded
    ? children.map((child) => (
        <ItemRow
          key={child.id}
          pane={pane}
          boardId={boardId}
          groupId={groupId}
          item={child}
          allGroupItems={allGroupItems}
          depth={depth + 1}
          columns={columns}
          users={users}
          progressColumnId={progressColumnId}
          ganttStartColumnId={ganttStartColumnId}
          ganttDurationColumnId={ganttDurationColumnId}
          ganttEndColumnId={ganttEndColumnId}
          lockedScheduleFields={lockedScheduleFields}
          userRole={userRole}
          currentUserId={currentUserId}
          visibleIds={visibleIds}
          nameWidth={nameWidth}
          wbsCodes={wbsCodes}
          highlightItemId={highlightItemId}
          expandIds={expandIds}
          levelColors={levelColors}
          collapsedIds={collapsedIds}
          onToggleCollapse={onToggleCollapse}
        />
      ))
    : null;

  if (pane === "frozen") {
    return (
      <>
        <div
          ref={rowRef}
          className="group flex h-9 items-center border-b border-neutral-100 hover:bg-neutral-50"
          style={{
            width: frozenPaneWidth(nameWidth),
            backgroundColor: rowBackground,
            transition: "background-color 1.5s ease",
          }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            {hasChildren && (
              <button
                type="button"
                onClick={() => onToggleCollapse(item.id)}
                className="text-neutral-400 hover:text-neutral-700"
                aria-label={expanded ? "收合子項目" : "展開子項目"}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1" style={{ paddingLeft: depth * 20 }}>
            {wbsCodes?.get(item.id) && (
              <span className="shrink-0 text-xs font-bold text-black">{wbsCodes.get(item.id)}</span>
            )}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              }}
              readOnly={!canEditStructure}
              className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-sm outline-none hover:bg-neutral-100 focus:bg-white focus:ring-1 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className={`flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-xs hover:bg-neutral-100 hover:text-neutral-600 ${
                commentCount > 0 ? "text-blue-600" : "text-neutral-300"
              }`}
              aria-label="留言"
            >
              <MessageSquare size={14} />
              {commentCount > 0 && <span>{commentCount}</span>}
            </button>
            {canEditStructure && (
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                title={item.assignments.map((a) => `${a.user.name} ${a.allocationPct}%`).join(", ")}
                className={`flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-xs hover:bg-neutral-100 hover:text-neutral-600 ${
                  item.assignments.length > 0 ? "text-blue-600" : "text-neutral-300"
                }`}
                aria-label="指派"
              >
                <UserPlus size={14} />
                {item.assignments.length > 0 && <span>{item.assignments.length}</span>}
              </button>
            )}
            {canEditStructure && (
              <RowMenu>
                <RowMenuItem onSelect={handleAddSubitem}>
                  <span className="flex items-center gap-2">
                    <Plus size={14} /> 新增子項目
                  </span>
                </RowMenuItem>
                <RowMenuItem onSelect={() => handleInsert("before")}>
                  <span className="flex items-center gap-2">
                    <ArrowUpToLine size={14} /> 上方插入項目
                  </span>
                </RowMenuItem>
                <RowMenuItem onSelect={() => handleInsert("after")}>
                  <span className="flex items-center gap-2">
                    <ArrowDownToLine size={14} /> 下方插入項目
                  </span>
                </RowMenuItem>
                {canModifySchedule && (
                  <RowMenuItem danger onSelect={() => deleteItem(boardId, item.id)}>
                    <span className="flex items-center gap-2">
                      <Trash2 size={14} /> 刪除
                    </span>
                  </RowMenuItem>
                )}
              </RowMenu>
            )}
          </div>
        </div>
        <ItemDetailModal
          boardId={boardId}
          item={detailOpen ? item : null}
          columns={columns}
          users={users}
          progressColumnId={progressColumnId}
          userRole={userRole}
          currentUserId={currentUserId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
        {canEditStructure && (
          <AssignmentModal
            boardId={boardId}
            item={assignOpen ? item : null}
            users={users}
            currentUserId={currentUserId}
            userRole={userRole}
            open={assignOpen}
            onOpenChange={setAssignOpen}
          />
        )}
        {childRows}
      </>
    );
  }

  return (
    <>
      <div
        ref={rowRef}
        className="group grid h-9 w-fit items-center border-b border-neutral-100 hover:bg-neutral-50"
        style={{
          gridTemplateColumns: gridTemplate(columns.length),
          backgroundColor: rowBackground,
          transition: "background-color 1.5s ease",
        }}
      >
        {columns.map((col) => {
          const isScheduleColumn =
            col.id === ganttStartColumnId ||
            col.id === ganttDurationColumnId ||
            col.id === ganttEndColumnId;
          const lock = lockedScheduleFields.get(item.id);
          const isLockedByPredecessor =
            (col.id === ganttStartColumnId && lock?.startLocked) ||
            (col.id === ganttEndColumnId && lock?.endLocked);
          return (
            <div
              key={col.id}
              className="border-r border-neutral-100 px-1"
              style={isLockedByPredecessor ? { backgroundColor: "#f3f4f6" } : undefined}
              title={isLockedByPredecessor ? "由前置依賴自動計算" : undefined}
            >
              {hasChildren && col.id === progressColumnId ? (
                <RollupProgress
                  value={computeItemProgress(item, allGroupItems, col.id)}
                  childCount={children.length}
                />
              ) : (
                <CellEditor
                  boardId={boardId}
                  itemId={item.id}
                  column={col}
                  value={valuesByColumn.get(col.id) ?? null}
                  users={users}
                  canEdit={
                    canEditCellValue(userRole, col.type, col.id === progressColumnId, isAssignedToCurrentUser) &&
                    (!isScheduleColumn || canModifySchedule) &&
                    !isLockedByPredecessor
                  }
                  isProgressColumn={col.id === progressColumnId}
                />
              )}
            </div>
          );
        })}
      </div>
      {childRows}
    </>
  );
}

function RollupProgress({
  value,
  childCount,
}: {
  value: number | null;
  childCount: number;
}) {
  if (value === null) {
    return <span className="px-2 text-xs text-neutral-400">—</span>;
  }
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="flex items-center gap-2 px-2"
      title={`依 ${childCount} 個子項目自動計算`}
    >
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-neutral-500">
        {Math.round(pct)}%
      </span>
    </div>
  );
}
