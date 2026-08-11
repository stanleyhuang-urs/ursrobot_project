import { describe, expect, it } from "vitest";
import { classifyRelationship } from "./predecessorLink";

describe("classifyRelationship", () => {
  it("detects FS when this item's start is closest to the predecessor's finish", () => {
    expect(classifyRelationship("2026-07-28", "2026-08-01", "2026-07-24", "2026-07-27")).toBe(
      "FS"
    );
  });

  it("detects FF when both items finish close together", () => {
    expect(classifyRelationship("2026-08-01", "2026-08-13", "2026-07-24", "2026-08-13")).toBe(
      "FF"
    );
  });

  it("detects SS when both items start close together", () => {
    expect(classifyRelationship("2026-07-24", "2026-08-10", "2026-07-24", "2026-08-01")).toBe(
      "SS"
    );
  });

  it("detects SF when this item's finish is closest to the predecessor's start", () => {
    expect(classifyRelationship("2026-07-01", "2026-07-24", "2026-07-24", "2026-08-10")).toBe(
      "SF"
    );
  });

  it("still classifies correctly with lag between linked dates", () => {
    // Start is 3 days after predecessor's finish -- still the closest pair.
    expect(classifyRelationship("2026-07-27", "2026-08-14", "2026-07-17", "2026-07-24")).toBe(
      "FS"
    );
  });
});
