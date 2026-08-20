"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { canManageStructure } from "@/lib/permissions";
import { upsertAssignment } from "./assignment";

/**
 * Lets a supervisor split a subtask off one of their own assigned tasks, or
 * an admin split a subtask off any task, and hand it to a team member —
 * directly from the dashboard's weekly workload timeline. For a supervisor
 * this is a "delegate part of my own work" action, so the parent must
 * currently be assigned to them; admins aren't limited to their own tasks.
 */
export async function createTeamSubtask(input: {
  parentItemId: string;
  assigneeUserId: string;
  name: string;
  startDate: string;
  days: number;
}) {
  const session = await requireSession();
  if (!canManageStructure(session.role)) {
    throw new Error("權限不足:僅管理者與主管可以新增任務");
  }

  const trimmedName = input.name.trim() || "新任務";
  if (!Number.isFinite(input.days) || input.days < 1) throw new Error("天數需大於 0");

  const parent = await prisma.item.findUnique({
    where: { id: input.parentItemId },
    include: { board: true },
  });
  if (!parent) throw new Error("找不到父任務");

  if (session.role === "SUPERVISOR") {
    const ownAssignment = await prisma.assignment.findUnique({
      where: { itemId_userId: { itemId: parent.id, userId: session.userId } },
    });
    if (!ownAssignment) {
      throw new Error("只能在自己被指派的任務下新增子任務");
    }
  }

  const { board } = parent;
  if (!board.ganttStartColumnId || !board.ganttDurationColumnId) {
    throw new Error("此看板尚未設定甘特圖「開始日期」與「天數」欄位,無法用時間軸建立任務");
  }

  const siblingCount = await prisma.item.count({ where: { parentId: parent.id } });

  const item = await prisma.item.create({
    data: {
      boardId: parent.boardId,
      groupId: parent.groupId,
      parentId: parent.id,
      name: trimmedName,
      order: siblingCount,
    },
  });

  const cellValues: { itemId: string; columnId: string; value: string | number }[] = [
    { itemId: item.id, columnId: board.ganttStartColumnId, value: input.startDate },
    { itemId: item.id, columnId: board.ganttDurationColumnId, value: input.days },
  ];
  if (board.ganttEndColumnId) {
    const start = new Date(input.startDate);
    const end = new Date(start.getTime() + (input.days - 1) * 86_400_000);
    cellValues.push({
      itemId: item.id,
      columnId: board.ganttEndColumnId,
      value: end.toISOString().slice(0, 10),
    });
  }
  await prisma.cellValue.createMany({ data: cellValues });

  await upsertAssignment(parent.boardId, item.id, input.assigneeUserId, 100);

  revalidatePath("/dashboard");
  revalidatePath(`/boards/${parent.boardId}`);

  return item;
}
