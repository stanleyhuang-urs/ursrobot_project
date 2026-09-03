import type { ItemData } from "@/types/board";

// computeItemProgress is called once per row that has children (every
// summary row on the board), and each call used to filter the *entire*
// group's item list to find its direct children — O(n) work repeated once
// per summary row, and again recursively for every ancestor summary above
// it. For a large board that's the difference between a page render doing
// thousands of full-list scans and doing one. Cached by the array's own
// identity (a WeakMap so it's released once the request's item array is
// no longer referenced, rather than leaking across requests) since the
// same allGroupItems reference is passed for every row within one render.
const childrenIndexCache = new WeakMap<ItemData[], Map<string, ItemData[]>>();

function getChildrenIndex(allGroupItems: ItemData[]): Map<string, ItemData[]> {
  let index = childrenIndexCache.get(allGroupItems);
  if (!index) {
    index = new Map();
    for (const item of allGroupItems) {
      if (!item.parentId) continue;
      const list = index.get(item.parentId);
      if (list) list.push(item);
      else index.set(item.parentId, [item]);
    }
    childrenIndexCache.set(allGroupItems, index);
  }
  return index;
}

/**
 * For a leaf item, returns its own stored value in the progress column.
 * For an item with children, recursively averages its children's effective
 * progress (children with children of their own are averaged first).
 * A child with no value counts as 0, not excluded, so an unstarted subtask
 * pulls the rollup down instead of vanishing from the average.
 */
export function computeItemProgress(
  item: ItemData,
  allGroupItems: ItemData[],
  progressColumnId: string
): number | null {
  const children = getChildrenIndex(allGroupItems).get(item.id) ?? [];

  if (children.length === 0) {
    const cv = item.cellValues.find((c) => c.columnId === progressColumnId);
    return typeof cv?.value === "number" ? cv.value : null;
  }

  const childValues = children.map(
    (child) => computeItemProgress(child, allGroupItems, progressColumnId) ?? 0
  );
  return childValues.reduce((a, b) => a + b, 0) / childValues.length;
}
