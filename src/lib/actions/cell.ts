"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { notifyItemAssignees, notifyEmailIfNeeded } from "@/lib/notify";
import { executeAutomationRules } from "@/lib/automation";
import { syncGanttDates } from "@/lib/ganttSync";
import { syncPredecessorLink } from "@/lib/predecessorLink";
import { canEditCellValue } from "@/lib/permissions";
import { requireBoardAccess } from "@/lib/boardAccess";
import { logActivity } from "@/lib/activityLog";
import { getPersonIds, type CellValueJson } from "@/types/column";

export async function upsertCellValue(
  boardId: string,
  itemId: string,
  columnId: string,
  value: CellValueJson
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);

  const [existing, column, item, board] = await Promise.all([
    prisma.cellValue.findUnique({
      where: { itemId_columnId: { itemId, columnId } },
    }),
    prisma.column.findUnique({ where: { id: columnId } }),
    prisma.item.findUnique({ where: { id: itemId } }),
    prisma.board.findUnique({ where: { id: boardId }, select: { progressColumnId: true } }),
  ]);

  if (
    column &&
    !canEditCellValue(session.role, column.type, column.id === board?.progressColumnId)
  ) {
    throw new Error("權限不足:你只能編輯狀態與進度欄位");
  }

  const jsonValue = value === null ? Prisma.JsonNull : value;

  await prisma.cellValue.upsert({
    where: { itemId_columnId: { itemId, columnId } },
    create: { itemId, columnId, value: jsonValue },
    update: { value: jsonValue },
  });

  if (column && item) {
    if (column.type === "PERSON") {
      const oldIds = new Set(getPersonIds(existing?.value));
      const addedIds = getPersonIds(value).filter((id) => !oldIds.has(id));
      for (const userId of addedIds) {
        const assignee = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        if (assignee) {
          await logActivity(itemId, session.userId, `「${column.name}」指派給 ${assignee.name}`);
        }
        if (userId === session.userId) continue;
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
    } else {
      const changed =
        JSON.stringify(existing?.value ?? null) !== JSON.stringify(value);
      if (changed) {
        await logActivity(itemId, session.userId, `「${column.name}」已更新`);
        await notifyItemAssignees(
          prisma,
          itemId,
          session.userId,
          "UPDATED",
          `「${item.name}」的「${column.name}」已更新`
        );
        if (column.type === "STATUS") {
          await executeAutomationRules(boardId, itemId, columnId, value, session.userId);
        }
        if (column.type === "DATE" || column.type === "NUMBER") {
          await syncGanttDates(boardId, itemId, columnId, value);
        }
        if (column.type === "TEXT" || column.type === "DATE") {
          await syncPredecessorLink(boardId, itemId, columnId);
        }
      }
    }
  }

  revalidatePath(`/boards/${boardId}`);
}
