import { describe, expect, it } from "vitest";
import { buildWbsIndexFromItems, computeScheduledRange } from "./predecessorLink";

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

describe("computeScheduledRange", () => {
  const predRange = { start: new Date("2026-07-20"), end: new Date("2026-07-24") };

  it("FS: starts the day after the predecessor finishes", () => {
    const result = computeScheduledRange(predRange, 5, "FS", 0, "CALENDAR", new Set());
    expect(iso(result!.start)).toBe("2026-07-25");
    expect(iso(result!.end)).toBe("2026-07-29");
  });

  it("SS: starts alongside the predecessor's start", () => {
    const result = computeScheduledRange(predRange, 5, "SS", 0, "CALENDAR", new Set());
    expect(iso(result!.start)).toBe("2026-07-20");
    expect(iso(result!.end)).toBe("2026-07-24");
  });

  it("FF: finishes alongside the predecessor's finish, start derived backward", () => {
    const result = computeScheduledRange(predRange, 5, "FF", 0, "CALENDAR", new Set());
    expect(iso(result!.start)).toBe("2026-07-20");
    expect(iso(result!.end)).toBe("2026-07-24");
  });

  it("SF: finishes alongside the predecessor's start, start derived backward", () => {
    const result = computeScheduledRange(predRange, 5, "SF", 0, "CALENDAR", new Set());
    expect(iso(result!.start)).toBe("2026-07-16");
    expect(iso(result!.end)).toBe("2026-07-20");
  });

  it("applies lag as an extra day offset on top of the relationship anchor", () => {
    const result = computeScheduledRange(predRange, 5, "FS", 2, "CALENDAR", new Set());
    expect(iso(result!.start)).toBe("2026-07-27");
  });

  it("returns null when days is missing or negative", () => {
    expect(computeScheduledRange(predRange, -1, "FS", 0, "CALENDAR", new Set())).toBeNull();
  });

  it("BUSINESS mode skips weekends when placing FS", () => {
    // Fri 2026-07-17 predecessor finish -> next business day is Mon 2026-07-20.
    const fridayFinishRange = { start: new Date("2026-07-13"), end: new Date("2026-07-17") };
    const result = computeScheduledRange(fridayFinishRange, 5, "FS", 0, "BUSINESS", new Set());
    expect(iso(result!.start)).toBe("2026-07-20");
    expect(iso(result!.end)).toBe("2026-07-24");
  });

  it("BUSINESS mode skips weekends when applying lag", () => {
    const mondayStartRange = { start: new Date("2026-07-13"), end: new Date("2026-07-17") };
    const result = computeScheduledRange(mondayStartRange, 5, "SS", 3, "BUSINESS", new Set());
    expect(iso(result!.start)).toBe("2026-07-16");
  });
});

describe("buildWbsIndexFromItems", () => {
  it("assigns dotted WBS codes matching parent/order structure", () => {
    const items = [
      { id: "a", parentId: null, order: 0 },
      { id: "a1", parentId: "a", order: 0 },
      { id: "a2", parentId: "a", order: 1 },
      { id: "b", parentId: null, order: 1 },
    ];
    const { wbsByItemId, itemIdByWbs } = buildWbsIndexFromItems(items);
    expect(wbsByItemId.get("a")).toBe("1");
    expect(wbsByItemId.get("a1")).toBe("1.1");
    expect(wbsByItemId.get("a2")).toBe("1.2");
    expect(wbsByItemId.get("b")).toBe("2");
    expect(itemIdByWbs.get("1.2")).toBe("a2");
  });
});
