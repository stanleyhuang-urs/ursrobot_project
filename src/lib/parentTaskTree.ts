import type { BoardWithData, ItemData } from "@/types/board";

export type ParentTreeNode = {
  itemId: string;
  itemName: string;
  boardId: string;
  boardName: string;
  children: ParentTreeNode[];
};

/**
 * For a supervisor: the ancestor path (root → ... → assigned item) of every
 * item they're personally assigned to, merged into one tree. Lets them pick
 * any level of their own work as the new subtask's parent, not just the
 * exact leaf they happen to be assigned to.
 */
export function buildSupervisorParentTree(boards: BoardWithData[], userId: string): ParentTreeNode[] {
  const roots: ParentTreeNode[] = [];
  const nodeById = new Map<string, ParentTreeNode>();

  for (const board of boards) {
    const itemsById = new Map(board.items.map((i) => [i.id, i]));
    const assignedItems = board.items.filter((i) => i.assignments.some((a) => a.userId === userId));

    for (const item of assignedItems) {
      const chain: ItemData[] = [];
      let current: ItemData | undefined = item;
      while (current) {
        chain.unshift(current);
        current = current.parentId ? itemsById.get(current.parentId) : undefined;
      }

      let siblings = roots;
      for (const node of chain) {
        let existing = nodeById.get(node.id);
        if (!existing) {
          existing = {
            itemId: node.id,
            itemName: node.name,
            boardId: board.id,
            boardName: board.name,
            children: [],
          };
          nodeById.set(node.id, existing);
          siblings.push(existing);
        }
        siblings = existing.children;
      }
    }
  }

  return roots;
}

/** For an admin: the full item hierarchy of every accessible board. */
export function buildFullParentTree(boards: BoardWithData[]): ParentTreeNode[] {
  const roots: ParentTreeNode[] = [];

  for (const board of boards) {
    const childrenOf = new Map<string | null, ItemData[]>();
    for (const item of board.items) {
      const list = childrenOf.get(item.parentId) ?? [];
      list.push(item);
      childrenOf.set(item.parentId, list);
    }
    for (const list of childrenOf.values()) list.sort((a, b) => a.order - b.order);

    function buildNode(item: ItemData): ParentTreeNode {
      return {
        itemId: item.id,
        itemName: item.name,
        boardId: board.id,
        boardName: board.name,
        children: (childrenOf.get(item.id) ?? []).map(buildNode),
      };
    }

    roots.push(...(childrenOf.get(null) ?? []).map(buildNode));
  }

  return roots;
}

/** Path of item ids from a root down to the target, or null if not present. */
export function findTreePath(tree: ParentTreeNode[], targetId: string, path: string[] = []): string[] | null {
  for (const node of tree) {
    if (node.itemId === targetId) return [...path, node.itemId];
    const found = findTreePath(node.children, targetId, [...path, node.itemId]);
    if (found) return found;
  }
  return null;
}

export function findTreeNode(tree: ParentTreeNode[], targetId: string): ParentTreeNode | null {
  for (const node of tree) {
    if (node.itemId === targetId) return node;
    const found = findTreeNode(node.children, targetId);
    if (found) return found;
  }
  return null;
}

/** First leaf-most node in the tree, used as the create-form's default selection. */
export function firstTreeItemId(tree: ParentTreeNode[]): string {
  if (tree.length === 0) return "";
  let node = tree[0];
  while (node.children.length > 0) node = node.children[node.children.length - 1];
  return node.itemId;
}
