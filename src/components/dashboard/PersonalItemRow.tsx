"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { canManageStructure, canModifyItemSchedule } from "@/lib/permissions";
import { createItem, deleteItem } from "@/lib/actions/item";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";
import type { PersonalItemEntry } from "@/lib/dashboard";

function formatDate(date: Date) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

export function PersonalItemRow({
  item,
  showAssignees,
  userRole,
  currentUserId,
}: {
  item: PersonalItemEntry;
  showAssignees: boolean;
  userRole: UserRole;
  currentUserId: string;
}) {
  const canAddSubitem = canManageStructure(userRole);
  const canDelete = canModifyItemSchedule(userRole, item.createdById, currentUserId);

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Link
        href={`/boards/${item.boardId}?highlight=${item.itemId}`}
        className="min-w-0 flex-1 truncate text-sm text-neutral-800 hover:text-blue-600"
      >
        {item.itemName}
      </Link>
      {showAssignees && (
        <span className="shrink-0 text-xs text-neutral-500">
          {item.assignees
            .map((a) => (a.allocationPct !== null ? `${a.name} ${a.allocationPct}%` : a.name))
            .join(", ")}
        </span>
      )}
      <span className="shrink-0 text-xs text-neutral-400">{item.boardName}</span>
      {item.status && (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs text-white"
          style={{ backgroundColor: item.status.color }}
        >
          {item.status.label}
        </span>
      )}
      {item.dueDate && (
        <span className="shrink-0 text-xs text-neutral-500">
          {item.startDate && `${formatDate(item.startDate)} ~ `}
          {formatDate(item.dueDate)}
        </span>
      )}
      {(canAddSubitem || canDelete) && (
        <RowMenu>
          {canAddSubitem && (
            <RowMenuItem onSelect={() => createItem(item.boardId, item.groupId, "新子項目", item.itemId)}>
              <span className="flex items-center gap-2">
                <Plus size={14} /> 新增子項目
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
    </li>
  );
}
