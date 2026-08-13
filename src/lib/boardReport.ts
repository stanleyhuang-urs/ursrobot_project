import type { BoardWithData, ItemData, UserOption } from "@/types/board";
import { getPersonIds, getStatusOptions, type StatusOption } from "@/types/column";

/** Every user id considered "responsible" for an item: PERSON column values plus Gantt Assignments. */
export function itemOwnerIds(item: ItemData, board: BoardWithData): string[] {
  const personIds = item.cellValues
    .filter((cv) => board.columns.find((c) => c.id === cv.columnId)?.type === "PERSON")
    .flatMap((cv) => getPersonIds(cv.value));
  const assignmentIds = item.assignments.map((a) => a.userId);
  return [...new Set([...personIds, ...assignmentIds])];
}

/** Items owned by any of the given users; pass null to skip filtering (everyone). */
export function filterItemsByTeam(board: BoardWithData, userIds: string[] | null): ItemData[] {
  if (!userIds) return board.items;
  const idSet = new Set(userIds);
  return board.items.filter((item) => itemOwnerIds(item, board).some((id) => idSet.has(id)));
}

export type StatusBucketCounts = {
  total: number;
  notStarted: number;
  planned: number;
  inProgress: number;
  paused: number;
  stuck: number;
  done: number;
};

/** Splits items into the board's designated report buckets; anything unassigned counts as in-progress. */
export function computeStatusBuckets(board: BoardWithData, items: ItemData[]): StatusBucketCounts {
  const total = items.length;
  if (!board.reportStatusColumnId) {
    return { total, notStarted: 0, planned: 0, inProgress: total, paused: 0, stuck: 0, done: 0 };
  }

  const notStartedSet = new Set(board.reportNotStartedOptionIds);
  const plannedSet = new Set(board.reportPlannedOptionIds);
  const pausedSet = new Set(board.reportPausedOptionIds);
  const stuckSet = new Set(board.reportStuckOptionIds);
  const doneSet = new Set(board.reportDoneOptionIds);

  let notStarted = 0;
  let planned = 0;
  let paused = 0;
  let stuck = 0;
  let done = 0;
  for (const item of items) {
    const value = item.cellValues.find((cv) => cv.columnId === board.reportStatusColumnId)?.value;
    if (typeof value !== "string") continue;
    if (notStartedSet.has(value)) notStarted++;
    else if (plannedSet.has(value)) planned++;
    else if (pausedSet.has(value)) paused++;
    else if (stuckSet.has(value)) stuck++;
    else if (doneSet.has(value)) done++;
  }
  const inProgress = total - notStarted - planned - paused - stuck - done;
  return { total, notStarted, planned, inProgress, paused, stuck, done };
}

export type StatusSliceCount = { option: StatusOption; count: number };

/** Per-option counts for the board's designated report status column. */
export function computeStatusBreakdown(board: BoardWithData, items: ItemData[]): StatusSliceCount[] {
  if (!board.reportStatusColumnId) return [];
  const column = board.columns.find((c) => c.id === board.reportStatusColumnId);
  if (!column) return [];
  const options = getStatusOptions(column.options);
  return options
    .map((option) => ({
      option,
      count: items.filter((item) =>
        item.cellValues.some((cv) => cv.columnId === board.reportStatusColumnId && cv.value === option.id)
      ).length,
    }))
    .filter((s) => s.count > 0);
}

export type OwnerCount = { userId: string; userName: string; count: number };

/** Per-user item counts (PERSON column + Gantt Assignment, deduped per item). */
export function computeTasksByOwner(
  board: BoardWithData,
  items: ItemData[],
  users: UserOption[]
): OwnerCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const id of itemOwnerIds(item, board)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return users
    .map((u) => ({ userId: u.id, userName: u.name, count: counts.get(u.id) ?? 0 }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);
}
