import { prisma } from "@/lib/prisma";

/** Company-wide holiday list (not scoped to a board), used by business-day
 *  duration calculations to skip these dates in addition to weekends. */
export async function listHolidays() {
  return prisma.holiday.findMany({ orderBy: { date: "asc" } });
}

export function toHolidaySet(holidays: { date: string }[]): Set<string> {
  return new Set(holidays.map((h) => h.date));
}
