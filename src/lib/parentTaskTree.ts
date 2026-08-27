import type { BoardWithData, ItemData } from "@/types/board";
import { getPersonIds } from "@/types/column";
import { getItemDateRange } from "@/lib/gantt";

export type ParentTreeNode = {
  itemId: string;
  itemName: string;
  boardId: string;
  boardName: string;
  startDate: Date | null;
  endDate: Date | null;
  children: ParentTreeNode[];
};

/**
 * For a supervisor: the ancestor path (root → ... → assigned item) of every
 * item assigned to them or anyone on their team, PLUS the full existing
 * descendant subtree under each assigned item, merged into one tree. Lets
 * them pick any level of their team's work as the new subtask's parent — an
 * ancestor of an assignment, the assigned item itself, or anywhere already
 * nested under it — not just items they personally happen to be assigned to
 * (a supervisor with no assignments of their own still needs to be able to
 * add work under their team members' existing tasks).
 */
export function buildSupervisorParentTree(
  boards: BoardWithData[],
  userIds: string[],
  holidays: Set<string> = new Set()
): ParentTreeNode[] {
  const idSet = new Set(userIds);
  const roots: ParentTreeNode[] = [];
  const nodeById = new Map<string, ParentTreeNode>();

  for (const board of boards) {
    const itemsById = new Map(board.items.map((i) => [i.id, i]));
    const childrenOf = new Map<string | null, ItemData[]>();
    for (const item of board.items) {
      const list = childrenOf.get(item.parentId) ?? [];
      list.push(item);
      childrenOf.set(item.parentId, list);
    }
    for (const list of childrenOf.values()) list.sort((a, b) => a.order - b.order);

    function ensureNode(item: ItemData): ParentTreeNode {
      let node = nodeById.get(item.id);
      if (!node) {
        const range =
          board.ganttStartColumnId && board.ganttDurationColumnId
            ? getItemDateRange(
                item,
                board.ganttStartColumnId,
                board.ganttDurationColumnId,
                board.ganttDurationMode,
                holidays
              )
            : null;
        node = {
          itemId: item.id,
          itemName: item.name,
          boardId: board.id,
          boardName: board.name,
          startDate: range?.start ?? null,
          endDate: range?.end ?? null,
          children: [],
        };
        nodeById.set(item.id, node);
      }
      return node;
    }

    function attachChild(parentNode: ParentTreeNode, childNode: ParentTreeNode) {
      if (!parentNode.children.includes(childNode)) parentNode.children.push(childNode);
    }

    function attachDescendants(item: ItemData) {
      const node = ensureNode(item);
      for (const child of childrenOf.get(item.id) ?? []) {
        attachChild(node, ensureNode(child));
        attachDescendants(child);
      }
    }

    // "Assigned" here means the same thing it does everywhere else in the
    // app (see isItemAssignedToUser): a Gantt Assignment row, OR a
    // PERSON-column value (負責人/Resource) naming them — most items on an
    // imported board are only "assigned" in the latter sense, so checking
    // just the Assignment model left supervisors with an empty tree even
    // though their team clearly owns work.
    const personColumnIds = board.columns.filter((c) => c.type === "PERSON").map((c) => c.id);
    const assignedItems = board.items.filter(
      (i) =>
        i.assignments.some((a) => idSet.has(a.userId)) ||
        i.cellValues.some(
          (cv) => personColumnIds.includes(cv.columnId) && getPersonIds(cv.value).some((id) => idSet.has(id))
        )
    );

    for (const item of assignedItems) {
      const chain: ItemData[] = [];
      let current: ItemData | undefined = item;
      while (current) {
        chain.unshift(current);
        current = current.parentId ? itemsById.get(current.parentId) : undefined;
      }

      let parentNode: ParentTreeNode | null = null;
      for (const node of chain) {
        const treeNode = ensureNode(node);
        if (parentNode) attachChild(parentNode, treeNode);
        else if (!roots.includes(treeNode)) roots.push(treeNode);
        parentNode = treeNode;
      }

      attachDescendants(item);
    }
  }

  return roots;
}

/** For an admin: the full item hierarchy of every accessible board. */
export function buildFullParentTree(
  boards: BoardWithData[],
  holidays: Set<string> = new Set()
): ParentTreeNode[] {
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
      const range =
        board.ganttStartColumnId && board.ganttDurationColumnId
          ? getItemDateRange(
              item,
              board.ganttStartColumnId,
              board.ganttDurationColumnId,
              board.ganttDurationMode,
              holidays
            )
          : null;
      return {
        itemId: item.id,
        itemName: item.name,
        boardId: board.id,
        boardName: board.name,
        startDate: range?.start ?? null,
        endDate: range?.end ?? null,
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
