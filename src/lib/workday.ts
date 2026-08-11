function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Adds business days (Mon-Fri) to a start date, counting the start date
 * itself as day 1 — i.e. addBusinessDays(start, 1) === start.
 */
export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let remaining = Math.max(0, Math.round(days) - 1);
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!isWeekend(result)) remaining--;
  }
  return result;
}

/**
 * Counts business days (Mon-Fri) between two dates, inclusive of both ends.
 * Returns null if end is before start.
 */
export function countBusinessDays(start: Date, end: Date): number | null {
  if (end.getTime() < start.getTime()) return null;
  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    if (!isWeekend(cursor)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
