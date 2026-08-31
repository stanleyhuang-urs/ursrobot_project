import type { GroupDiscipline, GroupRole } from "@prisma/client";

const DM_ROLE_DISCIPLINE: Partial<Record<GroupRole, GroupDiscipline>> = {
  SW_DM: "SW",
  HW_DM: "HW",
  ME_DM: "ME",
  QA: "QA",
};

export type GroupRoleAccess = {
  /** TEAM_LEADER or PMD for this group — schedule-edit rights (Gantt drag,
   *  Start/Days/Finish) on every item in the group, unconditional. */
  hasScheduleRole: boolean;
  /** Disciplines this user is the DM of in this group (TEAM_LEADER counts as
   *  DM of all four) — structure rights (item create/assign/progress) scoped
   *  to that discipline's GroupMember roster. */
  disciplines: Set<GroupDiscipline>;
};

/**
 * Resolves what a user's GroupRoleAssignment rows in one group grant them.
 * Pure function — usable on both the server (permission checks) and the
 * client (to decide what buttons/handles to render), same pattern as
 * resolveLockedScheduleFields.
 */
export function resolveGroupRoleAccess(
  assignments: { role: GroupRole }[]
): GroupRoleAccess {
  const roles = new Set(assignments.map((a) => a.role));
  const hasScheduleRole = roles.has("TEAM_LEADER") || roles.has("PMD");
  const disciplines = new Set<GroupDiscipline>();
  if (roles.has("TEAM_LEADER")) {
    disciplines.add("SW");
    disciplines.add("HW");
    disciplines.add("ME");
    disciplines.add("QA");
  }
  for (const [role, discipline] of Object.entries(DM_ROLE_DISCIPLINE) as [GroupRole, GroupDiscipline][]) {
    if (roles.has(role)) disciplines.add(discipline);
  }
  return { hasScheduleRole, disciplines };
}

/**
 * The userIds a DM (of one or more disciplines) manages in this group — the
 * union of GroupMember rosters for `access.disciplines`. Feed into
 * isItemAssignedToTeam the same way a SUPERVISOR's direct-report set is,
 * to scope structure rights (create/assign/progress) to "members under them".
 */
export function groupDisciplineTeamUserIds(
  members: { discipline: GroupDiscipline; userId: string }[],
  access: GroupRoleAccess
): Set<string> {
  const ids = new Set<string>();
  if (access.disciplines.size === 0) return ids;
  for (const m of members) {
    if (access.disciplines.has(m.discipline)) ids.add(m.userId);
  }
  return ids;
}
