export type ColumnType = "TEXT" | "STATUS" | "PERSON" | "DATE" | "NUMBER";

export type StatusOption = {
  id: string;
  label: string;
  color: string;
};

export type StatusColumnOptions = {
  statuses: StatusOption[];
};

export const DEFAULT_STATUS_PALETTE = [
  "#c4c4c4",
  "#fdab3d",
  "#579bfc",
  "#00c875",
  "#e2445c",
  "#a25ddc",
];

export const DEFAULT_STATUSES: StatusOption[] = [
  { id: "todo", label: "待處理", color: "#c4c4c4" },
  { id: "in_progress", label: "進行中", color: "#fdab3d" },
  { id: "done", label: "已完成", color: "#00c875" },
];

/**
 * Shape of `CellValue.value` (JSON) per column type.
 * TEXT -> string | null
 * STATUS -> string | null (StatusOption id)
 * PERSON -> string | null (User id)
 * DATE -> string | null (ISO date, yyyy-MM-dd)
 * NUMBER -> number | null
 */
export type CellValueJson = string | number | null;

/**
 * Normalizes a PERSON column's CellValue.value into a list of user ids.
 * Handles the current single-string shape and a future array shape alike.
 */
export function getPersonIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string" && value) return [value];
  return [];
}

export function getStatusOptions(options: unknown): StatusOption[] {
  if (
    options &&
    typeof options === "object" &&
    "statuses" in options &&
    Array.isArray((options as { statuses: unknown }).statuses)
  ) {
    return (options as StatusColumnOptions).statuses;
  }
  return DEFAULT_STATUSES;
}
