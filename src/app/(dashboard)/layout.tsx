import type { ReactNode } from "react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { BoardSidebar } from "@/components/sidebar/BoardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  const boards = await prisma.board.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex h-screen w-full">
      <BoardSidebar boards={boards} userName={session.name} />
      <div className="flex-1 overflow-auto bg-neutral-50">{children}</div>
    </div>
  );
}
