import type { GanttDurationMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStatusOptions } from "@/types/column";
import type { ItemData } from "@/types/board";
import { getItemDateRange, type DateRange } from "@/lib/gantt";
import { shiftDate } from "@/lib/workday";
import { listHolidays, toHolidaySet } from "@/lib/holidays";

export type RelationshipType = "FS" | "FF" | "SS" | "SF";
const RELATIONSHIP_TYPES: RelationshipType[] = ["FS", "FF", "SS", "SF"];

export type WbsIndex = {
  /** itemId -> its WBS code, LOCAL to its own group (e.g. "1.3.4") — unique
   *  per item, but the same code string is reused by every group (each
   *  group's own top-level items start back at "1"), so this alone is not
   *  enough to resolve a Pred reference; use resolveWbsCode for that. */
  wbsByItemId: Map<string, string>;
  /** `${groupId}:${code}` -> itemId. Internal — use resolveWbsCode. */
  itemIdByGroupWbs: Map<string, string>;
};

/**
 * Rebuilds each item's WBS-style code (e.g. "1.3.4") from its parent/order
 * structure, one independent tree PER GROUP — matching exactly what
 * computeWbsCodes shows the user in the table (each group's own top-level
 * items restart at "1"). A Pred reference like "1.2.2.4" is only meaningful
 * within the referencing item's own group, so codes are intentionally NOT
 * unique board-wide — always resolve them via resolveWbsCode, passing the
 * referencing item's groupId, never by reading itemIdByGroupWbs directly.
 * Pure — no DB access, so it can run identically client-side (against
 * already-loaded board.items) or server-side.
 */
export function buildWbsIndexFromItems(
  items: { id: string; parentId: string | null; order: number; groupId: string }[]
): WbsIndex {
  const wbsByItemId = new Map<string, string>();
  const itemIdByGroupWbs = new Map<string, string>();

  const itemsByGroup = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByGroup.get(item.groupId) ?? [];
    list.push(item);
    itemsByGroup.set(item.groupId, list);
  }

  for (const [groupId, groupItems] of itemsByGroup) {
    const childrenByParent = new Map<string | null, typeof items>();
    for (const item of groupItems) {
      const list = childrenByParent.get(item.parentId) ?? [];
      list.push(item);
      childrenByParent.set(item.parentId, list);
    }
    for (const list of childrenByParent.values()) list.sort((a, b) => a.order - b.order);

    function assign(parentId: string | null, prefix: string) {
      const kids = childrenByParent.get(parentId) ?? [];
      kids.forEach((kid, idx) => {
        const code = prefix ? `${prefix}.${idx + 1}` : String(idx + 1);
        wbsByItemId.set(kid.id, code);
        itemIdByGroupWbs.set(`${groupId}:${code}`, kid.id);
        assign(kid.id, code);
      });
    }
    assign(null, "");
  }

  return { wbsByItemId, itemIdByGroupWbs };
}

/** Resolves a Pred cell's raw WBS-code string to an item id, scoped to
 *  `groupId` (always the referencing item's own group — a Pred reference
 *  can't cross groups, matching the codes as actually displayed per-group). */
export function resolveWbsCode(index: WbsIndex, groupId: string, code: string): string | undefined {
  return index.itemIdByGroupWbs.get(`${groupId}:${code}`);
}

export async function buildWbsIndex(boardId: string) {
  const items = await prisma.item.findMany({
    where: { boardId },
    select: { id: true, parentId: true, order: true, groupId: true },
  });
  return buildWbsIndexFromItems(items);
}

/**
 * This item's Start/Finish, given a predecessor's own [start, end], the
 * relationship type, a lag offset (days, same calendar/business semantics
 * as the board's duration mode — negative lag means lead/overlap), and this
 * item's own duration. FS/SS anchor on Start and derive Finish forward;
 * FF/SF anchor on Finish and derive Start backward.
 */
export function computeScheduledRange(
  predRange: DateRange,
  myDays: number,
  relationship: RelationshipType,
  lag: number,
  mode: GanttDurationMode,
  holidays: Set<string>
): DateRange | null {
  if (!Number.isFinite(myDays) || myDays < 0) return null;
  const span = Math.max(Math.round(myDays) - 1, 0);

  if (relationship === "FS" || relationship === "SS") {
    const start =
      relationship === "FS"
        ? shiftDate(predRange.end, 1 + lag, mode, holidays)
        : shiftDate(predRange.start, lag, mode, holidays);
    return { start, end: shiftDate(start, span, mode, holidays) };
  }

  const end =
    relationship === "FF"
      ? shiftDate(predRange.end, lag, mode, holidays)
      : shiftDate(predRange.start, lag, mode, holidays);
  return { start: shiftDate(end, -span, mode, holidays), end };
}

export type ScheduleLock = { startLocked: boolean; endLocked: boolean; daysLocked: boolean };

/**
 * For every item, which of its Start/Finish/Days is computed elsewhere and
 * therefore not manually editable:
 *  - an item with children has its Start+Finish rolled up from its subtree
 *    (a "Summary" row), regardless of its own Type value
 *  - an item whose Pred resolves to a real predecessor and whose Link
 *    resolves to a valid relationship type has the date that relationship
 *    determines locked (FS/SS -> Start, FF/SF -> Finish)
 *  - an item whose Type resolves to "Milestone" has Days locked at 0
 * Pure — safe to call client-side against already-loaded items, or
 * server-side. typeColumnId/typeColumnOptions are optional since not every
 * board configures a Type column.
 */
export function resolveLockedScheduleFields(
  items: Pick<ItemData, "id" | "parentId" | "order" | "cellValues" | "groupId">[],
  predColumnId?: string | null,
  linkColumnId?: string | null,
  linkColumnOptions?: unknown,
  typeColumnId?: string | null,
  typeColumnOptions?: unknown
): Map<string, ScheduleLock> {
  const wbsIndex = buildWbsIndexFromItems(items);
  const linkOptions = linkColumnId ? getStatusOptions(linkColumnOptions) : [];
  const typeOptions = typeColumnId ? getStatusOptions(typeColumnOptions) : [];

  const childCount = new Map<string, number>();
  for (const item of items) {
    if (item.parentId) childCount.set(item.parentId, (childCount.get(item.parentId) ?? 0) + 1);
  }

  const result = new Map<string, ScheduleLock>();
  function ensure(id: string): ScheduleLock {
    let lock = result.get(id);
    if (!lock) {
      lock = { startLocked: false, endLocked: false, daysLocked: false };
      result.set(id, lock);
    }
    return lock;
  }

  for (const item of items) {
    if ((childCount.get(item.id) ?? 0) > 0) {
      const lock = ensure(item.id);
      lock.startLocked = true;
      lock.endLocked = true;
    }

    if (predColumnId && linkColumnId) {
      const predValue = item.cellValues.find((cv) => cv.columnId === predColumnId)?.value;
      if (typeof predValue === "string" && predValue) {
        const predItemId = resolveWbsCode(wbsIndex, item.groupId, predValue);
        if (predItemId && predItemId !== item.id) {
          const linkValue = item.cellValues.find((cv) => cv.columnId === linkColumnId)?.value;
          const label = linkOptions.find((o) => o.id === linkValue)?.label;
          if (label === "FS" || label === "SS") ensure(item.id).startLocked = true;
          else if (label === "FF" || label === "SF") ensure(item.id).endLocked = true;
        }
      }
    }

    if (typeColumnId) {
      const typeValue = item.cellValues.find((cv) => cv.columnId === typeColumnId)?.value;
      const typeLabel = typeOptions.find((o) => o.id === typeValue)?.label;
      if (typeLabel === "Milestone") ensure(item.id).daysLocked = true;
    }
  }

  return result;
}

/**
 * Loads everything needed to schedule a board's Pred/Link-driven items and
 * returns a `recompute(id, visited)` walker: computes that item's own
 * Start/Finish from its predecessor (if it has a valid one), writes it, then
 * cascades to every item whose Pred points back at it — transitively, with
 * the shared `visited` set guarding against circular references. Shared by
 * `syncPredecessorSchedule` (recompute from one edited item) and
 * `recomputeAllSchedules` (recompute the whole board). Returns null if the
 * board hasn't configured Pred/Link/Start/Days columns.
 */
async function buildScheduleContext(boardId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      predColumnId: true,
      linkColumnId: true,
      lagColumnId: true,
      ganttStartColumnId: true,
      ganttDurationColumnId: true,
      ganttEndColumnId: true,
      ganttDurationMode: true,
    },
  });
  if (!board) return null;
  const { predColumnId, linkColumnId, lagColumnId, ganttEndColumnId: endId, ganttDurationMode: mode } = board;
  if (!predColumnId || !linkColumnId || !board.ganttStartColumnId || !board.ganttDurationColumnId) return null;
  const startId: string = board.ganttStartColumnId;
  const durId: string = board.ganttDurationColumnId;

  const [linkColumn, items, holidayRows] = await Promise.all([
    prisma.column.findUnique({ where: { id: linkColumnId }, select: { options: true } }),
    prisma.item.findMany({
      where: { boardId },
      select: { id: true, parentId: true, order: true, cellValues: true, groupId: true },
    }),
    listHolidays(),
  ]);
  const linkOptions = getStatusOptions(linkColumn?.options);
  const holidays = toHolidaySet(holidayRows);
  const wbsIndex = buildWbsIndexFromItems(items);
  const { wbsByItemId } = wbsIndex;
  const itemsById = new Map(items.map((i) => [i.id, i]));

  // Freshly-computed dates, so a dependent further down the chain reads its
  // predecessor's just-written dates without a mid-walk DB round trip.
  const overrides = new Map<string, DateRange>();

  function readRange(id: string): DateRange | null {
    if (overrides.has(id)) return overrides.get(id)!;
    const item = itemsById.get(id);
    if (!item) return null;
    return getItemDateRange(item, startId, durId, mode, holidays);
  }

  async function writeRange(id: string, range: DateRange) {
    overrides.set(id, range);
    const startIso = range.start.toISOString().slice(0, 10);
    await prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId: id, columnId: startId } },
      create: { itemId: id, columnId: startId, value: startIso },
      update: { value: startIso },
    });
    if (endId) {
      const endIso = range.end.toISOString().slice(0, 10);
      await prisma.cellValue.upsert({
        where: { itemId_columnId: { itemId: id, columnId: endId } },
        create: { itemId: id, columnId: endId, value: endIso },
        update: { value: endIso },
      });
    }
  }

  function predecessorOf(id: string): string | undefined {
    const item = itemsById.get(id);
    const predValue = item?.cellValues.find((cv) => cv.columnId === predColumnId)?.value;
    return item && typeof predValue === "string" ? resolveWbsCode(wbsIndex, item.groupId, predValue) : undefined;
  }

  function dependentsOf(id: string): string[] {
    const item = itemsById.get(id);
    const wbs = item ? wbsByItemId.get(id) : undefined;
    if (!item || !wbs) return [];
    return items
      .filter(
        (i) =>
          i.id !== id &&
          i.groupId === item.groupId &&
          i.cellValues.some((cv) => cv.columnId === predColumnId && cv.value === wbs)
      )
      .map((i) => i.id);
  }

  async function recompute(id: string, visited: Set<string>) {
    if (visited.has(id)) return;
    visited.add(id);

    const item = itemsById.get(id);
    if (item) {
      const predItemId = predecessorOf(id);
      const linkValue = item.cellValues.find((cv) => cv.columnId === linkColumnId)?.value;
      const relationship = linkOptions.find((o) => o.id === linkValue)?.label;
      const lagValue = lagColumnId ? item.cellValues.find((cv) => cv.columnId === lagColumnId)?.value : null;
      const lag = typeof lagValue === "number" ? lagValue : 0;
      const daysValue = item.cellValues.find((cv) => cv.columnId === durId)?.value;
      const myDays = typeof daysValue === "number" ? daysValue : null;

      if (
        predItemId &&
        predItemId !== id &&
        relationship &&
        (RELATIONSHIP_TYPES as string[]).includes(relationship) &&
        myDays !== null
      ) {
        const predRange = readRange(predItemId);
        if (predRange) {
          const scheduled = computeScheduledRange(
            predRange,
            myDays,
            relationship as RelationshipType,
            lag,
            mode,
            holidays
          );
          if (scheduled) await writeRange(id, scheduled);
        }
      }
    }

    for (const depId of dependentsOf(id)) {
      await recompute(depId, visited);
    }
  }

  const ownTriggers = [predColumnId, linkColumnId, lagColumnId, durId].filter((id): id is string => !!id);
  const cascadeTriggers = [startId, endId].filter((id): id is string => !!id);

  return { items, predecessorOf, dependentsOf, recompute, ownTriggers, cascadeTriggers };
}

/**
 * Keeps a board's Pred/Link-driven items scheduled: editing Pred, Link, Lag,
 * or Days on an item recomputes its own Start/Finish from its predecessor;
 * editing Start/Finish (manually, or as a result of this same recompute)
 * cascades to every item whose Pred points back at it.
 */
export async function syncPredecessorSchedule(
  boardId: string,
  itemId: string,
  editedColumnId: string
) {
  const ctx = await buildScheduleContext(boardId);
  if (!ctx) return;
  if (!ctx.ownTriggers.includes(editedColumnId) && !ctx.cascadeTriggers.includes(editedColumnId)) return;

  if (ctx.ownTriggers.includes(editedColumnId)) {
    await ctx.recompute(itemId, new Set());
  } else {
    const visited = new Set([itemId]);
    for (const depId of ctx.dependentsOf(itemId)) await ctx.recompute(depId, visited);
  }
}

/**
 * Recomputes every Pred/Link-driven item on the board from scratch, in
 * dependency order (starting at each chain's root — an item with no
 * resolvable predecessor of its own — then cascading down), so the whole
 * board reflects its current Pred/Link/Lag/Days relationships. Used by the
 * Gantt view's manual "重算全部" button; never runs on its own.
 */
export async function recomputeAllSchedules(boardId: string): Promise<number> {
  const ctx = await buildScheduleContext(boardId);
  if (!ctx) return 0;

  const visited = new Set<string>();
  for (const item of ctx.items) {
    if (!ctx.predecessorOf(item.id)) {
      await ctx.recompute(item.id, visited);
    }
  }
  return visited.size;
}
