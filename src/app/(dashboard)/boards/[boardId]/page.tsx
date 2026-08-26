import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { canAccessBoard } from "@/lib/boardAccess";
import { boardWithDataArgs, type UserOption } from "@/types/board";
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

  const [session, board, users, resources] = await Promise.all([
    requireSession(),
    prisma.board.findUnique({
      where: { id: boardId },
      ...boardWithDataArgs,
    }),
    prisma.user.findMany({
      select: { id: true, name: true, supervisorId: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
    prisma.resource.findMany({ orderBy: { order: "asc" } }),
  ]);

  if (!board) notFound();
  if (!(await canAccessBoard(session, boardId))) notFound();

  // Resources (tools, external vendors) can be set as an item's 負責人
  // alongside real Users, so they're merged into the same assignee list —
  // but only here for board views, not in dashboards/workload/notifications.
  const assignees: UserOption[] = [
    ...users,
    ...resources.map((r) => ({
      id: r.id,
      name: r.category ? `${r.name} (${r.category})` : r.name,
      supervisorId: null,
      avatarUrl: null,
      isResource: true,
    })),
  ];

  return (
    <BoardView
      board={board}
      users={assignees}
      userRole={session.role}
      currentUserId={session.userId}
      highlightItemId={highlight ?? null}
    />
  );
}
