"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type { SessionPayload } from "@/lib/jwt";
import { requireBoardAccess } from "@/lib/boardAccess";
import { canEditGanttItem } from "@/lib/permissions";
import { isItemAssignedToUser, isItemAssignedToTeam } from "@/lib/itemAssignment";
import { loadGroupRoleContext } from "@/lib/groupRoleContext";
import { getItemDateRange } from "@/lib/gantt";
import { countDaysInRange } from "@/lib/workday";
import { resolveLockedScheduleFields, syncPredecessorSchedule, type ScheduleLock } from "@/lib/predecessorLink";
import { logActivity } from "@/lib/activityLog";
import { listHolidays, toHolidaySet } from "@/lib/holidays";
import { notifyItemAssignees } from "@/lib/notify";

/**
 * Shared setup for both drag interactions: loads the board's Gantt column
 * config and the item, checks that the current user is either a manager or
 * the item's own assignee (see canEditGanttItem), and resolves the item's
 * Pred/Link/rollup/Milestone lock state so callers can refuse to touch a
 * computed end.
 */
async function loadGanttEditContext(boardId: string, itemId: string, session: SessionPayload) {
  const [board, item, personColumns] = await Promise.all([
    prisma.board.findUnique({
      where: { id: boardId },
      select: {
        ganttStartColumnId: true,
        ganttDurationColumnId: true,
        ganttEndColumnId: true,
        ganttDurationMode: true,
        predColumnId: true,
        linkColumnId: true,
        typeColumnId: true,
      },
    }),
    prisma.item.findUnique({ where: { id: itemId }, include: { cellValues: true, assignments: true } }),
    prisma.column.findMany({ where: { boardId, type: "PERSON" }, select: { id: true } }),
  ]);
  if (!board?.ganttStartColumnId || !board.ganttDurationColumnId || !item) {
    throw new Error("此看板尚未設定甘特圖「開始日期」與「天數」欄位");
  }
  const personColumnIds = personColumns.map((c) => c.id);
  const isAssigned = isItemAssignedToUser(item, personColumnIds, session.userId);
  const isTeamAssigned =
    session.role === "SUPERVISOR"
      ? isItemAssignedToTeam(
          item,
          personColumnIds,
          new Set(
            (await prisma.user.findMany({ where: { supervisorId: session.userId }, select: { id: true } })).map(
              (u) => u.id
            )
          )
        )
      : false;
  const groupRole = await loadGroupRoleContext(item.groupId, session.userId);
  const isGroupTeamAssigned = isItemAssignedToTeam(item, personColumnIds, groupRole.teamUserIds);
  if (
    !canEditGanttItem(
      session.role,
      isAssigned,
      isTeamAssigned || isGroupTeamAssigned,
      groupRole.access.hasScheduleRole
    )
  ) {
    throw new Error("權限不足:僅該項目的負責人或管理者可以調整人員分配與時程");
  }

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
  const lock: ScheduleLock | undefined = resolveLockedScheduleFields(
    boardItems,
    board.predColumnId,
    board.linkColumnId,
    linkColumn?.options,
    board.typeColumnId,
    typeColumn?.options
  ).get(itemId);

  const holidays = toHolidaySet(await listHolidays());
  return { board, item, lock, holidays };
}

/**
 * Drags the front or back edge of a Gantt bar: keeps the other end fixed,
 * moves the dragged end to newDateIso, and recomputes Days to match — used
 * by BoardGantt's resize handles. Refuses to touch an end that's currently
 * computed from a Pred/Link relationship, a child rollup, or a Milestone's
 * fixed Days (see resolveLockedScheduleFields).
 */
export async function resizeItemBar(
  boardId: string,
  itemId: string,
  edge: "start" | "end",
  newDateIso: string
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);

  const { board, item, lock, holidays } = await loadGanttEditContext(boardId, itemId, session);
  const isLocked = lock?.daysLocked || (edge === "start" ? lock?.startLocked : lock?.endLocked);
  if (isLocked) {
    throw new Error("此日期由前置依賴、子項目統計或里程碑規則自動計算,請改天數、前置依賴或子項目設定");
  }

  const currentRange = getItemDateRange(
    item,
    board.ganttStartColumnId!,
    board.ganttDurationColumnId!,
    board.ganttDurationMode,
    holidays
  );
  if (!currentRange) throw new Error("此項目尚未填寫開始日期與天數");

  const newDate = new Date(newDateIso);
  if (Number.isNaN(newDate.getTime())) throw new Error("日期格式錯誤");

  const newStart = edge === "start" ? newDate : currentRange.start;
  const newEnd = edge === "end" ? newDate : currentRange.end;
  const days = countDaysInRange(newStart, newEnd, board.ganttDurationMode, holidays);
  if (days === null || days < 1) {
    throw new Error("拖曳後的時間範圍不合理,結束日期不能早於開始日期");
  }

  const oldStartIso = currentRange.start.toISOString().slice(0, 10);
  const oldEndIso = currentRange.end.toISOString().slice(0, 10);
  const startIso = newStart.toISOString().slice(0, 10);
  const endIso = newEnd.toISOString().slice(0, 10);

  await prisma.$transaction([
    prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId, columnId: board.ganttStartColumnId! } },
      create: { itemId, columnId: board.ganttStartColumnId!, value: startIso },
      update: { value: startIso },
    }),
    prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId, columnId: board.ganttDurationColumnId! } },
      create: { itemId, columnId: board.ganttDurationColumnId!, value: days },
      update: { value: days },
    }),
    ...(board.ganttEndColumnId
      ? [
          prisma.cellValue.upsert({
            where: { itemId_columnId: { itemId, columnId: board.ganttEndColumnId } },
            create: { itemId, columnId: board.ganttEndColumnId, value: endIso },
            update: { value: endIso },
          }),
        ]
      : []),
  ]);

  await logActivity(itemId, session.userId, `拖曳調整時程:${oldStartIso}~${oldEndIso} → ${startIso}~${endIso}`);
  await notifyItemAssignees(
    prisma,
    itemId,
    session.userId,
    "UPDATED",
    `「${item.name}」的時程已調整:${oldStartIso}~${oldEndIso} → ${startIso}~${endIso}`
  );
  await syncPredecessorSchedule(boardId, itemId, board.ganttStartColumnId!);

  revalidatePath(`/boards/${boardId}`);
}

/**
 * Drags the whole Gantt bar to a new start date, shifting Start (and Finish,
 * if configured) while keeping Days unchanged — used when the user grabs the
 * bar body rather than an edge handle. Refuses to move an item whose Start
 * or Finish is locked by a Pred/Link relationship or a child rollup; a
 * Milestone's fixed Days is untouched by a pure move, so that lock alone
 * doesn't block it.
 */
export async function moveItemBar(boardId: string, itemId: string, newStartIso: string) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);

  const { board, item, lock, holidays } = await loadGanttEditContext(boardId, itemId, session);
  if (lock?.startLocked || lock?.endLocked) {
    throw new Error("此時程由前置依賴或子項目統計自動計算,無法整體搬移");
  }

  const startColumnId = board.ganttStartColumnId!;
  const durationColumnId = board.ganttDurationColumnId!;
  const currentRange = getItemDateRange(item, startColumnId, durationColumnId, board.ganttDurationMode, holidays);
  if (!currentRange) throw new Error("此項目尚未填寫開始日期與天數");

  const newStart = new Date(newStartIso);
  if (Number.isNaN(newStart.getTime())) throw new Error("日期格式錯誤");
  if (newStart.getTime() === currentRange.start.getTime()) return;

  const shiftedCellValues = item.cellValues.map((cv) =>
    cv.columnId === startColumnId ? { ...cv, value: newStartIso } : cv
  );
  const newRange = getItemDateRange(
    { cellValues: shiftedCellValues },
    startColumnId,
    durationColumnId,
    board.ganttDurationMode,
    holidays
  );
  if (!newRange) throw new Error("此項目尚未填寫開始日期與天數");

  const oldStartIso = currentRange.start.toISOString().slice(0, 10);
  const oldEndIso = currentRange.end.toISOString().slice(0, 10);
  const startIso = newRange.start.toISOString().slice(0, 10);
  const endIso = newRange.end.toISOString().slice(0, 10);

  await prisma.$transaction([
    prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId, columnId: startColumnId } },
      create: { itemId, columnId: startColumnId, value: startIso },
      update: { value: startIso },
    }),
    ...(board.ganttEndColumnId
      ? [
          prisma.cellValue.upsert({
            where: { itemId_columnId: { itemId, columnId: board.ganttEndColumnId } },
            create: { itemId, columnId: board.ganttEndColumnId, value: endIso },
            update: { value: endIso },
          }),
        ]
      : []),
  ]);

  await logActivity(itemId, session.userId, `拖曳整體搬移時程:${oldStartIso}~${oldEndIso} → ${startIso}~${endIso}`);
  await notifyItemAssignees(
    prisma,
    itemId,
    session.userId,
    "UPDATED",
    `「${item.name}」的時程已搬移:${oldStartIso}~${oldEndIso} → ${startIso}~${endIso}`
  );
  await syncPredecessorSchedule(boardId, itemId, startColumnId);

  revalidatePath(`/boards/${boardId}`);
}
