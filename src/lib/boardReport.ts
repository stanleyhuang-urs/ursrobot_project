import type { BoardWithData, ItemData, UserOption } from "@/types/board";
import { getPersonIds } from "@/types/column";

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

// Same 6 buckets and colors as the stat cards above the charts (BoardReport's
// StatCard row) — every other status visualization reuses this one mapping
// so a bucket always means the same label/color everywhere in the report.
const BUCKET_ORDER = ["notStarted", "planned", "inProgress", "paused", "stuck", "done"] as const;
type BucketKey = (typeof BUCKET_ORDER)[number];
const BUCKET_LABELS: Record<BucketKey, string> = {
  notStarted: "尚未處理",
  planned: "計畫中",
  inProgress: "進行中",
  paused: "暫停",
  stuck: "卡住",
  done: "已完成",
};
const BUCKET_COLORS: Record<BucketKey, string> = {
  notStarted: "#c4c4c4",
  planned: "#579bfc",
  inProgress: "#fdab3d",
  paused: "#a25ddc",
  stuck: "#e2445c",
  done: "#00c875",
};

export type BucketSlice = { key: BucketKey; label: string; color: string; count: number };

/** Turns a bucket-counts object into the non-empty slices to plot, in a
 *  fixed order, so callers never have to know the bucket keys/colors. */
export function bucketSlices(buckets: StatusBucketCounts): BucketSlice[] {
  return BUCKET_ORDER.map((key) => ({
    key,
    label: BUCKET_LABELS[key],
    color: BUCKET_COLORS[key],
    count: buckets[key],
  })).filter((s) => s.count > 0);
}

export type OwnerBucketBreakdown = { userId: string; userName: string; total: number; slices: BucketSlice[] };

/** Per-user status-bucket breakdown (PERSON column + Gantt Assignment,
 *  deduped per item) — same bucket classification as computeStatusBuckets,
 *  just scoped to each owner's own items instead of the whole board. */
export function computeTasksByOwnerBuckets(
  board: BoardWithData,
  items: ItemData[],
  users: UserOption[]
): OwnerBucketBreakdown[] {
  const itemsByOwner = new Map<string, ItemData[]>();
  for (const item of items) {
    for (const id of itemOwnerIds(item, board)) {
      const list = itemsByOwner.get(id) ?? [];
      list.push(item);
      itemsByOwner.set(id, list);
    }
  }
  return users
    .map((u) => {
      const ownerItems = itemsByOwner.get(u.id) ?? [];
      const buckets = computeStatusBuckets(board, ownerItems);
      return { userId: u.id, userName: u.name, total: buckets.total, slices: bucketSlices(buckets) };
    })
    .filter((o) => o.total > 0)
    .sort((a, b) => b.total - a.total);
}
