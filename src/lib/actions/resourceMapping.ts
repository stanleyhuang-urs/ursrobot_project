"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";
import { requireBoardAccess } from "@/lib/boardAccess";
import { notifyEmailIfNeeded } from "@/lib/notify";

export async function getDistinctTextValues(boardId: string, columnId: string) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  const cellValues = await prisma.cellValue.findMany({
    where: { columnId, item: { boardId } },
    select: { value: true },
  });

  const counts = new Map<string, number>();
  for (const cv of cellValues) {
    if (typeof cv.value === "string" && cv.value.trim()) {
      counts.set(cv.value, (counts.get(cv.value) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export async function applyResourceMapping(
  boardId: string,
  sourceColumnId: string,
  newColumnName: string,
  targetColumnId: string | null,
  mapping: { value: string; userId: string }[]
) {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  const notifications: {
    userId: string;
    actorId: string;
    type: "ASSIGNED";
    itemId: string;
    message: string;
  }[] = [];

  const result = await prisma.$transaction(
    async (tx) => {
      let columnId = targetColumnId;
      if (!columnId) {
        const count = await tx.column.count({ where: { boardId } });
        const created = await tx.column.create({
          data: {
            boardId,
            name: newColumnName.trim() || "負責人",
            type: "PERSON",
            order: count,
            options: {},
          },
        });
        columnId = created.id;
      }

      const [sourceCells, existingTargetCells, items] = await Promise.all([
        tx.cellValue.findMany({
          where: { columnId: sourceColumnId, item: { boardId } },
          select: { itemId: true, value: true },
        }),
        tx.cellValue.findMany({
          where: { columnId, item: { boardId } },
          select: { itemId: true, value: true },
        }),
        tx.item.findMany({ where: { boardId }, select: { id: true, name: true } }),
      ]);

      const existingByItem = new Map(existingTargetCells.map((c) => [c.itemId, c.value]));
      const nameByItem = new Map(items.map((i) => [i.id, i.name]));
      const userIdByValue = new Map(mapping.map((m) => [m.value, m.userId]));

      let updatedCount = 0;

      for (const cell of sourceCells) {
        if (typeof cell.value !== "string") continue;
        const userId = userIdByValue.get(cell.value);
        if (!userId || existingByItem.get(cell.itemId) === userId) continue;

        await tx.cellValue.upsert({
          where: { itemId_columnId: { itemId: cell.itemId, columnId } },
          create: { itemId: cell.itemId, columnId, value: userId },
          update: { value: userId },
        });
        updatedCount++;

        if (userId !== session.userId) {
          const itemName = nameByItem.get(cell.itemId);
          if (itemName) {
            notifications.push({
              userId,
              actorId: session.userId,
              type: "ASSIGNED",
              itemId: cell.itemId,
              message: `你被指派到「${itemName}」`,
            });
          }
        }
      }

      if (notifications.length > 0) {
        await tx.notification.createMany({ data: notifications });
      }

      revalidatePath(`/boards/${boardId}`);
      return { updatedCount, columnId };
    },
    { timeout: 30000 }
  );

  for (const n of notifications) {
    await notifyEmailIfNeeded(n.userId, n.type, n.message);
  }

  return result;
}
