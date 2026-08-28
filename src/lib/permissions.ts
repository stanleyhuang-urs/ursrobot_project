import type { ColumnType, UserRole } from "@prisma/client";

export function canManageBoard(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canManageStructure(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function requireBoardAdmin(role: UserRole) {
  if (!canManageBoard(role)) {
    throw new Error("權限不足:僅管理者可以執行此操作");
  }
}

export function requireStructureAccess(role: UserRole) {
  if (!canManageStructure(role)) {
    throw new Error("權限不足:僅管理者與主管可以執行此操作");
  }
}

/**
 * MEMBER may only edit STATUS-type columns and the board's designated
 * progress column, and only on items assigned to them (via a Gantt
 * Assignment or a PERSON-column value naming them) — not any item on the
 * board. ADMIN and SUPERVISOR can edit any cell.
 */
export function canEditCellValue(
  role: UserRole,
  columnType: ColumnType,
  isProgressColumn: boolean,
  isAssignedToUser: boolean
): boolean {
  if (canManageStructure(role)) return true;
  if (columnType !== "STATUS" && !isProgressColumn) return false;
  return isAssignedToUser;
}

/**
 * Deleting an item and editing its schedule (start date / duration) is
 * restricted to whoever created it, or an ADMIN. Items with no creator
 * (e.g. from an Excel import) can only be touched by an ADMIN.
 */
export function canModifyItemSchedule(
  role: UserRole,
  itemCreatedById: string | null,
  currentUserId: string
): boolean {
  if (role === "ADMIN") return true;
  return itemCreatedById !== null && itemCreatedById === currentUserId;
}

/**
 * Gantt bar editing (人員分配、拖曳調整時程) is limited to the item's own
 * assignee(s) — via a Gantt Assignment or a PERSON-column value naming them
 * — an ADMIN, or a SUPERVISOR whose own team includes an assignee. Unlike
 * canEditCellValue/canManageStructure, a SUPERVISOR does NOT get a blanket
 * bypass here — e.g. Henry (SUPERVISOR) editing a task assigned only to
 * Stanley (not on Henry's team) must be refused, matching the same
 * team-scoping AssignmentModal already applies to who a supervisor can
 * assign work to.
 */
export function canEditGanttItem(
  role: UserRole,
  isAssignedToUser: boolean,
  isAssignedToTeam: boolean = false
): boolean {
  if (role === "ADMIN") return true;
  if (role === "SUPERVISOR") return isAssignedToUser || isAssignedToTeam;
  return isAssignedToUser;
}
