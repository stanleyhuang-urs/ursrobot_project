import { describe, expect, it } from "vitest";
import { parseNumberInput, normalizeTextInput } from "./cellValue";
import { getStatusOptions, DEFAULT_STATUSES } from "@/types/column";

describe("parseNumberInput", () => {
  it("parses a valid numeric string", () => {
    expect(parseNumberInput("50000")).toBe(50000);
    expect(parseNumberInput("-3.5")).toBe(-3.5);
  });

  it("returns null for an empty string", () => {
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput("   ")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseNumberInput("abc")).toBeNull();
  });
});

describe("normalizeTextInput", () => {
  it("passes through non-empty strings", () => {
    expect(normalizeTextInput("hello")).toBe("hello");
  });

  it("converts empty string to null", () => {
    expect(normalizeTextInput("")).toBeNull();
  });
});

describe("getStatusOptions", () => {
  it("reads statuses from valid column options JSON", () => {
    const options = { statuses: [{ id: "x", label: "X", color: "#000" }] };
    expect(getStatusOptions(options)).toEqual(options.statuses);
  });

  it("falls back to DEFAULT_STATUSES for null/invalid options", () => {
    expect(getStatusOptions(null)).toEqual(DEFAULT_STATUSES);
    expect(getStatusOptions(undefined)).toEqual(DEFAULT_STATUSES);
    expect(getStatusOptions({})).toEqual(DEFAULT_STATUSES);
    expect(getStatusOptions({ statuses: "not-an-array" })).toEqual(
      DEFAULT_STATUSES
    );
  });
});
