import type { GanttDurationMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStatusOptions } from "@/types/column";
import type { ItemData } from "@/types/board";
import { getItemDateRange, type DateRange } from "@/lib/gantt";
import { shiftDate } from "@/lib/workday";
import { listHolidays, toHolidaySet } from "@/lib/holidays";

export type RelationshipType = "FS" | "FF" | "SS" | "SF";
const RELATIONSHIP_TYPES: RelationshipType[] = ["FS", "FF", "SS", "SF"];

/**
 * Rebuilds each item's WBS-style code (e.g. "1.3.4") from its parent/order
 * structure — pure, no DB access, so it can run identically client-side
 * (against already-loaded board.items) or server-side.
 */
export function buildWbsIndexFromItems(
  items: { id: string; parentId: string | null; order: number }[]
): { wbsByItemId: Map<string, string>; itemIdByWbs: Map<string, string> } {
  const childrenByParent = new Map<string | null, typeof items>();
  for (const item of items) {
    const list = childrenByParent.get(item.parentId) ?? [];
    list.push(item);
    childrenByParent.set(item.parentId, list);
  }
  for (const list of childrenByParent.values()) list.sort((a, b) => a.order - b.order);

  const wbsByItemId = new Map<string, string>();
  function assign(parentId: string | null, prefix: string) {
    const kids = childrenByParent.get(parentId) ?? [];
    kids.forEach((kid, idx) => {
      const code = prefix ? `${prefix}.${idx + 1}` : String(idx + 1);
      wbsByItemId.set(kid.id, code);
      assign(kid.id, code);
    });
  }
  assign(null, "");

  const itemIdByWbs = new Map<string, string>();
  for (const [id, code] of wbsByItemId) itemIdByWbs.set(code, id);

  return { wbsByItemId, itemIdByWbs };
}

export async function buildWbsIndex(boardId: string) {
  const items = await prisma.item.findMany({
    where: { boardId },
    select: { id: true, parentId: true, order: true },
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

/**
 * For every item whose Pred resolves to a real predecessor and whose Link
 * resolves to a valid relationship type, which of its Start/Finish is
 * computed (and therefore not manually editable). Pure — safe to call
 * client-side against already-loaded items, or server-side.
 */
export function resolveLockedScheduleFields(
  items: Pick<ItemData, "id" | "parentId" | "order" | "cellValues">[],
  predColumnId: string,
  linkColumnId: string,
  linkColumnOptions: unknown
): Map<string, { startLocked: boolean; endLocked: boolean }> {
  const { itemIdByWbs } = buildWbsIndexFromItems(items);
  const linkOptions = getStatusOptions(linkColumnOptions);
  const result = new Map<string, { startLocked: boolean; endLocked: boolean }>();

  for (const item of items) {
    const predValue = item.cellValues.find((cv) => cv.columnId === predColumnId)?.value;
    if (typeof predValue !== "string" || !predValue) continue;
    const predItemId = itemIdByWbs.get(predValue);
    if (!predItemId || predItemId === item.id) continue;

    const linkValue = item.cellValues.find((cv) => cv.columnId === linkColumnId)?.value;
    const label = linkOptions.find((o) => o.id === linkValue)?.label;
    if (label === "FS" || label === "SS") {
      result.set(item.id, { startLocked: true, endLocked: false });
    } else if (label === "FF" || label === "SF") {
      result.set(item.id, { startLocked: false, endLocked: true });
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
      select: { id: true, parentId: true, order: true, cellValues: true },
    }),
    listHolidays(),
  ]);
  const linkOptions = getStatusOptions(linkColumn?.options);
  const holidays = toHolidaySet(holidayRows);
  const { itemIdByWbs, wbsByItemId } = buildWbsIndexFromItems(items);
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
    return typeof predValue === "string" ? itemIdByWbs.get(predValue) : undefined;
  }

  function dependentsOf(id: string): string[] {
    const wbs = wbsByItemId.get(id);
    if (!wbs) return [];
    return items
      .filter((i) => i.id !== id && i.cellValues.some((cv) => cv.columnId === predColumnId && cv.value === wbs))
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
