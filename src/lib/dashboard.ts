import type { BoardWithData, UserOption } from "@/types/board";
import { getPersonIds, getStatusOptions, type StatusOption } from "@/types/column";
import { getItemDateRange, computeDailyLoadByUser } from "@/lib/gantt";

function todayUtc(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type TeamWorkloadEntry = { userId: string; userName: string; todayPct: number };

/** Sums each user's today's allocation % across every board that has Gantt columns configured. */
export function computeTeamWorkload(
  boards: BoardWithData[],
  users: UserOption[]
): TeamWorkloadEntry[] {
  const today = toIsoDate(todayUtc());
  const totals = new Map<string, number>();

  for (const board of boards) {
    if (!board.ganttStartColumnId || !board.ganttDurationColumnId) continue;
    const dailyLoad = computeDailyLoadByUser(
      board.items,
      board.ganttStartColumnId,
      board.ganttDurationColumnId
    );
    for (const [userId, dayMap] of dailyLoad) {
      const pct = dayMap.get(today) ?? 0;
      totals.set(userId, (totals.get(userId) ?? 0) + pct);
    }
  }

  return users
    .map((u) => ({ userId: u.id, userName: u.name, todayPct: totals.get(u.id) ?? 0 }))
    .sort((a, b) => b.todayPct - a.todayPct);
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

export type PersonalItemEntry = {
  boardId: string;
  boardName: string;
  itemId: string;
  itemName: string;
  status: StatusOption | null;
  dueDate: Date | null;
};

/** Items assigned to a user, either via a PERSON column or a Gantt Assignment, across all boards. */
export function computePersonalItems(boards: BoardWithData[], userId: string): PersonalItemEntry[] {
  const result: PersonalItemEntry[] = [];

  for (const board of boards) {
    const statusColumn = board.columns.find((c) => c.type === "STATUS");
    const statusOptions = statusColumn ? getStatusOptions(statusColumn.options) : [];

    for (const item of board.items) {
      const viaPerson = item.cellValues.some(
        (cv) => board.columns.find((c) => c.id === cv.columnId)?.type === "PERSON" && getPersonIds(cv.value).includes(userId)
      );
      const viaAssignment = item.assignments.some((a) => a.userId === userId);
      if (!viaPerson && !viaAssignment) continue;

      const statusValue = statusColumn
        ? item.cellValues.find((cv) => cv.columnId === statusColumn.id)?.value
        : null;
      const status = statusOptions.find((o) => o.id === statusValue) ?? null;

      const dueDate =
        board.ganttStartColumnId && board.ganttDurationColumnId
          ? getItemDateRange(item, board.ganttStartColumnId, board.ganttDurationColumnId)?.end ?? null
          : null;

      result.push({
        boardId: board.id,
        boardName: board.name,
        itemId: item.id,
        itemName: item.name,
        status,
        dueDate,
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
