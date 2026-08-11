"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { notifyItemAssignees } from "@/lib/notify";
import { requireBoardAccess } from "@/lib/boardAccess";

export async function createComment(
  boardId: string,
  itemId: string,
  body: string
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  const trimmed = body.trim();
  if (!trimmed) throw new Error("留言不可為空");

  const [comment, item] = await Promise.all([
    prisma.comment.create({
      data: { itemId, authorId: session.userId, body: trimmed },
    }),
    prisma.item.findUnique({ where: { id: itemId } }),
  ]);

  if (item) {
    await notifyItemAssignees(
      prisma,
      itemId,
      session.userId,
      "COMMENTED",
      `${session.name} 在「${item.name}」留言`
    );
  }

  revalidatePath(`/boards/${boardId}`);
  return comment;
}

export async function listComments(itemId: string) {
  const session = await requireSession();
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { boardId: true } });
  if (item) await requireBoardAccess(item.boardId, session);
  return prisma.comment.findMany({
    where: { itemId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } },
  });
}
