import type { ItemData } from "@/types/board";

/**
 * For a leaf item, returns its own stored value in the progress column.
 * For an item with children, recursively averages its children's effective
 * progress (children with children of their own are averaged first).
 */
export function computeItemProgress(
  item: ItemData,
  allGroupItems: ItemData[],
  progressColumnId: string
): number | null {
  const children = allGroupItems.filter((i) => i.parentId === item.id);

  if (children.length === 0) {
    const cv = item.cellValues.find((c) => c.columnId === progressColumnId);
    return typeof cv?.value === "number" ? cv.value : null;
  }

  const childValues = children
    .map((child) => computeItemProgress(child, allGroupItems, progressColumnId))
    .filter((v): v is number => v !== null);

  if (childValues.length === 0) return null;
  return childValues.reduce((a, b) => a + b, 0) / childValues.length;
}
