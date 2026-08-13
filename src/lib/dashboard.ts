import type { BoardWithData, UserOption } from "@/types/board";
import { getPersonIds, getStatusOptions, type StatusOption } from "@/types/column";
import { getItemDateRange, computeDailyLoadByUser } from "@/lib/gantt";

export type WorkloadPeriod = "day" | "week" | "month";

function todayUtc(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** All dates (inclusive) covering the requested period, anchored on today. */
function datesForPeriod(period: WorkloadPeriod): Date[] {
  const today = todayUtc();
  if (period === "day") return [today];

  if (period === "week") {
    const dayOfWeek = today.getUTCDay(); // 0 = Sunday
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = addDays(today, mondayOffset);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }

  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, i) => addDays(firstOfMonth, i));
}

export type TeamWorkloadEntry = { userId: string; userName: string; avgPct: number };

/**
 * Each user's average allocation % across the requested period (day/week/month),
 * summed across every board that has Gantt columns configured.
 */
export function computeTeamWorkload(
  boards: BoardWithData[],
  users: UserOption[],
  period: WorkloadPeriod = "day"
): TeamWorkloadEntry[] {
  const dates = datesForPeriod(period).map(toIsoDate);
  const totals = new Map<string, number>();

  for (const board of boards) {
    if (!board.ganttStartColumnId || !board.ganttDurationColumnId) continue;
    const dailyLoad = computeDailyLoadByUser(
      board.items,
      board.ganttStartColumnId,
      board.ganttDurationColumnId
    );
    for (const [userId, dayMap] of dailyLoad) {
      const sum = dates.reduce((acc, date) => acc + (dayMap.get(date) ?? 0), 0);
      totals.set(userId, (totals.get(userId) ?? 0) + sum);
    }
  }

  return users
    .map((u) => ({
      userId: u.id,
      userName: u.name,
      avgPct: Math.round((totals.get(u.id) ?? 0) / dates.length),
    }))
    .sort((a, b) => b.avgPct - a.avgPct);
}

export type MemberItemWorkloadEntry = {
  boardId: string;
  boardName: string;
  itemId: string;
  itemName: string;
  avgPct: number;
};

/**
 * For one user, each of their assigned items' average allocation % across the
 * requested period (day/week/month) — only counting days the item's Gantt
 * date range actually overlaps the period. Used for the per-person pie
 * breakdown in the team workload overview.
 */
export function computeMemberItemWorkload(
  boards: BoardWithData[],
  userId: string,
  period: WorkloadPeriod = "day"
): MemberItemWorkloadEntry[] {
  const dates = new Set(datesForPeriod(period).map(toIsoDate));
  const entries: MemberItemWorkloadEntry[] = [];

  for (const board of boards) {
    if (!board.ganttStartColumnId || !board.ganttDurationColumnId) continue;
    for (const item of board.items) {
      const assignment = item.assignments.find((a) => a.userId === userId);
      if (!assignment) continue;
      const range = getItemDateRange(item, board.ganttStartColumnId, board.ganttDurationColumnId);
      if (!range) continue;

      let activeDays = 0;
      const cursor = new Date(range.start);
      while (cursor <= range.end) {
        if (dates.has(toIsoDate(cursor))) activeDays++;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      if (activeDays === 0) continue;

      entries.push({
        boardId: board.id,
        boardName: board.name,
        itemId: item.id,
        itemName: item.name,
        avgPct: Math.round((assignment.allocationPct * activeDays) / dates.size),
      });
    }
  }

  return entries.sort((a, b) => b.avgPct - a.avgPct);
}

export type BoardProgressEntry = {
  boardId: string;
  boardName: string;
  itemCount: number;
  statusBreakdown: { option: StatusOption; count: number }[];
  avgProgress: number | null;
};

/** Per-board item count, status breakdown (first STATUS column), and average progress. */
export function computeBoardProgressOverview(boards: BoardWithData[]): BoardProgressEntry[] {
  return boards.map((board) => {
    const statusColumn = board.columns.find((c) => c.type === "STATUS");
    const statusOptions = statusColumn ? getStatusOptions(statusColumn.options) : [];
    const statusBreakdown = statusOptions.map((option) => ({
      option,
      count: board.items.filter((item) =>
        item.cellValues.some(
          (cv) => cv.columnId === statusColumn!.id && cv.value === option.id
        )
      ).length,
    }));

    let avgProgress: number | null = null;
    if (board.progressColumnId) {
      const values = board.items
        .map((item) =>
          item.cellValues.find((cv) => cv.columnId === board.progressColumnId)?.value
        )
        .filter((v): v is number => typeof v === "number");
      if (values.length > 0) {
        avgProgress = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    return {
      boardId: board.id,
      boardName: board.name,
      itemCount: board.items.length,
      statusBreakdown,
      avgProgress,
    };
  });
}

export type DueItemEntry = {
  boardId: string;
  boardName: string;
  itemId: string;
  itemName: string;
  end: Date;
};

/** Items whose Gantt end date has passed (overdue) or falls within the next 7 days (upcoming). */
export function computeOverdueUpcoming(boards: BoardWithData[]): {
  overdue: DueItemEntry[];
  upcoming: DueItemEntry[];
} {
  const today = todayUtc();
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const overdue: DueItemEntry[] = [];
  const upcoming: DueItemEntry[] = [];

  for (const board of boards) {
    if (!board.ganttStartColumnId || !board.ganttDurationColumnId) continue;
    for (const item of board.items) {
      const range = getItemDateRange(item, board.ganttStartColumnId, board.ganttDurationColumnId);
      if (!range) continue;
      const entry = { boardId: board.id, boardName: board.name, itemId: item.id, itemName: item.name, end: range.end };
      if (range.end < today) overdue.push(entry);
      else if (range.end <= weekAhead) upcoming.push(entry);
    }
  }

  overdue.sort((a, b) => a.end.getTime() - b.end.getTime());
  upcoming.sort((a, b) => a.end.getTime() - b.end.getTime());
  return { overdue, upcoming };
}

export type PersonalItemAssignee = { name: string; allocationPct: number | null };

export type PersonalItemEntry = {
  boardId: string;
  boardName: string;
  itemId: string;
  itemName: string;
  status: StatusOption | null;
  startDate: Date | null;
  dueDate: Date | null;
  assignees: PersonalItemAssignee[];
};

/**
 * Items assigned to any of the given users, either via a PERSON column or a
 * Gantt Assignment, across all boards. Pass a single id for "my items"; pass
 * a team's ids to see everyone's items at once (assignees disambiguates who,
 * and at what allocation % when known from a Gantt Assignment).
 */
export function computePersonalItems(
  boards: BoardWithData[],
  userIds: string[],
  userById: Map<string, string> = new Map()
): PersonalItemEntry[] {
  const idSet = new Set(userIds);
  const result: PersonalItemEntry[] = [];

  for (const board of boards) {
    const statusColumn = board.columns.find((c) => c.type === "STATUS");
    const statusOptions = statusColumn ? getStatusOptions(statusColumn.options) : [];

    for (const item of board.items) {
      const personIds = item.cellValues
        .filter((cv) => board.columns.find((c) => c.id === cv.columnId)?.type === "PERSON")
        .flatMap((cv) => getPersonIds(cv.value))
        .filter((id) => idSet.has(id));
      const matchedAssignments = item.assignments.filter((a) => idSet.has(a.userId));
      if (personIds.length === 0 && matchedAssignments.length === 0) continue;

      const allocationByUser = new Map<string, number | null>();
      for (const id of personIds) allocationByUser.set(id, null);
      for (const a of matchedAssignments) allocationByUser.set(a.userId, a.allocationPct);

      const statusValue = statusColumn
        ? item.cellValues.find((cv) => cv.columnId === statusColumn.id)?.value
        : null;
      const status = statusOptions.find((o) => o.id === statusValue) ?? null;

      const range =
        board.ganttStartColumnId && board.ganttDurationColumnId
          ? getItemDateRange(item, board.ganttStartColumnId, board.ganttDurationColumnId)
          : null;

      result.push({
        boardId: board.id,
        boardName: board.name,
        itemId: item.id,
        itemName: item.name,
        status,
        startDate: range?.start ?? null,
        dueDate: range?.end ?? null,
        assignees: [...allocationByUser.entries()]
          .map(([id, allocationPct]) => ({ name: userById.get(id) ?? "", allocationPct }))
          .filter((a) => a.name),
      });
    }
  }

  result.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });
  return result;
}
