import type { ItemData } from "@/types/board";

export type DateRange = { start: Date; end: Date };

/**
 * Reads the item's start-date and duration-day cell values and turns them
 * into a concrete [start, end] range. Returns null if either value is
 * missing — such items are not plotted on the Gantt chart.
 */
export function getItemDateRange(
  item: ItemData,
  startColumnId: string,
  durationColumnId: string
): DateRange | null {
  const startValue = item.cellValues.find((cv) => cv.columnId === startColumnId)?.value;
  const durationValue = item.cellValues.find((cv) => cv.columnId === durationColumnId)?.value;

  if (typeof startValue !== "string" || typeof durationValue !== "number") return null;
  if (durationValue <= 0) return null;

  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start);
  end.setDate(end.getDate() + durationValue - 1);

  return { start, end };
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * For every item with a resolvable date range, spreads each of its
 * assignments' allocationPct across every day in that range, accumulated
 * per user. Used to detect days where a person is assigned over 100%.
 */
export function computeDailyLoadByUser(
  items: ItemData[],
  startColumnId: string,
  durationColumnId: string
): Map<string, Map<string, number>> {
  const loadByUser = new Map<string, Map<string, number>>();

  for (const item of items) {
    if (item.assignments.length === 0) continue;
    const range = getItemDateRange(item, startColumnId, durationColumnId);
    if (!range) continue;

    for (const assignment of item.assignments) {
      let dayMap = loadByUser.get(assignment.userId);
      if (!dayMap) {
        dayMap = new Map();
        loadByUser.set(assignment.userId, dayMap);
      }

      const cursor = new Date(range.start);
      while (cursor <= range.end) {
        const key = toIsoDate(cursor);
        dayMap.set(key, (dayMap.get(key) ?? 0) + assignment.allocationPct);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  return loadByUser;
}
