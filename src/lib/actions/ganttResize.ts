"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAccess } from "@/lib/boardAccess";
import { canModifyItemSchedule } from "@/lib/permissions";
import { getItemDateRange } from "@/lib/gantt";
import { countBusinessDays } from "@/lib/workday";
import { resolveLockedScheduleFields, syncPredecessorSchedule } from "@/lib/predecessorLink";
import { logActivity } from "@/lib/activityLog";
import { listHolidays, toHolidaySet } from "@/lib/holidays";

/** Days (inclusive of both ends) between two dates, per the board's calendar
 *  vs business-day duration mode. Mirrors getItemDateRange's own duration
 *  semantics so a resize round-trips through Days consistently. */
function countDays(start: Date, end: Date, mode: "CALENDAR" | "BUSINESS", holidays: Set<string>): number | null {
  if (mode === "BUSINESS") return countBusinessDays(start, end, holidays);
  if (end.getTime() < start.getTime()) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * Drags the front or back edge of a Gantt bar: keeps the other end fixed,
 * moves the dragged end to newDateIso, and recomputes Days to match — used
 * by BoardGantt's resize handles. Refuses to touch an end that's currently
 * computed from a Pred/Link relationship (see resolveLockedScheduleFields).
 */
export async function resizeItemBar(
  boardId: string,
  itemId: string,
  edge: "start" | "end",
  newDateIso: string
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);

  const [board, item] = await Promise.all([
    prisma.board.findUnique({
      where: { id: boardId },
      select: {
        ganttStartColumnId: true,
        ganttDurationColumnId: true,
        ganttEndColumnId: true,
        ganttDurationMode: true,
        predColumnId: true,
        linkColumnId: true,
      },
    }),
    prisma.item.findUnique({ where: { id: itemId }, include: { cellValues: true } }),
  ]);
  if (!board?.ganttStartColumnId || !board.ganttDurationColumnId || !item) {
    throw new Error("此看板尚未設定甘特圖「開始日期」與「天數」欄位");
  }
  if (!canModifyItemSchedule(session.role, item.createdById, session.userId)) {
    throw new Error("權限不足:僅建立者或管理者可以修改此項目的時程");
  }

  if (board.predColumnId && board.linkColumnId) {
    const [linkColumn, boardItems] = await Promise.all([
      prisma.column.findUnique({ where: { id: board.linkColumnId }, select: { options: true } }),
      prisma.item.findMany({ where: { boardId }, select: { id: true, parentId: true, order: true, cellValues: true } }),
    ]);
    const locked = resolveLockedScheduleFields(boardItems, board.predColumnId, board.linkColumnId, linkColumn?.options);
    const lock = locked.get(itemId);
    if ((edge === "start" && lock?.startLocked) || (edge === "end" && lock?.endLocked)) {
      throw new Error("此日期由前置依賴自動計算,請改天數或前置依賴設定");
    }
  }

  const holidays = toHolidaySet(await listHolidays());
  const currentRange = getItemDateRange(
    item,
    board.ganttStartColumnId,
    board.ganttDurationColumnId,
    board.ganttDurationMode,
    holidays
  );
  if (!currentRange) throw new Error("此項目尚未填寫開始日期與天數");

  const newDate = new Date(newDateIso);
  if (Number.isNaN(newDate.getTime())) throw new Error("日期格式錯誤");

  const newStart = edge === "start" ? newDate : currentRange.start;
  const newEnd = edge === "end" ? newDate : currentRange.end;
  const days = countDays(newStart, newEnd, board.ganttDurationMode, holidays);
  if (days === null || days < 1) {
    throw new Error("拖曳後的時間範圍不合理,結束日期不能早於開始日期");
  }

  const startIso = newStart.toISOString().slice(0, 10);
  const endIso = newEnd.toISOString().slice(0, 10);

  await prisma.$transaction([
    prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId, columnId: board.ganttStartColumnId } },
      create: { itemId, columnId: board.ganttStartColumnId, value: startIso },
      update: { value: startIso },
    }),
    prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId, columnId: board.ganttDurationColumnId } },
      create: { itemId, columnId: board.ganttDurationColumnId, value: days },
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

  await logActivity(itemId, session.userId, `拖曳調整時程為 ${startIso} ~ ${endIso}`);
  await syncPredecessorSchedule(boardId, itemId, board.ganttStartColumnId);

  revalidatePath(`/boards/${boardId}`);
}
