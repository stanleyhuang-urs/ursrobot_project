import { getPersonIds } from "@/types/column";

/**
 * Whether an item "belongs" to a user — either via a Gantt Assignment row,
 * or a PERSON-column value (e.g. 負責人/Resource) naming them. Used to scope
 * what a MEMBER may change (status, progress) to items that are actually
 * theirs, rather than any item on the board.
 */
export function isItemAssignedToUser(
  item: {
    assignments: { userId: string }[];
    cellValues: { columnId: string; value: unknown }[];
  },
  personColumnIds: string[],
  userId: string
): boolean {
  if (item.assignments.some((a) => a.userId === userId)) return true;
  return item.cellValues.some(
    (cv) => personColumnIds.includes(cv.columnId) && getPersonIds(cv.value).includes(userId)
  );
}
