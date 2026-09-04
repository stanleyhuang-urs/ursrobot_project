import { describe, expect, it } from "vitest";
import { computeRolledUpDateRange, hasOwnScheduleRule } from "./gantt";

const START = "startCol";
const DAYS = "daysCol";
const PRED = "predCol";
const MANUAL_START = "startSetCol";

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Minimal item shape computeRolledUpDateRange reads. */
function item(
  id: string,
  parentId: string | null,
  cells: Record<string, string | number>
) {
  return {
    id,
    parentId,
    cellValues: Object.entries(cells).map(([columnId, value]) => ({ columnId, value })),
  } as never;
}

const RULE_COLUMNS = { predColumnId: PRED, manualStartColumnId: MANUAL_START };

describe("hasOwnScheduleRule", () => {
  it("is true when a Pred is set", () => {
    expect(hasOwnScheduleRule(item("a", null, { [PRED]: "1.2" }), RULE_COLUMNS)).toBe(true);
  });

  it("is true when a manual start is set", () => {
    expect(hasOwnScheduleRule(item("a", null, { [MANUAL_START]: "2026-08-03" }), RULE_COLUMNS)).toBe(true);
  });

  it("is false for blank values, and when no rule columns are configured", () => {
    expect(hasOwnScheduleRule(item("a", null, { [PRED]: "  " }), RULE_COLUMNS)).toBe(false);
    expect(hasOwnScheduleRule(item("a", null, {}), RULE_COLUMNS)).toBe(false);
    expect(hasOwnScheduleRule(item("a", null, { [PRED]: "1.2" }), undefined)).toBe(false);
  });
});

describe("computeRolledUpDateRange", () => {
  // A parent whose own dates are 8/3–9/1, with children sitting outside it.
  const parentCells = { [START]: "2026-08-03", [DAYS]: 30 };
  const child = item("child", "parent", { [START]: "2026-09-04", [DAYS]: 2 });

  it("rolls a plain summary up from its children", () => {
    const parent = item("parent", null, parentCells);
    const range = computeRolledUpDateRange(parent, [parent, child], START, DAYS, "CALENDAR", new Set(), RULE_COLUMNS);
    expect(iso(range!.start)).toBe("2026-09-04");
    expect(iso(range!.end)).toBe("2026-09-05");
  });

  it("keeps a Pred-driven summary's own dates instead of rolling up", () => {
    const parent = item("parent", null, { ...parentCells, [PRED]: "1.6.1" });
    const range = computeRolledUpDateRange(parent, [parent, child], START, DAYS, "CALENDAR", new Set(), RULE_COLUMNS);
    expect(iso(range!.start)).toBe("2026-08-03");
    expect(iso(range!.end)).toBe("2026-09-01");
  });

  it("keeps a summary's own dates when it has a manual start", () => {
    const parent = item("parent", null, { ...parentCells, [MANUAL_START]: "2026-08-03" });
    const range = computeRolledUpDateRange(parent, [parent, child], START, DAYS, "CALENDAR", new Set(), RULE_COLUMNS);
    expect(iso(range!.start)).toBe("2026-08-03");
  });

  it("still rolls up when the rule columns aren't passed (unchanged callers)", () => {
    const parent = item("parent", null, { ...parentCells, [PRED]: "1.6.1" });
    const range = computeRolledUpDateRange(parent, [parent, child], START, DAYS);
    expect(iso(range!.start)).toBe("2026-09-04");
  });

  it("falls back to the rollup when a rule-bearing summary has no own dates", () => {
    const parent = item("parent", null, { [PRED]: "1.6.1" });
    const range = computeRolledUpDateRange(parent, [parent, child], START, DAYS, "CALENDAR", new Set(), RULE_COLUMNS);
    expect(iso(range!.start)).toBe("2026-09-04");
  });

  it("lets a nested rule-bearing summary hold its own dates inside a grandparent's rollup", () => {
    const grandparent = item("gp", null, {});
    const parent = item("parent", "gp", { ...parentCells, [PRED]: "1.6.1" });
    const nestedChild = item("child", "parent", { [START]: "2026-09-04", [DAYS]: 2 });
    const range = computeRolledUpDateRange(
      grandparent,
      [grandparent, parent, nestedChild],
      START,
      DAYS,
      "CALENDAR",
      new Set(),
      RULE_COLUMNS
    );
    expect(iso(range!.start)).toBe("2026-08-03");
    expect(iso(range!.end)).toBe("2026-09-01");
  });
});
