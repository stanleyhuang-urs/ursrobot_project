"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";
import { boardWithDataArgs } from "@/types/board";
import { buildGanttDayWorkbook } from "@/lib/export/ganttDayExport";

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

export async function exportGanttDay(
  boardId: string,
  groupId: string
): Promise<{ filename: string; base64: string }> {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    ...boardWithDataArgs,
  });
  if (!board) throw new Error("找不到看板");

  const group = board.groups.find((g) => g.id === groupId);
  if (!group) throw new Error("找不到分組");

  const buffer = await buildGanttDayWorkbook(board, group);
  const filename = sanitizeFilename(`${board.name}-${group.name}-GanttDay.xlsx`);

  return { filename, base64: buffer.toString("base64") };
}
