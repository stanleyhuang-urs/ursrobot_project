"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireStructureAccess } from "@/lib/permissions";
import { requireBoardAccess } from "@/lib/boardAccess";
import { logActivity } from "@/lib/activityLog";

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

  const count = await prisma.item.count({
    where: parentId ? { parentId } : { groupId, parentId: null },
  });
  const item = await prisma.item.create({
    data: { boardId, groupId, name: trimmed, order: count, parentId },
  });

  revalidatePath(`/boards/${boardId}`);
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

  const reference = await prisma.item.findUnique({
    where: { id: referenceItemId },
  });
  if (!reference) throw new Error("找不到參考項目");

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
  await prisma.item.delete({ where: { id: itemId } });
  revalidatePath(`/boards/${boardId}`);
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
