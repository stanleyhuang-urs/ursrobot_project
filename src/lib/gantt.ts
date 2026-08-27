import type { GanttDurationMode } from "@prisma/client";
import type { ItemData } from "@/types/board";
import { getPersonIds } from "@/types/column";
import { addBusinessDays, isNonWorkingDay } from "@/lib/workday";

export type DateRange = { start: Date; end: Date };

/**
 * Reads the item's start-date and duration-day cell values and turns them
 * into a concrete [start, end] range. Returns null if either value is
 * missing — such items are not plotted on the Gantt chart. A 0-day duration
 * (a milestone with no length of its own) still counts as a valid range,
 * occupying just its start date. In "BUSINESS" mode the end date skips
 * weekends and the given holidays instead of counting plain calendar days.
 */
export function getItemDateRange(
  item: Pick<ItemData, "cellValues">,
  startColumnId: string,
  durationColumnId: string,
  mode: GanttDurationMode = "CALENDAR",
  holidays: Set<string> = new Set()
): DateRange | null {
  const startValue = item.cellValues.find((cv) => cv.columnId === startColumnId)?.value;
  const durationValue = item.cellValues.find((cv) => cv.columnId === durationColumnId)?.value;

  if (typeof startValue !== "string" || typeof durationValue !== "number") return null;
  if (durationValue < 0) return null;

  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return null;

  if (mode === "BUSINESS") {
    return { start, end: addBusinessDays(start, Math.max(durationValue, 1), holidays) };
  }

  const end = new Date(start);
  end.setDate(end.getDate() + Math.max(durationValue - 1, 0));

  return { start, end };
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * For every item with a resolvable date range, spreads each assignee's load
 * across every day in that range, accumulated per user. An assignee is a
 * Gantt Assignment (real allocationPct) or a PERSON-column value (負責人/
 * Resource, no allocation of its own so it's spread at 100% unless a real
 * Assignment already covers that user) — the same two mechanisms
 * isItemAssignedToUser treats as equivalent everywhere else. Used to detect
 * days where a person is assigned over 100%.
 */
export function computeDailyLoadByUser(
  items: ItemData[],
  startColumnId: string,
  durationColumnId: string,
  personColumnIds: string[] = [],
  mode: GanttDurationMode = "CALENDAR",
  holidays: Set<string> = new Set()
): Map<string, Map<string, number>> {
  const loadByUser = new Map<string, Map<string, number>>();

  function addLoad(userId: string, range: DateRange, pct: number) {
    let dayMap = loadByUser.get(userId);
    if (!dayMap) {
      dayMap = new Map();
      loadByUser.set(userId, dayMap);
    }
    const cursor = new Date(range.start);
    while (cursor <= range.end) {
      if (mode !== "BUSINESS" || !isNonWorkingDay(cursor, holidays)) {
        const key = toIsoDate(cursor);
        dayMap.set(key, (dayMap.get(key) ?? 0) + pct);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  for (const item of items) {
    const range = getItemDateRange(item, startColumnId, durationColumnId, mode, holidays);
    if (!range) continue;

    const coveredByAssignment = new Set<string>();
    for (const assignment of item.assignments) {
      addLoad(assignment.userId, range, assignment.allocationPct);
      coveredByAssignment.add(assignment.userId);
    }

    const personIds = item.cellValues
      .filter((cv) => personColumnIds.includes(cv.columnId))
      .flatMap((cv) => getPersonIds(cv.value));
    for (const userId of personIds) {
      if (coveredByAssignment.has(userId)) continue;
      addLoad(userId, range, 100);
    }
  }

  return loadByUser;
}
