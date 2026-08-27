import { describe, expect, it } from "vitest";
import { addBusinessDays, countBusinessDays } from "./workday";

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

describe("addBusinessDays", () => {
  it("treats the start date as day 1", () => {
    expect(iso(addBusinessDays(new Date("2026-07-17"), 1))).toBe("2026-07-17");
  });

  it("skips weekends when counting forward", () => {
    // Fri 2026-07-17 + 5 business days -> Thu 2026-07-23 (skips Sat/Sun)
    expect(iso(addBusinessDays(new Date("2026-07-17"), 5))).toBe("2026-07-23");
    // Fri 2026-07-17 + 15 business days -> Thu 2026-08-06
    expect(iso(addBusinessDays(new Date("2026-07-17"), 15))).toBe("2026-08-06");
  });
});

describe("countBusinessDays", () => {
  it("counts inclusive business days between two dates", () => {
    expect(countBusinessDays(new Date("2026-07-17"), new Date("2026-07-23"))).toBe(5);
    expect(countBusinessDays(new Date("2026-07-17"), new Date("2026-08-06"))).toBe(15);
  });

  it("returns null when end is before start", () => {
    expect(countBusinessDays(new Date("2026-07-23"), new Date("2026-07-17"))).toBeNull();
  });

  it("round-trips with addBusinessDays", () => {
    const start = new Date("2026-08-14");
    const end = addBusinessDays(start, 10);
    expect(countBusinessDays(start, end)).toBe(10);
  });

  it("skips holidays in addition to weekends", () => {
    // Fri 2026-07-17 + 5 business days skips Sat/Sun as well as the
    // Monday 2026-07-20 holiday, landing one day later than the plain case.
    const holidays = new Set(["2026-07-20"]);
    expect(countBusinessDays(new Date("2026-07-17"), new Date("2026-07-23"), holidays)).toBe(4);
    expect(iso(addBusinessDays(new Date("2026-07-17"), 5, holidays))).toBe("2026-07-24");
  });
});
