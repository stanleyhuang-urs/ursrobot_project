"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";
import { boardWithDataArgs } from "@/types/board";
import { buildGanttWorkbook } from "@/lib/export/ganttWorkbookExport";
import { GANTT_APPS_SCRIPT } from "@/lib/export/ganttAppsScript";

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

export async function exportGanttWorkbook(
  boardId: string,
  groupId: string
): Promise<{ xlsxFilename: string; xlsxBase64: string; gsFilename: string; gsContent: string }> {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    ...boardWithDataArgs,
  });
  if (!board) throw new Error("找不到看板");

  const group = board.groups.find((g) => g.id === groupId);
  if (!group) throw new Error("找不到分組");

  const buffer = await buildGanttWorkbook(board, group);
  const baseName = sanitizeFilename(`${board.name}-${group.name}-Gantt`);

  return {
    xlsxFilename: `${baseName}.xlsx`,
    xlsxBase64: buffer.toString("base64"),
    gsFilename: `${baseName}-AppsScript.gs`,
    gsContent: GANTT_APPS_SCRIPT,
  };
}
