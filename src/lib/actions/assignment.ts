"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function listAssignments(itemId: string) {
  await requireSession();
  return prisma.assignment.findMany({
    where: { itemId },
    include: { user: { select: { id: true, name: true } } },
  });
}

export async function upsertAssignment(
  boardId: string,
  itemId: string,
  userId: string,
  allocationPct: number
) {
  const session = await requireSession();
  const pct = Math.max(1, Math.min(100, Math.round(allocationPct)));

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
    await prisma.notification.create({
      data: {
        userId,
        actorId: session.userId,
        type: "ASSIGNED",
        itemId,
        message: `你被指派到「${item.name}」`,
      },
    });
  }

  revalidatePath(`/boards/${boardId}`);
}

export async function removeAssignment(boardId: string, itemId: string, userId: string) {
  await requireSession();
  await prisma.assignment.delete({
    where: { itemId_userId: { itemId, userId } },
  });
  revalidatePath(`/boards/${boardId}`);
}
