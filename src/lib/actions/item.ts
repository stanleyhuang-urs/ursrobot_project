"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireStructureAccess, canModifyItemSchedule } from "@/lib/permissions";
import { requireBoardAccess } from "@/lib/boardAccess";
import { logActivity } from "@/lib/activityLog";
import { getStatusOptions } from "@/types/column";

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

export async function createItem(
  boardId: string,
  groupId: string,
  name: string,
  parentId?: string
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  const trimmed = name.trim() || "未命名項目";

  const [count, board] = await Promise.all([
    prisma.item.count({ where: parentId ? { parentId } : { groupId, parentId: null } }),
    prisma.board.findUnique({ where: { id: boardId }, select: { typeColumnId: true } }),
  ]);
  const typeIds = await loadTypeOptionIds(board?.typeColumnId ?? null);

  const item = await prisma.item.create({
    data: {
      boardId,
      groupId,
      name: trimmed,
      order: count,
      parentId,
      createdById: session.userId,
      ...(board?.typeColumnId && typeIds?.taskId
        ? { cellValues: { create: { columnId: board.typeColumnId, value: typeIds.taskId } } }
        : {}),
    },
  });

  if (parentId && board?.typeColumnId && typeIds?.summaryId) {
    await prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId: parentId, columnId: board.typeColumnId } },
      create: { itemId: parentId, columnId: board.typeColumnId, value: typeIds.summaryId },
      update: { value: typeIds.summaryId },
    });
  }

  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/dashboard");
  return item;
}

export async function insertItem(
  boardId: string,
  groupId: string,
  parentId: string | null,
  referenceItemId: string,
  position: "before" | "after"
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);

  const [reference, board] = await Promise.all([
    prisma.item.findUnique({ where: { id: referenceItemId } }),
    prisma.board.findUnique({ where: { id: boardId }, select: { typeColumnId: true } }),
  ]);
  if (!reference) throw new Error("找不到參考項目");
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
  boardId: string,
  itemId: string,
  name: string
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  const trimmed = name.trim() || "未命名項目";

  const existing = await prisma.item.findUnique({ where: { id: itemId }, select: { name: true } });
  await prisma.item.update({ where: { id: itemId }, data: { name: trimmed } });
  if (existing && existing.name !== trimmed) {
    await logActivity(itemId, session.userId, `項目名稱從「${existing.name}」改為「${trimmed}」`);
  }
  revalidatePath(`/boards/${boardId}`);
}

export async function deleteItem(boardId: string, itemId: string) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);

  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { createdById: true } });
  if (!item) throw new Error("找不到項目");
  if (!canModifyItemSchedule(session.role, item.createdById, session.userId)) {
    throw new Error("權限不足:僅建立者或管理者可以刪除此項目");
  }

  await prisma.item.delete({ where: { id: itemId } });
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/dashboard");
}

export async function moveItemToGroup(
  boardId: string,
  itemId: string,
  groupId: string
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
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
