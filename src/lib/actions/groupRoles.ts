"use server";

import { revalidatePath } from "next/cache";
import type { GroupDiscipline, GroupRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";
import { requireBoardAccess } from "@/lib/boardAccess";

/**
 * Replaces the full set of users holding `role` on a group — configuring
 * who's TEAM_LEADER/SW_DM/HW_DM/ME_DM/QA/PMM/PMD is ADMIN-only, since it's
 * what grants schedule/structure rights in the first place (see
 * permissions.ts's canEditGanttItem/canManageGroupStructure).
 */
export async function setGroupRoleAssignments(
  boardId: string,
  groupId: string,
  role: GroupRole,
  userIds: string[]
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireBoardAdmin(session.role);

  await prisma.$transaction([
    prisma.groupRoleAssignment.deleteMany({ where: { groupId, role } }),
    ...userIds.map((userId) =>
      prisma.groupRoleAssignment.create({ data: { groupId, role, userId } })
    ),
  ]);
  revalidatePath(`/boards/${boardId}`);
}

/** Replaces the full SW/HW/ME/QA member roster for one discipline in a group. */
export async function setGroupMembers(
  boardId: string,
  groupId: string,
  discipline: GroupDiscipline,
  userIds: string[]
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireBoardAdmin(session.role);

  await prisma.$transaction([
    prisma.groupMember.deleteMany({ where: { groupId, discipline } }),
    ...userIds.map((userId) =>
      prisma.groupMember.create({ data: { groupId, discipline, userId } })
    ),
  ]);
  revalidatePath(`/boards/${boardId}`);
}

/** Replaces the full Resource roster for a group — informational only, Resources have no login/permissions. */
export async function setGroupResourceMembers(boardId: string, groupId: string, resourceIds: string[]) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireBoardAdmin(session.role);

  await prisma.$transaction([
    prisma.groupResourceMember.deleteMany({ where: { groupId } }),
    ...resourceIds.map((resourceId) =>
      prisma.groupResourceMember.create({ data: { groupId, resourceId } })
    ),
  ]);
  revalidatePath(`/boards/${boardId}`);
}
