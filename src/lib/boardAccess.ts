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
