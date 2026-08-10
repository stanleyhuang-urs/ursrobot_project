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
 * progress column; everything else (structural columns aside) is read-only
 * for them. ADMIN and SUPERVISOR can edit any cell.
 */
export function canEditCellValue(
  role: UserRole,
  columnType: ColumnType,
  isProgressColumn: boolean
): boolean {
  if (canManageStructure(role)) return true;
  return columnType === "STATUS" || isProgressColumn;
}
