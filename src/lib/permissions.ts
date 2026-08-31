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
  isAssignedToUser: boolean,
  isAssignedToGroupDiscipline: boolean = false
): boolean {
  if (canManageStructure(role)) return true;
  if (columnType !== "STATUS" && !isProgressColumn) return false;
  return isAssignedToUser || isAssignedToGroupDiscipline;
}

/**
 * Deleting an item and editing its schedule (start date / duration) is
 * restricted to whoever created it, or an ADMIN. Items with no creator
 * (e.g. from an Excel import) can only be touched by an ADMIN.
 */
export function canModifyItemSchedule(
  role: UserRole,
  itemCreatedById: string | null,
  currentUserId: string,
  hasGroupScheduleRole: boolean = false
): boolean {
  if (hasGroupScheduleRole) return true;
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
  isAssignedToTeam: boolean = false,
  hasGroupScheduleRole: boolean = false
): boolean {
  if (hasGroupScheduleRole) return true;
  if (role === "ADMIN") return true;
  if (role === "SUPERVISOR") return isAssignedToUser || isAssignedToTeam;
  return isAssignedToUser;
}

/**
 * Whether a user may create/assign items and manage a group's own item
 * structure (add subitem, open assignment modal) — either via the board-wide
 * ADMIN/SUPERVISOR grant, or as a Group's TEAM_LEADER/SW_DM/HW_DM/ME_DM/QA
 * (see resolveGroupRoleAccess — `hasGroupStructureRole` is true whenever
 * that user's `disciplines` set for the group is non-empty).
 */
export function canManageGroupStructure(
  role: UserRole,
  hasGroupStructureRole: boolean
): boolean {
  return canManageStructure(role) || hasGroupStructureRole;
}
