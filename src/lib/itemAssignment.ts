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

/**
 * Like isItemAssignedToUser, but true if ANY of the item's assignees is in
 * the given set — used to let a SUPERVISOR edit a Gantt item assigned to
 * one of their own team members, without granting blanket access to items
 * assigned elsewhere (e.g. to an ADMIN's own work).
 */
export function isItemAssignedToTeam(
  item: {
    assignments: { userId: string }[];
    cellValues: { columnId: string; value: unknown }[];
  },
  personColumnIds: string[],
  teamUserIds: Set<string>
): boolean {
  if (item.assignments.some((a) => teamUserIds.has(a.userId))) return true;
  return item.cellValues.some(
    (cv) =>
      personColumnIds.includes(cv.columnId) &&
      getPersonIds(cv.value).some((id) => teamUserIds.has(id))
  );
}
