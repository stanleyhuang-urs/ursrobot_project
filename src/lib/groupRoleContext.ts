import { prisma } from "@/lib/prisma";
import { resolveGroupRoleAccess, groupDisciplineTeamUserIds, type GroupRoleAccess } from "@/lib/groupRoles";

/**
 * Server-side loader for one user's GroupRoleAssignment-derived rights in one
 * group — used by server actions (item.ts, cell.ts, assignment.ts,
 * ganttResize.ts) to decide whether a group role should bypass the normal
 * board-wide UserRole/assignment checks. `teamUserIds` is the discipline
 * roster this user's DM role(s) manage, ready to feed into
 * isItemAssignedToTeam exactly like a SUPERVISOR's direct reports.
 */
export async function loadGroupRoleContext(
  groupId: string,
  userId: string
): Promise<{ access: GroupRoleAccess; teamUserIds: Set<string> }> {
  const assignments = await prisma.groupRoleAssignment.findMany({
    where: { groupId, userId },
    select: { role: true },
  });
  const access = resolveGroupRoleAccess(assignments);
  const teamUserIds =
    access.disciplines.size > 0
      ? groupDisciplineTeamUserIds(
          await prisma.groupMember.findMany({
            where: { groupId, discipline: { in: [...access.disciplines] } },
            select: { discipline: true, userId: true },
          }),
          access
        )
      : new Set<string>();
  return { access, teamUserIds };
}
