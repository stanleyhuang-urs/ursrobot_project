"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAccess } from "@/lib/boardAccess";

export async function listActivityLog(itemId: string) {
  const session = await requireSession();
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { boardId: true } });
  if (item) await requireBoardAccess(item.boardId, session);
  return prisma.activityLogEntry.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
  });
}
