import { describe, expect, it } from "vitest";
import {
  canManageBoard,
  canManageStructure,
  requireBoardAdmin,
  requireStructureAccess,
  canEditCellValue,
  canModifyItemSchedule,
  canEditGanttItem,
  canManageGroupStructure,
} from "./permissions";

describe("canManageBoard", () => {
  it("only ADMIN", () => {
    expect(canManageBoard("ADMIN")).toBe(true);
    expect(canManageBoard("SUPERVISOR")).toBe(false);
    expect(canManageBoard("MEMBER")).toBe(false);
  });
});

describe("canManageStructure", () => {
  it("ADMIN and SUPERVISOR, not MEMBER", () => {
    expect(canManageStructure("ADMIN")).toBe(true);
    expect(canManageStructure("SUPERVISOR")).toBe(true);
    expect(canManageStructure("MEMBER")).toBe(false);
  });
});

describe("requireBoardAdmin / requireStructureAccess", () => {
  it("requireBoardAdmin throws for anyone but ADMIN", () => {
    expect(() => requireBoardAdmin("ADMIN")).not.toThrow();
    expect(() => requireBoardAdmin("SUPERVISOR")).toThrow();
    expect(() => requireBoardAdmin("MEMBER")).toThrow();
  });

  it("requireStructureAccess throws only for MEMBER", () => {
    expect(() => requireStructureAccess("ADMIN")).not.toThrow();
    expect(() => requireStructureAccess("SUPERVISOR")).not.toThrow();
    expect(() => requireStructureAccess("MEMBER")).toThrow();
  });
});

describe("canEditCellValue", () => {
  it("ADMIN/SUPERVISOR can edit any column regardless of assignment", () => {
    expect(canEditCellValue("ADMIN", "TEXT", false, false)).toBe(true);
    expect(canEditCellValue("SUPERVISOR", "PERSON", false, false)).toBe(true);
  });

  it("MEMBER can edit a STATUS column only when assigned (directly or via group discipline)", () => {
    expect(canEditCellValue("MEMBER", "STATUS", false, true, false)).toBe(true);
    expect(canEditCellValue("MEMBER", "STATUS", false, false, true)).toBe(true);
    expect(canEditCellValue("MEMBER", "STATUS", false, false, false)).toBe(false);
  });

  it("MEMBER can edit the designated progress column even if it isn't STATUS-typed", () => {
    expect(canEditCellValue("MEMBER", "NUMBER", true, true, false)).toBe(true);
    expect(canEditCellValue("MEMBER", "NUMBER", true, false, false)).toBe(false);
  });

  it("MEMBER cannot edit a non-STATUS, non-progress column even when assigned", () => {
    expect(canEditCellValue("MEMBER", "TEXT", false, true, false)).toBe(false);
    expect(canEditCellValue("MEMBER", "DATE", false, true, false)).toBe(false);
    expect(canEditCellValue("MEMBER", "PERSON", false, true, false)).toBe(false);
  });
});

describe("canModifyItemSchedule", () => {
  it("a group schedule role (TEAM_LEADER/PMD) always wins, regardless of role or creator", () => {
    expect(canModifyItemSchedule("MEMBER", "someone-else", "me", true)).toBe(true);
    expect(canModifyItemSchedule("MEMBER", null, "me", true)).toBe(true);
  });

  it("ADMIN can always modify, even items they didn't create", () => {
    expect(canModifyItemSchedule("ADMIN", "someone-else", "me")).toBe(true);
    expect(canModifyItemSchedule("ADMIN", null, "me")).toBe(true);
  });

  it("the item's own creator can modify it regardless of role", () => {
    expect(canModifyItemSchedule("MEMBER", "me", "me")).toBe(true);
    expect(canModifyItemSchedule("SUPERVISOR", "me", "me")).toBe(true);
  });

  it("a non-creating, non-admin, non-group-role SUPERVISOR is refused — no blanket supervisor bypass", () => {
    expect(canModifyItemSchedule("SUPERVISOR", "someone-else", "me")).toBe(false);
  });

  it("a non-creating MEMBER is refused", () => {
    expect(canModifyItemSchedule("MEMBER", "someone-else", "me")).toBe(false);
  });

  it("an item with no creator (e.g. bulk import) can only be touched by ADMIN or a group role", () => {
    expect(canModifyItemSchedule("SUPERVISOR", null, "me")).toBe(false);
    expect(canModifyItemSchedule("MEMBER", null, "me")).toBe(false);
    expect(canModifyItemSchedule("ADMIN", null, "me")).toBe(true);
  });
});

describe("canEditGanttItem", () => {
  it("a group schedule role always wins", () => {
    expect(canEditGanttItem("MEMBER", false, false, true)).toBe(true);
  });

  it("ADMIN can always edit", () => {
    expect(canEditGanttItem("ADMIN", false, false, false)).toBe(true);
  });

  it("SUPERVISOR gets team-scoped access, not a blanket bypass — the Henry Chen case", () => {
    // A SUPERVISOR who is also the assignee, or whose own team includes the
    // assignee, may edit. A SUPERVISOR with neither relationship to the item
    // must be refused — this is the exact regression this session fixed
    // (a supervisor dragging/resizing a bar for a task assigned to someone
    // outside their team).
    expect(canEditGanttItem("SUPERVISOR", true, false, false)).toBe(true);
    expect(canEditGanttItem("SUPERVISOR", false, true, false)).toBe(true);
    expect(canEditGanttItem("SUPERVISOR", false, false, false)).toBe(false);
  });

  it("MEMBER may only edit an item they are themselves assigned to — team membership doesn't count", () => {
    expect(canEditGanttItem("MEMBER", true, false, false)).toBe(true);
    // Unlike SUPERVISOR, MEMBER's own "team" (e.g. a discipline roster via a
    // group DM role) does NOT bypass this on its own — only hasGroupScheduleRole
    // (TEAM_LEADER/PMD) or personal assignment do.
    expect(canEditGanttItem("MEMBER", false, true, false)).toBe(false);
    expect(canEditGanttItem("MEMBER", false, false, false)).toBe(false);
  });
});

describe("canManageGroupStructure", () => {
  it("ADMIN/SUPERVISOR always qualify, independent of any group role", () => {
    expect(canManageGroupStructure("ADMIN", false)).toBe(true);
    expect(canManageGroupStructure("SUPERVISOR", false)).toBe(true);
  });

  it("MEMBER qualifies only via a group structure role", () => {
    expect(canManageGroupStructure("MEMBER", true)).toBe(true);
    expect(canManageGroupStructure("MEMBER", false)).toBe(false);
  });
});
