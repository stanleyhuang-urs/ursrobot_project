"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";
import { DEFAULT_STATUSES } from "@/types/column";

export async function createBoard(name: string) {
  const session = await requireSession();
  requireBoardAdmin(session.role);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("看板名稱不可為空");

  const board = await prisma.board.create({
    data: {
      name: trimmed,
      ownerId: session.userId,
      groups: {
        create: [{ name: "項目", order: 0 }],
      },
      columns: {
        create: [
          {
            name: "狀態",
            type: "STATUS",
            order: 0,
            options: { statuses: DEFAULT_STATUSES },
          },
        ],
      },
    },
  });

  revalidatePath("/boards");
  return board;
}

export async function renameBoard(boardId: string, name: string) {
  const session = await requireSession();
  requireBoardAdmin(session.role);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("看板名稱不可為空");

  await prisma.board.update({
    where: { id: boardId },
    data: { name: trimmed },
  });

  revalidatePath("/boards");
  revalidatePath(`/boards/${boardId}`);
}

export async function deleteBoard(boardId: string) {
  const session = await requireSession();
  requireBoardAdmin(session.role);
  await prisma.board.delete({ where: { id: boardId } });
  revalidatePath("/boards");
}
