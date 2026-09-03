"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";
import { boardWithDataArgs, type UserOption } from "@/types/board";
import { buildGanttWorkbook } from "@/lib/export/ganttWorkbookExport";
import { GANTT_APPS_SCRIPT } from "@/lib/export/ganttAppsScript";
import { listHolidays } from "@/lib/holidays";

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

export async function exportGanttWorkbook(
  boardId: string,
  groupId: string,
  options: { extraColumnIds?: string[]; maxLevel?: number | null } = {}
): Promise<{ xlsxFilename: string; xlsxBase64: string; gsFilename: string; gsContent: string }> {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  const [board, users, resources, holidays] = await Promise.all([
    prisma.board.findUnique({ where: { id: boardId }, ...boardWithDataArgs }),
    prisma.user.findMany({
      select: { id: true, name: true, supervisorId: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
    prisma.resource.findMany({ orderBy: { order: "asc" } }),
    listHolidays(),
  ]);
  if (!board) throw new Error("找不到看板");

  const group = board.groups.find((g) => g.id === groupId);
  if (!group) throw new Error("找不到分組");

  // Resources (tools, external vendors) can be set as an item's 負責人
  // alongside real Users, so PERSON-column values may reference either —
  // same merged list used to render the assignee dropdown in board views.
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

  const buffer = await buildGanttWorkbook(board, group, {
    extraColumnIds: options.extraColumnIds,
    maxLevel: options.maxLevel,
    users: assignees,
    holidays,
  });
  const baseName = sanitizeFilename(`${board.name}-${group.name}-Gantt`);

  return {
    xlsxFilename: `${baseName}.xlsx`,
    xlsxBase64: buffer.toString("base64"),
    gsFilename: `${baseName}-AppsScript.gs`,
    gsContent: GANTT_APPS_SCRIPT,
  };
}
