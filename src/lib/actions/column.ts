"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireStructureAccess } from "@/lib/permissions";
import type { ColumnType, StatusColumnOptions } from "@/types/column";
import { DEFAULT_STATUSES } from "@/types/column";

export async function createColumn(
  boardId: string,
  name: string,
  type: ColumnType
) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("欄位名稱不可為空");

  const count = await prisma.column.count({ where: { boardId } });
  const options: StatusColumnOptions | Record<string, never> =
    type === "STATUS" ? { statuses: DEFAULT_STATUSES } : {};

  await prisma.column.create({
    data: { boardId, name: trimmed, type, order: count, options },
  });

  revalidatePath(`/boards/${boardId}`);
}

export async function renameColumn(
  boardId: string,
  columnId: string,
  name: string
) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("欄位名稱不可為空");

  await prisma.column.update({
    where: { id: columnId },
    data: { name: trimmed },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function updateStatusOptions(
  boardId: string,
  columnId: string,
  statuses: StatusColumnOptions["statuses"]
) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  await prisma.column.update({
    where: { id: columnId },
    data: { options: { statuses } },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function reorderColumns(
  boardId: string,
  orderedColumnIds: string[]
) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  await prisma.$transaction(
    orderedColumnIds.map((id, index) =>
      prisma.column.update({ where: { id }, data: { order: index } })
    )
  );
  revalidatePath(`/boards/${boardId}`);
}

export async function deleteColumn(boardId: string, columnId: string) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  await prisma.column.delete({ where: { id: columnId } });
  revalidatePath(`/boards/${boardId}`);
}

export async function setProgressColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { progressColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function setGanttStartColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { ganttStartColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function setGanttDurationColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { ganttDurationColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function setGanttEndColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { ganttEndColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function setPredColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { predColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function setLinkColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { linkColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
}
