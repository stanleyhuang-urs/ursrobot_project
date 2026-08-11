import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { accessibleBoardWhere } from "@/lib/boardAccess";

export default async function BoardsIndexPage() {
  const session = await requireSession();
  const firstBoard = await prisma.board.findFirst({
    where: accessibleBoardWhere(session),
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (firstBoard) {
    redirect(`/boards/${firstBoard.id}`);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="mb-2 text-lg font-medium text-neutral-700">還沒有任何看板</p>
      <p className="text-sm text-neutral-400">
        點選左側「+」建立你的第一個看板
      </p>
    </div>
  );
}
