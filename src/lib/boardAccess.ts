import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/jwt";

/**
 * ADMIN always has access. Otherwise: public boards are open to everyone;
 * restricted boards are only visible to their owner and explicit members.
 */
export async function canAccessBoard(
  session: SessionPayload,
  boardId: string
): Promise<boolean> {
  if (session.role === "ADMIN") return true;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, visibility: true },
  });
  if (!board) return false;
  if (board.visibility === "PUBLIC") return true;
  if (board.ownerId === session.userId) return true;

  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: session.userId } },
  });
  return !!member;
}

export async function requireBoardAccess(boardId: string, session: SessionPayload) {
  if (!(await canAccessBoard(session, boardId))) {
    throw new Error("權限不足:你沒有這個看板的存取權限");
  }
}

/**
 * Looks up itemId's REAL board and checks access against that — never trust
 * a client-supplied boardId for this. A caller who has access to some board
 * of their own could otherwise pass that board's id alongside an itemId
 * belonging to a different (possibly RESTRICTED) board and pass the check
 * purely because *some* board they named happens to be accessible, even
 * though the item being read/written isn't on it. Returns the item's real
 * boardId so callers use it going forward instead of whatever was passed
 * in. Throws if the item doesn't exist or access is denied.
 */
export async function requireItemBoardAccess(
  itemId: string,
  session: SessionPayload
): Promise<string> {
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { boardId: true } });
  if (!item) {
    throw new Error("項目不存在");
  }
  await requireBoardAccess(item.boardId, session);
  return item.boardId;
}

/** Same as requireItemBoardAccess, but for actions keyed by a groupId
 *  instead of an itemId (item creation, which has no itemId yet). */
export async function requireGroupBoardAccess(
  groupId: string,
  session: SessionPayload
): Promise<string> {
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { boardId: true } });
  if (!group) {
    throw new Error("分組不存在");
  }
  await requireBoardAccess(group.boardId, session);
  return group.boardId;
}

/** Prisma `where` fragment selecting only boards the session can access. */
export function accessibleBoardWhere(session: SessionPayload): Prisma.BoardWhereInput {
  if (session.role === "ADMIN") return {};
  return {
    OR: [
      { visibility: "PUBLIC" },
      { ownerId: session.userId },
      { members: { some: { userId: session.userId } } },
    ],
  };
}
