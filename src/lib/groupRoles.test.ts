import { describe, expect, it } from "vitest";
import { resolveGroupRoleAccess, groupDisciplineTeamUserIds } from "./groupRoles";

function roles(...rs: string[]) {
  return rs.map((role) => ({ role: role as never }));
}

describe("resolveGroupRoleAccess", () => {
  it("no assignments grants nothing", () => {
    const access = resolveGroupRoleAccess([]);
    expect(access.hasScheduleRole).toBe(false);
    expect(access.disciplines.size).toBe(0);
  });

  it("TEAM_LEADER gets schedule rights plus every discipline", () => {
    const access = resolveGroupRoleAccess(roles("TEAM_LEADER"));
    expect(access.hasScheduleRole).toBe(true);
    expect([...access.disciplines].sort()).toEqual(["HW", "ME", "QA", "SW"]);
  });

  it("PMD gets schedule rights but no discipline roster of its own", () => {
    const access = resolveGroupRoleAccess(roles("PMD"));
    expect(access.hasScheduleRole).toBe(true);
    expect(access.disciplines.size).toBe(0);
  });

  it("PMM grants nothing — roster-only, by design (see GroupRolesModal's own copy)", () => {
    const access = resolveGroupRoleAccess(roles("PMM"));
    expect(access.hasScheduleRole).toBe(false);
    expect(access.disciplines.size).toBe(0);
  });

  it("a discipline DM gets exactly that discipline, and no schedule rights", () => {
    expect(resolveGroupRoleAccess(roles("SW_DM")).hasScheduleRole).toBe(false);
    expect([...resolveGroupRoleAccess(roles("SW_DM")).disciplines]).toEqual(["SW"]);
    expect([...resolveGroupRoleAccess(roles("HW_DM")).disciplines]).toEqual(["HW"]);
    expect([...resolveGroupRoleAccess(roles("ME_DM")).disciplines]).toEqual(["ME"]);
    expect([...resolveGroupRoleAccess(roles("QA")).disciplines]).toEqual(["QA"]);
  });

  it("multiple DM roles union their disciplines", () => {
    const access = resolveGroupRoleAccess(roles("SW_DM", "QA"));
    expect([...access.disciplines].sort()).toEqual(["QA", "SW"]);
    expect(access.hasScheduleRole).toBe(false);
  });

  it("holding both TEAM_LEADER and a DM role is redundant but harmless", () => {
    const access = resolveGroupRoleAccess(roles("TEAM_LEADER", "SW_DM"));
    expect(access.hasScheduleRole).toBe(true);
    expect([...access.disciplines].sort()).toEqual(["HW", "ME", "QA", "SW"]);
  });
});

describe("groupDisciplineTeamUserIds", () => {
  const members = [
    { discipline: "SW" as const, userId: "sw-1" },
    { discipline: "SW" as const, userId: "sw-2" },
    { discipline: "HW" as const, userId: "hw-1" },
    { discipline: "QA" as const, userId: "qa-1" },
  ];

  it("no disciplines -> empty set, regardless of the roster", () => {
    const ids = groupDisciplineTeamUserIds(members, { hasScheduleRole: false, disciplines: new Set() });
    expect(ids.size).toBe(0);
  });

  it("scopes to only the members in the granted discipline(s)", () => {
    const ids = groupDisciplineTeamUserIds(members, {
      hasScheduleRole: false,
      disciplines: new Set(["SW"]),
    });
    expect([...ids].sort()).toEqual(["sw-1", "sw-2"]);
  });

  it("unions across multiple disciplines", () => {
    const ids = groupDisciplineTeamUserIds(members, {
      hasScheduleRole: false,
      disciplines: new Set(["HW", "QA"]),
    });
    expect([...ids].sort()).toEqual(["hw-1", "qa-1"]);
  });

  it("a discipline with no roster members yields nothing for it, without erroring", () => {
    const ids = groupDisciplineTeamUserIds(members, {
      hasScheduleRole: false,
      disciplines: new Set(["ME"]),
    });
    expect(ids.size).toBe(0);
  });
});
