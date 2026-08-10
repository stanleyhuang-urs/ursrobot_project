"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import type { ItemData, ColumnData, UserOption } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { canManageStructure, canEditCellValue } from "@/lib/permissions";
import { CellEditor } from "./cell-editors/CellEditor";
import { ItemDetailModal } from "./ItemDetailModal";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";
import { renameItem, deleteItem, createItem, insertItem } from "@/lib/actions/item";
import { computeItemProgress } from "@/lib/progress";
import { gridTemplate } from "./gridTemplate";

export function ItemRow({
  boardId,
  groupId,
  item,
  allGroupItems,
  depth = 0,
  columns,
  users,
  progressColumnId,
  userRole,
}: {
  boardId: string;
  groupId: string;
  item: ItemData;
  allGroupItems: ItemData[];
  depth?: number;
  columns: ColumnData[];
  users: UserOption[];
  progressColumnId: string | null;
  userRole: UserRole;
}) {
  const canEditStructure = canManageStructure(userRole);
  const [name, setName] = useState(item.name);
  const [expanded, setExpanded] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);

  const children = allGroupItems
    .filter((i) => i.parentId === item.id)
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
    setExpanded(true);
    await createItem(boardId, groupId, "新子項目", item.id);
  }

  async function handleInsert(position: "before" | "after") {
    await insertItem(boardId, groupId, item.parentId, item.id, position);
  }

  return (
    <>
      <div
        className="group grid w-fit items-center border-b border-neutral-100 hover:bg-neutral-50"
        style={{ gridTemplateColumns: gridTemplate(columns.length) }}
      >
        <div className="sticky left-0 z-10 flex items-center justify-center bg-white group-hover:bg-neutral-50">
          {hasChildren && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-neutral-400 hover:text-neutral-700"
              aria-label={expanded ? "收合子項目" : "展開子項目"}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>
        <div
          className="sticky left-8 z-10 flex min-w-0 items-center gap-1 bg-white group-hover:bg-neutral-50"
          style={{ paddingLeft: depth * 20 }}
        >
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
        </div>
        {columns.map((col) => (
          <div key={col.id} className="px-1">
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
                canEdit={canEditCellValue(userRole, col.type, col.id === progressColumnId)}
              />
            )}
          </div>
        ))}
        {canEditStructure && (
          <RowMenu>
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
            <RowMenuItem onSelect={handleAddSubitem}>
              <span className="flex items-center gap-2">
                <Plus size={14} /> 新增子項目
              </span>
            </RowMenuItem>
            <RowMenuItem danger onSelect={() => deleteItem(boardId, item.id)}>
              <span className="flex items-center gap-2">
                <Trash2 size={14} /> 刪除
              </span>
            </RowMenuItem>
          </RowMenu>
        )}
      </div>
      <ItemDetailModal
        boardId={boardId}
        itemId={item.id}
        itemName={item.name}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      {expanded &&
        children.map((child) => (
          <ItemRow
            key={child.id}
            boardId={boardId}
            groupId={groupId}
            item={child}
            allGroupItems={allGroupItems}
            depth={depth + 1}
            columns={columns}
            users={users}
            progressColumnId={progressColumnId}
            userRole={userRole}
          />
        ))}
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
