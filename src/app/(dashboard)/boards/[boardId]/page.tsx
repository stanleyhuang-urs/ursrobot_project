import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { boardWithDataArgs } from "@/types/board";
import { BoardView } from "@/components/board/BoardView";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;

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

  return (
    <BoardView
      board={board}
      users={users}
      userRole={session.role}
      currentUserId={session.userId}
    />
  );
}
