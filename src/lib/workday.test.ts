import { describe, expect, it } from "vitest";
import { addBusinessDays, countBusinessDays, shiftDate } from "./workday";

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

describe("shiftDate", () => {
  it("CALENDAR mode shifts forward and backward by plain days", () => {
    expect(iso(shiftDate(new Date("2026-07-17"), 3, "CALENDAR"))).toBe("2026-07-20");
    expect(iso(shiftDate(new Date("2026-07-17"), -3, "CALENDAR"))).toBe("2026-07-14");
    expect(iso(shiftDate(new Date("2026-07-17"), 0, "CALENDAR"))).toBe("2026-07-17");
  });

  it("BUSINESS mode skips weekends going forward", () => {
    // Fri 2026-07-17 + 1 business day -> Mon 2026-07-20 (skips Sat/Sun).
    expect(iso(shiftDate(new Date("2026-07-17"), 1, "BUSINESS"))).toBe("2026-07-20");
    expect(iso(shiftDate(new Date("2026-07-17"), 3, "BUSINESS"))).toBe("2026-07-22");
  });

  it("BUSINESS mode skips weekends going backward", () => {
    // Fri 2026-07-24 - 3 business days -> Tue 2026-07-21 (skips the weekend).
    expect(iso(shiftDate(new Date("2026-07-24"), -3, "BUSINESS"))).toBe("2026-07-21");
  });

  it("BUSINESS mode also skips holidays in either direction", () => {
    const holidays = new Set(["2026-07-20"]);
    expect(iso(shiftDate(new Date("2026-07-17"), 1, "BUSINESS", holidays))).toBe("2026-07-21");
  });
});
