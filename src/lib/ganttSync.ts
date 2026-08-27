import { prisma } from "@/lib/prisma";
import { addBusinessDays, countBusinessDays } from "@/lib/workday";
import { listHolidays, toHolidaySet } from "@/lib/holidays";
import type { CellValueJson } from "@/types/column";

function addCalendarDays(start: Date, days: number): Date {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Math.max(days - 1, 0));
  return end;
}

function countCalendarDays(start: Date, end: Date): number | null {
  if (end.getTime() < start.getTime()) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * Keeps a board's designated Start/Days/Finish date columns consistent:
 * editing Start or Days recomputes Finish, editing Finish recomputes Days.
 * "Days" counts calendar or business days (Mon-Fri, excluding the
 * company-wide holiday list) depending on the board's ganttDurationMode,
 * with Start itself as day 1. Writes go straight through Prisma so they
 * never re-trigger this sync.
 */
export async function syncGanttDates(
  boardId: string,
  itemId: string,
  editedColumnId: string,
  editedValue: CellValueJson
) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      ganttStartColumnId: true,
      ganttDurationColumnId: true,
      ganttEndColumnId: true,
      ganttDurationMode: true,
    },
  });
  const startId = board?.ganttStartColumnId;
  const durationId = board?.ganttDurationColumnId;
  const endId = board?.ganttEndColumnId;
  if (!startId || !durationId || !endId) return;
  if (![startId, durationId, endId].includes(editedColumnId)) return;

  const isBusiness = board.ganttDurationMode === "BUSINESS";
  const holidays = isBusiness ? toHolidaySet(await listHolidays()) : new Set<string>();

  async function getValue(columnId: string): Promise<CellValueJson> {
    if (columnId === editedColumnId) return editedValue;
    const cv = await prisma.cellValue.findUnique({
      where: { itemId_columnId: { itemId, columnId } },
    });
    return (cv?.value as CellValueJson) ?? null;
  }

  if (editedColumnId === startId || editedColumnId === durationId) {
    const startValue = await getValue(startId);
    const durationValue = await getValue(durationId);
    if (typeof startValue !== "string" || typeof durationValue !== "number" || durationValue <= 0) {
      return;
    }
    const start = new Date(startValue);
    if (Number.isNaN(start.getTime())) return;
    const end = isBusiness
      ? addBusinessDays(start, durationValue, holidays)
      : addCalendarDays(start, durationValue);
    const endIso = end.toISOString().slice(0, 10);
    await prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId, columnId: endId } },
      create: { itemId, columnId: endId, value: endIso },
      update: { value: endIso },
    });
  } else if (editedColumnId === endId) {
    const startValue = await getValue(startId);
    if (typeof startValue !== "string" || typeof editedValue !== "string") return;
    const start = new Date(startValue);
    const end = new Date(editedValue);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const count = isBusiness
      ? countBusinessDays(start, end, holidays)
      : countCalendarDays(start, end);
    if (count === null) return;
    await prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId, columnId: durationId } },
      create: { itemId, columnId: durationId, value: count },
      update: { value: count },
    });
  }
}
