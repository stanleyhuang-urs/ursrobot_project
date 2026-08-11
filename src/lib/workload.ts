import type { BoardWithData } from "@/types/board";
import { getItemDateRange, computeDailyLoadByUser } from "@/lib/gantt";

export type WorkloadThresholdSettings = {
  greenMax: number;
  yellowMax: number;
  greenColor: string;
  yellowColor: string;
  redColor: string;
};

export function colorForPct(pct: number, t: WorkloadThresholdSettings): string {
  if (pct < t.greenMax) return t.greenColor;
  if (pct < t.yellowMax) return t.yellowColor;
  return t.redColor;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export type MemberTask = {
  boardId: string;
  boardName: string;
  itemId: string;
  itemName: string;
  allocationPct: number;
  startDate: Date | null;
  endDate: Date | null;
};

/** Per-user list of assigned tasks (Gantt Assignments only, since only those carry an allocation %). */
export function computeMemberTaskBreakdown(
  boards: BoardWithData[],
  userIds: string[]
): Map<string, MemberTask[]> {
  const idSet = new Set(userIds);
  const byUser = new Map<string, MemberTask[]>();

  for (const board of boards) {
    const hasRange = board.ganttStartColumnId && board.ganttDurationColumnId;
    for (const item of board.items) {
      for (const assignment of item.assignments) {
        if (!idSet.has(assignment.userId)) continue;
        const range = hasRange
          ? getItemDateRange(item, board.ganttStartColumnId!, board.ganttDurationColumnId!)
          : null;
        const list = byUser.get(assignment.userId) ?? [];
        list.push({
          boardId: board.id,
          boardName: board.name,
          itemId: item.id,
          itemName: item.name,
          allocationPct: assignment.allocationPct,
          startDate: range?.start ?? null,
          endDate: range?.end ?? null,
        });
        byUser.set(assignment.userId, list);
      }
    }
  }

  return byUser;
}

/** Merges each board's per-day load-by-user map into one cross-board map. */
export function computeCrossBoardDailyLoad(
  boards: BoardWithData[],
  userIds: string[]
): Map<string, Map<string, number>> {
  const idSet = new Set(userIds);
  const merged = new Map<string, Map<string, number>>();

  for (const board of boards) {
    if (!board.ganttStartColumnId || !board.ganttDurationColumnId) continue;
    const dailyLoad = computeDailyLoadByUser(
      board.items,
      board.ganttStartColumnId,
      board.ganttDurationColumnId
    );
    for (const [userId, dayMap] of dailyLoad) {
      if (!idSet.has(userId)) continue;
      const target = merged.get(userId) ?? new Map<string, number>();
      for (const [date, pct] of dayMap) {
        target.set(date, (target.get(date) ?? 0) + pct);
      }
      merged.set(userId, target);
    }
  }

  return merged;
}

export type MonthBucket = { label: string; days: string[] };

/**
 * Calendar-month buckets spanning every item's date range across the given
 * boards (capped at 12 months). Falls back to the current month if no item
 * has a resolvable date range.
 */
export function computeMonthBuckets(boards: BoardWithData[]): MonthBucket[] {
  let min: Date | null = null;
  let max: Date | null = null;

  for (const board of boards) {
    if (!board.ganttStartColumnId || !board.ganttDurationColumnId) continue;
    for (const item of board.items) {
      const range = getItemDateRange(item, board.ganttStartColumnId, board.ganttDurationColumnId);
      if (!range) continue;
      if (!min || range.start < min) min = range.start;
      if (!max || range.end > max) max = range.end;
    }
  }

  const today = new Date(new Date().toISOString().slice(0, 10));
  if (!min || !max) {
    min = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    max = min;
  }

  const buckets: MonthBucket[] = [];
  let cursor = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1));
  const end = new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth(), 1));

  while (cursor <= end && buckets.length < 12) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    buckets.push({
      label: `${year}/${month + 1}`,
      days: Array.from({ length: daysInMonth }, (_, i) => toIsoDate(addDays(firstOfMonth, i))),
    });
    cursor = new Date(Date.UTC(year, month + 1, 1));
  }

  return buckets;
}

export type MemberMonthlyUtilization = { userId: string; months: { label: string; avgPct: number }[] };

/** Per-user average allocation % for each month bucket, using the same cross-board daily load. */
export function computeMonthlyUtilization(
  boards: BoardWithData[],
  userIds: string[],
  buckets: MonthBucket[]
): MemberMonthlyUtilization[] {
  const dailyLoad = computeCrossBoardDailyLoad(boards, userIds);

  return userIds.map((userId) => {
    const dayMap = dailyLoad.get(userId);
    const months = buckets.map((bucket) => {
      const sum = bucket.days.reduce((acc, date) => acc + (dayMap?.get(date) ?? 0), 0);
      return { label: bucket.label, avgPct: Math.round(sum / bucket.days.length) };
    });
    return { userId, months };
  });
}
