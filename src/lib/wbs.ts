import type { ItemData } from "@/types/board";

/** WBS-style numbering (1, 1.1, 1.1.2, ...) based on each item's position among its siblings. */
export function computeWbsCodes(items: ItemData[]): Map<string, string> {
  const byParent = new Map<string | null, ItemData[]>();
  for (const item of items) {
    const list = byParent.get(item.parentId) ?? [];
    list.push(item);
    byParent.set(item.parentId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.order - b.order);

  const codes = new Map<string, string>();
  function walk(parentId: string | null, prefix: string) {
    (byParent.get(parentId) ?? []).forEach((child, index) => {
      const code = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      codes.set(child.id, code);
      walk(child.id, code);
    });
  }
  walk(null, "");
  return codes;
}

/** Ids of every ancestor (not including the item itself) of the given item. */
export function computeAncestorIds(
  items: ItemData[],
  itemId: string | null | undefined
): Set<string> {
  const ids = new Set<string>();
  if (!itemId) return ids;
  const byId = new Map(items.map((i) => [i.id, i]));
  let current = byId.get(itemId);
  while (current?.parentId) {
    ids.add(current.parentId);
    current = byId.get(current.parentId);
  }
  return ids;
}
