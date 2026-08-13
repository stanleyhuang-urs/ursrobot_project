"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireStructureAccess } from "@/lib/permissions";
import { requireBoardAccess } from "@/lib/boardAccess";
import { notifyEmailIfNeeded } from "@/lib/notify";

export async function listAssignments(itemId: string) {
  const session = await requireSession();
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { boardId: true } });
  if (item) await requireBoardAccess(item.boardId, session);
  return prisma.assignment.findMany({
    where: { itemId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function upsertAssignment(
  boardId: string,
  itemId: string,
  userId: string,
  allocationPct: number
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  const pct = Math.max(5, Math.min(100, Math.round(allocationPct / 5) * 5));

  if (session.role === "SUPERVISOR") {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (target?.supervisorId !== session.userId) {
      throw new Error("主管只能將任務指派給自己團隊的成員");
    }
  }

  const [existing, item] = await Promise.all([
    prisma.assignment.findUnique({ where: { itemId_userId: { itemId, userId } } }),
    prisma.item.findUnique({ where: { id: itemId } }),
  ]);

  await prisma.assignment.upsert({
    where: { itemId_userId: { itemId, userId } },
    create: { itemId, userId, allocationPct: pct },
    update: { allocationPct: pct },
  });

  if (!existing && item && userId !== session.userId) {
    const message = `你被指派到「${item.name}」`;
    await prisma.notification.create({
      data: {
        userId,
        actorId: session.userId,
        type: "ASSIGNED",
        itemId,
        message,
      },
    });
    await notifyEmailIfNeeded(userId, "ASSIGNED", message);
  }

  revalidatePath(`/boards/${boardId}`);
}

export async function removeAssignment(boardId: string, itemId: string, userId: string) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.assignment.delete({
    where: { itemId_userId: { itemId, userId } },
  });
  revalidatePath(`/boards/${boardId}`);
}
