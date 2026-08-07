"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function createGroup(boardId: string, name: string) {
  await requireSession();
  const trimmed = name.trim() || "新分組";

  const count = await prisma.group.count({ where: { boardId } });
  const group = await prisma.group.create({
    data: { boardId, name: trimmed, order: count },
  });

  revalidatePath(`/boards/${boardId}`);
  return group;
}

export async function renameGroup(boardId: string, groupId: string, name: string) {
  await requireSession();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("分組名稱不可為空");

  await prisma.group.update({ where: { id: groupId }, data: { name: trimmed } });
  revalidatePath(`/boards/${boardId}`);
}

export async function deleteGroup(boardId: string, groupId: string) {
  await requireSession();
  await prisma.group.delete({ where: { id: groupId } });
  revalidatePath(`/boards/${boardId}`);
}

export async function reorderGroups(
  boardId: string,
  orderedGroupIds: string[]
) {
  await requireSession();
  await prisma.$transaction(
    orderedGroupIds.map((id, index) =>
      prisma.group.update({ where: { id }, data: { order: index } })
    )
  );
  revalidatePath(`/boards/${boardId}`);
}
