"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { notifyItemAssignees, notifyEmailIfNeeded } from "@/lib/notify";
import { executeAutomationRules } from "@/lib/automation";
import { syncGanttDates } from "@/lib/ganttSync";
import { syncPredecessorSchedule, resolveLockedScheduleFields } from "@/lib/predecessorLink";
import { canEditCellValue, canModifyItemSchedule } from "@/lib/permissions";
import { requireBoardAccess } from "@/lib/boardAccess";
import { logActivity } from "@/lib/activityLog";
import { isItemAssignedToUser, isItemAssignedToTeam } from "@/lib/itemAssignment";
import { loadGroupRoleContext } from "@/lib/groupRoleContext";
import { getPersonIds, type CellValueJson } from "@/types/column";

export async function upsertCellValue(
  boardId: string,
  itemId: string,
  columnId: string,
  value: CellValueJson
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);

  const [existing, column, item, board, personColumns] = await Promise.all([
    prisma.cellValue.findUnique({
      where: { itemId_columnId: { itemId, columnId } },
    }),
    prisma.column.findUnique({ where: { id: columnId } }),
    prisma.item.findUnique({
      where: { id: itemId },
      include: { cellValues: true, assignments: true },
    }),
    prisma.board.findUnique({
      where: { id: boardId },
      select: {
        progressColumnId: true,
        ganttStartColumnId: true,
        ganttDurationColumnId: true,
        ganttEndColumnId: true,
        predColumnId: true,
        linkColumnId: true,
        typeColumnId: true,
        manualStartColumnId: true,
        manualDurationColumnId: true,
      },
    }),
    prisma.column.findMany({ where: { boardId, type: "PERSON" }, select: { id: true } }),
  ]);

  const personColumnIds = personColumns.map((c) => c.id);
  const isAssignedToUser = item ? isItemAssignedToUser(item, personColumnIds, session.userId) : false;
  const groupRole = item ? await loadGroupRoleContext(item.groupId, session.userId) : null;
  const isAssignedToGroupDiscipline =
    item && groupRole ? isItemAssignedToTeam(item, personColumnIds, groupRole.teamUserIds) : false;

  if (
    column &&
    !canEditCellValue(
      session.role,
      column.type,
      column.id === board?.progressColumnId,
      isAssignedToUser,
      isAssignedToGroupDiscipline
    )
  ) {
    throw new Error("權限不足:你只能編輯自己被指派或負責項目的狀態與進度欄位");
  }

  const isScheduleColumn =
    column &&
    board &&
    (column.id === board.ganttStartColumnId ||
      column.id === board.ganttDurationColumnId ||
      column.id === board.ganttEndColumnId);
  if (
    isScheduleColumn &&
    item &&
    !canModifyItemSchedule(session.role, item.createdById, session.userId, groupRole?.access.hasScheduleRole ?? false)
  ) {
    throw new Error("權限不足:僅建立者或管理者可以修改此項目的時程");
  }

  if (
    column &&
    board &&
    (column.id === board.ganttStartColumnId ||
      column.id === board.ganttEndColumnId ||
      column.id === board.ganttDurationColumnId)
  ) {
    const [linkColumn, typeColumn, boardItems] = await Promise.all([
      board.linkColumnId
        ? prisma.column.findUnique({ where: { id: board.linkColumnId }, select: { options: true } })
        : null,
      board.typeColumnId
        ? prisma.column.findUnique({ where: { id: board.typeColumnId }, select: { options: true } })
        : null,
      prisma.item.findMany({
        where: { boardId },
        select: { id: true, parentId: true, order: true, cellValues: true, groupId: true },
      }),
    ]);
    const locked = resolveLockedScheduleFields(
      boardItems,
      board.predColumnId,
      board.linkColumnId,
      linkColumn?.options,
      board.typeColumnId,
      typeColumn?.options,
      board.manualStartColumnId,
      board.manualDurationColumnId
    );
    const lock = locked.get(itemId);
    const isLocked =
      (column.id === board.ganttStartColumnId && lock?.startLocked) ||
      (column.id === board.ganttEndColumnId && lock?.endLocked) ||
      (column.id === board.ganttDurationColumnId && lock?.daysLocked);
    if (isLocked) {
      throw new Error("此日期/天數由前置依賴或子項目統計自動計算,無法手動編輯");
    }
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
        if (!assignee) {
          // Not a real User — likely a Resource (tool/vendor), which has no
          // account to notify. Still log the assignment if we can name it.
          const resource = await prisma.resource.findUnique({ where: { id: userId }, select: { name: true } });
          if (resource) {
            await logActivity(itemId, session.userId, `「${column.name}」指派給 ${resource.name}`);
          }
          continue;
        }
        await logActivity(itemId, session.userId, `「${column.name}」指派給 ${assignee.name}`);
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
        await syncPredecessorSchedule(boardId, itemId, columnId);
      }
    }
  }

  revalidatePath(`/boards/${boardId}`);
}
