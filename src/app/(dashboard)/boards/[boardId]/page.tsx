import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { canAccessBoard } from "@/lib/boardAccess";
import { boardWithDataArgs } from "@/types/board";
import { BoardView } from "@/components/board/BoardView";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ highlight?: string }>;
}) {
  const { boardId } = await params;
  const { highlight } = await searchParams;

  const [session, board, users] = await Promise.all([
    requireSession(),
    prisma.board.findUnique({
      where: { id: boardId },
      ...boardWithDataArgs,
    }),
    prisma.user.findMany({
      select: { id: true, name: true, supervisorId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!board) notFound();
  if (!(await canAccessBoard(session, boardId))) notFound();

  return (
    <BoardView
      board={board}
      users={users}
      userRole={session.role}
      currentUserId={session.userId}
      highlightItemId={highlight ?? null}
    />
  );
}
