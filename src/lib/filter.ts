import type { ItemData } from "@/types/board";

export type FilterValue =
  | { kind: "text"; query: string }
  | { kind: "status"; selected: string[] }
  | { kind: "person"; selected: string[] }
  | { kind: "number"; min: number | null; max: number | null }
  | { kind: "date"; from: string | null; to: string | null };

export type ActiveFilter = { columnId: string; value: FilterValue };

// Not real Column rows — synthetic filter dimensions over Item's own
// createdById/createdAt fields, so "who/when created" is filterable without
// duplicating that data into a cell value on every item.
export const CREATED_BY_FILTER_COLUMN_ID = "__createdBy__";
export const CREATED_AT_FILTER_COLUMN_ID = "__createdAt__";

function itemMatchesFilter(item: ItemData, columnId: string, value: FilterValue): boolean {
  if (columnId === CREATED_BY_FILTER_COLUMN_ID) {
    if (value.kind !== "person" || value.selected.length === 0) return true;
    return !!item.createdById && value.selected.includes(item.createdById);
  }
  if (columnId === CREATED_AT_FILTER_COLUMN_ID) {
    if (value.kind !== "date" || (!value.from && !value.to)) return true;
    const iso = item.createdAt.toISOString().slice(0, 10);
    if (value.from && iso < value.from) return false;
    if (value.to && iso > value.to) return false;
    return true;
  }
  const cv = item.cellValues.find((c) => c.columnId === columnId)?.value;
  switch (value.kind) {
    case "text":
      if (!value.query.trim()) return true;
      return typeof cv === "string" && cv.toLowerCase().includes(value.query.toLowerCase());
    case "status":
      if (value.selected.length === 0) return true;
      return typeof cv === "string" && value.selected.includes(cv);
    case "person":
      if (value.selected.length === 0) return true;
      return typeof cv === "string" && value.selected.includes(cv);
    case "number":
      if (value.min === null && value.max === null) return true;
      if (typeof cv !== "number") return false;
      if (value.min !== null && cv < value.min) return false;
      if (value.max !== null && cv > value.max) return false;
      return true;
    case "date":
      if (!value.from && !value.to) return true;
      if (typeof cv !== "string") return false;
      if (value.from && cv < value.from) return false;
      if (value.to && cv > value.to) return false;
      return true;
  }
}

/**
 * Returns the set of item ids that should stay visible under the active
 * filters, including ancestors of any matching item so the hierarchy stays
 * intact. Returns null when there are no active filters (show everything).
 */
export function computeVisibleItemIds(
  items: ItemData[],
  filters: ActiveFilter[]
): Set<string> | null {
  if (filters.length === 0) return null;

  const itemById = new Map(items.map((i) => [i.id, i]));
  const visible = new Set<string>();

  for (const item of items) {
    if (filters.every((f) => itemMatchesFilter(item, f.columnId, f.value))) {
      visible.add(item.id);
      let cur = item;
      while (cur.parentId) {
        if (visible.has(cur.parentId)) break;
        visible.add(cur.parentId);
        const parent = itemById.get(cur.parentId);
        if (!parent) break;
        cur = parent;
      }
    }
  }

  return visible;
}
