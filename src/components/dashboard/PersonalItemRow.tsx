"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Plus, Trash2, UserPlus } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { canManageStructure, canModifyItemSchedule } from "@/lib/permissions";
import { deleteItem } from "@/lib/actions/item";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";
import { ItemDetailModal } from "@/components/board/ItemDetailModal";
import { AssignmentModal } from "@/components/board/AssignmentModal";
import { AddSubtaskModal } from "./AddSubtaskModal";
import type { PersonalItemEntry } from "@/lib/dashboard";
import type { UserOption } from "@/types/board";

function formatDate(date: Date) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

export function PersonalItemRow({
  item,
  showAssignees,
  userRole,
  currentUserId,
  users,
}: {
  item: PersonalItemEntry;
  showAssignees: boolean;
  userRole: UserRole;
  currentUserId: string;
  users: UserOption[];
}) {
  const canManage = canManageStructure(userRole);
  const canDelete = canModifyItemSchedule(userRole, item.createdById, currentUserId);
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [addSubtaskOpen, setAddSubtaskOpen] = useState(false);
  const commentCount = item.fullItem._count.comments;
  const assignmentCount = item.fullItem.assignments.length;

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Link
        href={`/boards/${item.boardId}?highlight=${item.itemId}`}
        className="min-w-0 flex-1 truncate text-sm text-neutral-800 hover:text-blue-600"
      >
        {item.itemName}
      </Link>
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
      {canManage && (
        <button
          type="button"
          onClick={() => setAssignOpen(true)}
          title={item.fullItem.assignments.map((a) => `${a.user.name} ${a.allocationPct}%`).join(", ")}
          className={`flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-xs hover:bg-neutral-100 hover:text-neutral-600 ${
            assignmentCount > 0 ? "text-blue-600" : "text-neutral-300"
          }`}
          aria-label="指派"
        >
          <UserPlus size={14} />
          {assignmentCount > 0 && <span>{assignmentCount}</span>}
        </button>
      )}
      {showAssignees && (
        <span className="shrink-0 text-xs text-neutral-500">
          {item.assignees
            .map((a) => (a.allocationPct !== null ? `${a.name} ${a.allocationPct}%` : a.name))
            .join(", ")}
        </span>
      )}
      <span className="shrink-0 text-xs text-neutral-400">{item.boardName}</span>
      {item.status ? (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs text-white"
          style={{ backgroundColor: item.status.color }}
        >
          {item.status.label}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-500">
          狀態未設置
        </span>
      )}
      {item.progressPct !== null && (
        <span className="shrink-0 text-xs text-neutral-500">
          {Math.round(item.progressPct)}%
        </span>
      )}
      {item.dueDate && (
        <span className="shrink-0 text-xs text-neutral-500">
          {item.startDate && `${formatDate(item.startDate)} ~ `}
          {formatDate(item.dueDate)}
        </span>
      )}
      {(canManage || canDelete) && (
        <RowMenu>
          {canManage && (
            <RowMenuItem onSelect={() => setAddSubtaskOpen(true)}>
              <span className="flex items-center gap-2">
                <Plus size={14} /> 新增子任務
              </span>
            </RowMenuItem>
          )}
          {canDelete && (
            <RowMenuItem danger onSelect={() => deleteItem(item.boardId, item.itemId)}>
              <span className="flex items-center gap-2">
                <Trash2 size={14} /> 刪除
              </span>
            </RowMenuItem>
          )}
        </RowMenu>
      )}

      <ItemDetailModal
        boardId={item.boardId}
        item={detailOpen ? item.fullItem : null}
        columns={item.columns}
        users={users}
        progressColumnId={item.progressColumnId}
        userRole={userRole}
        currentUserId={currentUserId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      {canManage && (
        <AssignmentModal
          boardId={item.boardId}
          item={assignOpen ? item.fullItem : null}
          users={users}
          currentUserId={currentUserId}
          userRole={userRole}
          open={assignOpen}
          onOpenChange={setAssignOpen}
        />
      )}
      {canManage && (
        <AddSubtaskModal
          open={addSubtaskOpen}
          onOpenChange={setAddSubtaskOpen}
          parentItemId={item.itemId}
          parentItemName={item.itemName}
          parentStartDate={item.startDate}
          parentDueDate={item.dueDate}
          users={users}
        />
      )}
    </li>
  );
}
