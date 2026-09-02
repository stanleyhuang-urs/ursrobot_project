"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { canManageGroupStructure, canModifyItemSchedule, requireStructureAccess } from "@/lib/permissions";
import { requireBoardAccess, requireGroupBoardAccess, requireItemBoardAccess } from "@/lib/boardAccess";
import { logActivity } from "@/lib/activityLog";
import { getStatusOptions } from "@/types/column";
import { loadGroupRoleContext } from "@/lib/groupRoleContext";
import { computeWbsCodes } from "@/lib/wbs";
import { syncPredecessorSchedule } from "@/lib/predecessorLink";
import type { SessionPayload } from "@/lib/jwt";

/** Item creation/structure edits are normally ADMIN/SUPERVISOR-only, but a
 *  group's TEAM_LEADER/SW_DM/HW_DM/ME_DM/QA also gets structure rights
 *  scoped to that one group — see canManageGroupStructure. Also verifies the
 *  caller actually has board-level access to this group's own board — an
 *  ADMIN/SUPERVISOR role alone isn't a blanket bypass of RESTRICTED board
 *  visibility (only ADMIN and PUBLIC/owned/member boards are, per
 *  canAccessBoard), so this can't be satisfied by naming an unrelated group
 *  on a board the caller happens to have access to. Returns the group's
 *  real boardId. */
async function requireGroupStructureAccess(session: SessionPayload, groupId: string): Promise<string> {
  const boardId = await requireGroupBoardAccess(groupId, session);
  const { access } = await loadGroupRoleContext(groupId, session.userId);
  if (!canManageGroupStructure(session.role, access.disciplines.size > 0)) {
    throw new Error("權限不足:僅管理者、主管或此分組的負責角色可以執行此操作");
  }
  return boardId;
}

/**
 * Resolves the Task/Summary option ids of the board's Type column (if
 * configured), so a newly created item can default to Task and a newly
 * childed parent can flip to Summary — matching the Type values already
 * used by the Gantt's Milestone/Summary rollup logic.
 */
async function loadTypeOptionIds(typeColumnId: string | null) {
  if (!typeColumnId) return null;
  const column = await prisma.column.findUnique({ where: { id: typeColumnId }, select: { options: true } });
  if (!column) return null;
  const options = getStatusOptions(column.options);
  return {
    taskId: options.find((o) => o.label === "Task")?.id,
    summaryId: options.find((o) => o.label === "Summary")?.id,
  };
}

// Matches boardWithDataArgs's items.include shape, so a freshly created item
// can be dropped straight into UI state (e.g. to reopen its detail modal)
// without waiting on the page's next full refetch.
const itemDetailInclude = {
  cellValues: true,
  _count: { select: { comments: true } },
  assignments: { include: { user: { select: { id: true, name: true } } } },
} as const;

/** A new sub-item inherits sensible defaults from its parent/board instead
 *  of starting blank: Lvl = parent's Lvl + 1, Pred = parent's WBS code,
 *  負責人 = the creating user, Priority = Normal, Status = Planned,
 *  Start/start(set) = today. Each only applies if the matching column
 *  exists on the board (by name) — boards created before these conventions,
 *  or without a Gantt start column mapped, are unaffected. */
async function buildNewItemCellValues(
  boardId: string,
  groupId: string,
  parentId: string | undefined,
  userId: string
): Promise<{
  typeColumnId: string | null;
  summaryOptionId: string | undefined;
  alwaysComputedTrigger: string | null;
  cellValues: { columnId: string; value: string | number }[];
}> {
  const [board, parent, groupItems] = await Promise.all([
    prisma.board.findUnique({
      where: { id: boardId },
      select: {
        typeColumnId: true,
        ganttStartColumnId: true,
        predColumnId: true,
        manualStartColumnId: true,
        manualDurationColumnId: true,
        columns: { select: { id: true, name: true, type: true, options: true } },
      },
    }),
    parentId
      ? prisma.item.findUnique({ where: { id: parentId }, select: { cellValues: true } })
      : Promise.resolve(null),
    parentId
      ? prisma.item.findMany({ where: { groupId }, select: { id: true, parentId: true, order: true } })
      : Promise.resolve([]),
  ]);
  const typeIds = await loadTypeOptionIds(board?.typeColumnId ?? null);

  const cellValues: { columnId: string; value: string | number }[] = [];
  if (board?.typeColumnId && typeIds?.taskId) {
    cellValues.push({ columnId: board.typeColumnId, value: typeIds.taskId });
  }

  const columns = board?.columns ?? [];

  const lvlColumn = columns.find((c) => c.name === "Lvl" && c.type === "NUMBER");
  if (lvlColumn && parent) {
    const parentLvl = parent.cellValues.find((cv) => cv.columnId === lvlColumn.id)?.value;
    if (typeof parentLvl === "number") {
      cellValues.push({ columnId: lvlColumn.id, value: parentLvl + 1 });
    }
  }

  if (board?.predColumnId && parentId) {
    const parentCode = computeWbsCodes(groupItems).get(parentId);
    if (parentCode) cellValues.push({ columnId: board.predColumnId, value: parentCode });
  }

  const ownerColumn = columns.find((c) => c.name === "負責人" && c.type === "PERSON");
  if (ownerColumn) cellValues.push({ columnId: ownerColumn.id, value: userId });

  const priorityColumn = columns.find((c) => c.name === "Priority" && c.type === "STATUS");
  if (priorityColumn) {
    const normal = getStatusOptions(priorityColumn.options).find((o) => o.label.toUpperCase() === "NORMAL");
    if (normal) cellValues.push({ columnId: priorityColumn.id, value: normal.id });
  }

  const statusColumn = columns.find((c) => c.name === "Status" && c.type === "STATUS");
  if (statusColumn) {
    const planned = getStatusOptions(statusColumn.options).find((o) => o.label.toLowerCase() === "planned");
    if (planned) cellValues.push({ columnId: statusColumn.id, value: planned.id });
  }

  // In "always computed" boards, Start/Days/Finish are locked and derived
  // from manualStartColumnId/manualDurationColumnId — writing Start directly
  // here would just get overwritten (and violate the lock's own invariant).
  // Only start(set) gets today; syncPredecessorSchedule below computes the rest.
  const alwaysComputed = !!board?.manualStartColumnId && !!board?.manualDurationColumnId;
  const today = new Date().toISOString().slice(0, 10);
  if (board?.ganttStartColumnId && !alwaysComputed) {
    cellValues.push({ columnId: board.ganttStartColumnId, value: today });
  }
  const startSetColumn = columns.find((c) => c.name === "start(set)" && c.type === "DATE");
  if (startSetColumn) cellValues.push({ columnId: startSetColumn.id, value: today });

  return {
    typeColumnId: board?.typeColumnId ?? null,
    summaryOptionId: typeIds?.summaryId,
    alwaysComputedTrigger: alwaysComputed ? board!.manualStartColumnId : null,
    cellValues,
  };
}

export async function createItem(
  /** Not trusted — see requireGroupStructureAccess below, which derives the
   *  group's real board instead of taking the caller's word for it. */
  _boardId: string,
  groupId: string,
  name: string,
  parentId?: string
) {
  const session = await requireSession();
  const boardId = await requireGroupStructureAccess(session, groupId);
  if (parentId) {
    const parent = await prisma.item.findUnique({ where: { id: parentId }, select: { groupId: true } });
    if (!parent || parent.groupId !== groupId) {
      throw new Error("父項目不屬於此分組");
    }
  }
  const trimmed = name.trim() || "未命名項目";

  const [count, { typeColumnId, summaryOptionId, alwaysComputedTrigger, cellValues }] = await Promise.all([
    prisma.item.count({ where: parentId ? { parentId } : { groupId, parentId: null } }),
    buildNewItemCellValues(boardId, groupId, parentId, session.userId),
  ]);

  let item = await prisma.item.create({
    data: {
      boardId,
      groupId,
      name: trimmed,
      order: count,
      parentId,
      createdById: session.userId,
      cellValues: { create: cellValues },
    },
    include: itemDetailInclude,
  });

  if (parentId && typeColumnId && summaryOptionId) {
    await prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId: parentId, columnId: typeColumnId } },
      create: { itemId: parentId, columnId: typeColumnId, value: summaryOptionId },
      update: { value: summaryOptionId },
    });
  }

  if (alwaysComputedTrigger) {
    await syncPredecessorSchedule(boardId, item.id, alwaysComputedTrigger);
    item = await prisma.item.findUniqueOrThrow({ where: { id: item.id }, include: itemDetailInclude });
  }

  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/dashboard");
  return item;
}

export async function insertItem(
  /** Not trusted — see requireGroupStructureAccess below, which derives the
   *  group's real board instead of taking the caller's word for it. */
  _boardId: string,
  groupId: string,
  parentId: string | null,
  referenceItemId: string,
  position: "before" | "after"
) {
  const session = await requireSession();
  const boardId = await requireGroupStructureAccess(session, groupId);

  const [reference, board] = await Promise.all([
    prisma.item.findUnique({ where: { id: referenceItemId } }),
    prisma.board.findUnique({ where: { id: boardId }, select: { typeColumnId: true } }),
  ]);
  if (!reference || reference.groupId !== groupId) throw new Error("找不到參考項目");
  const typeIds = await loadTypeOptionIds(board?.typeColumnId ?? null);

  const targetOrder = position === "before" ? reference.order : reference.order + 1;

  await prisma.$transaction([
    prisma.item.updateMany({
      where: { groupId, parentId, order: { gte: targetOrder } },
      data: { order: { increment: 1 } },
    }),
    prisma.item.create({
      data: {
        boardId,
        groupId,
        parentId,
        name: "新項目",
        order: targetOrder,
        createdById: session.userId,
        ...(board?.typeColumnId && typeIds?.taskId
          ? { cellValues: { create: { columnId: board.typeColumnId, value: typeIds.taskId } } }
          : {}),
      },
    }),
  ]);

  revalidatePath(`/boards/${boardId}`);
}

export async function renameItem(
  /** Not trusted — see requireGroupStructureAccess below, which derives the
   *  item's real board instead of taking the caller's word for it. */
  _boardId: string,
  itemId: string,
  name: string
) {
  const session = await requireSession();
  const trimmed = name.trim() || "未命名項目";

  const existing = await prisma.item.findUnique({ where: { id: itemId }, select: { name: true, groupId: true } });
  if (!existing) throw new Error("找不到項目");
  const boardId = await requireGroupStructureAccess(session, existing.groupId);
  await prisma.item.update({ where: { id: itemId }, data: { name: trimmed } });
  if (existing.name !== trimmed) {
    await logActivity(itemId, session.userId, `項目名稱從「${existing.name}」改為「${trimmed}」`);
  }
  revalidatePath(`/boards/${boardId}`);
}

export async function deleteItem(
  /** Not trusted — see requireItemBoardAccess below. */
  _boardId: string,
  itemId: string
) {
  const session = await requireSession();
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { boardId: true, createdById: true } });
  if (!item) throw new Error("找不到項目");
  await requireBoardAccess(item.boardId, session);
  requireStructureAccess(session.role);
  if (!canModifyItemSchedule(session.role, item.createdById, session.userId)) {
    throw new Error("權限不足:僅建立者或管理者可以刪除此項目");
  }

  await prisma.item.delete({ where: { id: itemId } });
  revalidatePath(`/boards/${item.boardId}`);
  revalidatePath("/dashboard");
}

export async function moveItemToGroup(
  /** Not trusted — see requireItemBoardAccess below. */
  _boardId: string,
  itemId: string,
  groupId: string
) {
  const session = await requireSession();
  const boardId = await requireItemBoardAccess(itemId, session);
  requireStructureAccess(session.role);

  const targetGroup = await prisma.group.findUnique({ where: { id: groupId }, select: { boardId: true } });
  if (!targetGroup || targetGroup.boardId !== boardId) {
    throw new Error("目標分組不屬於此項目所在的看板");
  }

  const count = await prisma.item.count({ where: { groupId } });
  await prisma.item.update({
    where: { id: itemId },
    data: { groupId, order: count },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function reorderItems(
  boardId: string,
  items: { id: string; order: number; groupId: string }[]
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);

  const itemIds = items.map((i) => i.id);
  const groupIds = [...new Set(items.map((i) => i.groupId))];
  const [existingItems, existingGroups] = await Promise.all([
    prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, boardId: true } }),
    prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, boardId: true } }),
  ]);
  const allOnThisBoard =
    existingItems.length === itemIds.length &&
    existingItems.every((i) => i.boardId === boardId) &&
    existingGroups.length === groupIds.length &&
    existingGroups.every((g) => g.boardId === boardId);
  if (!allOnThisBoard) {
    throw new Error("項目或分組不屬於此看板");
  }

  await prisma.$transaction(
    items.map((item) =>
      prisma.item.update({
        where: { id: item.id },
        data: { order: item.order, groupId: item.groupId },
      })
    )
  );
  revalidatePath(`/boards/${boardId}`);
}
