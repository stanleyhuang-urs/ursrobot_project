function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Weekend, or a date in the given holiday set (company-wide, "YYYY-MM-DD"). */
export function isNonWorkingDay(date: Date, holidays: Set<string> = new Set()): boolean {
  return isWeekend(date) || holidays.has(toIsoDate(date));
}

/**
 * Adds business days (Mon-Fri, excluding the given holidays) to a start
 * date, counting the start date itself as day 1 — i.e.
 * addBusinessDays(start, 1) === start.
 */
export function addBusinessDays(start: Date, days: number, holidays: Set<string> = new Set()): Date {
  const result = new Date(start);
  let remaining = Math.max(0, Math.round(days) - 1);
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!isNonWorkingDay(result, holidays)) remaining--;
  }
  return result;
}

/**
 * Counts business days (Mon-Fri, excluding the given holidays) between two
 * dates, inclusive of both ends. Returns null if end is before start.
 */
export function countBusinessDays(start: Date, end: Date, holidays: Set<string> = new Set()): number | null {
  if (end.getTime() < start.getTime()) return null;
  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    if (!isNonWorkingDay(cursor, holidays)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
