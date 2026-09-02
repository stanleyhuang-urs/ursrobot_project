"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireStructureAccess } from "@/lib/permissions";
import { requireBoardAccess } from "@/lib/boardAccess";
import type { ColumnType, StatusColumnOptions } from "@/types/column";
import { DEFAULT_STATUSES, getStatusOptions } from "@/types/column";

// The scheduling engine (predecessorLink.ts) only ever recognizes these 4
// labels as a valid Pred relationship — a Link column whose options were
// auto-populated from whatever values happened to appear during import can
// easily be missing one (e.g. a sheet that never used "SF"), silently
// making that relationship unselectable. Backfilled whenever a column is
// designated the board's Link column — see setLinkColumn.
const REQUIRED_LINK_OPTIONS: { label: string; color: string }[] = [
  { label: "FS", color: "#00c875" },
  { label: "FF", color: "#e2445c" },
  { label: "SS", color: "#a25ddc" },
  { label: "SF", color: "#579bfc" },
];

export async function createColumn(
  boardId: string,
  name: string,
  type: ColumnType
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
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
  await requireBoardAccess(boardId, session);
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
  await requireBoardAccess(boardId, session);
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
  await requireBoardAccess(boardId, session);
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
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.column.delete({ where: { id: columnId } });
  revalidatePath(`/boards/${boardId}`);
}

export async function setProgressColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
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
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { ganttStartColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
}

export async function setGanttDurationColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { ganttDurationColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
}

export async function setGanttEndColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { ganttEndColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
}


export async function setPredColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { predColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
}

export async function setLinkColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { linkColumnId: columnId },
  });
  if (columnId) {
    const column = await prisma.column.findUnique({ where: { id: columnId }, select: { options: true } });
    const existing = getStatusOptions(column?.options);
    const missing = REQUIRED_LINK_OPTIONS.filter(
      (req) => !existing.some((o) => o.label === req.label)
    );
    if (missing.length > 0) {
      const updated = [...existing, ...missing.map((m) => ({ id: randomUUID().slice(0, 8), ...m }))];
      await prisma.column.update({
        where: { id: columnId },
        data: { options: { statuses: updated } },
      });
    }
  }
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
}

export async function setGanttLagColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { lagColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
}

export async function setGanttTypeColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { typeColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
}

export async function setManualStartColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { manualStartColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
}

export async function setManualDurationColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: { manualDurationColumnId: columnId },
  });
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
}

export async function setReportStatusColumn(
  boardId: string,
  columnId: string | null
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: {
      reportStatusColumnId: columnId,
      reportNotStartedOptionIds: [],
      reportPlannedOptionIds: [],
      reportPausedOptionIds: [],
      reportStuckOptionIds: [],
      reportDoneOptionIds: [],
    },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function setReportStatusBuckets(
  boardId: string,
  buckets: {
    notStartedOptionIds: string[];
    plannedOptionIds: string[];
    pausedOptionIds: string[];
    stuckOptionIds: string[];
    doneOptionIds: string[];
  }
) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);
  await prisma.board.update({
    where: { id: boardId },
    data: {
      reportNotStartedOptionIds: buckets.notStartedOptionIds,
      reportPlannedOptionIds: buckets.plannedOptionIds,
      reportPausedOptionIds: buckets.pausedOptionIds,
      reportStuckOptionIds: buckets.stuckOptionIds,
      reportDoneOptionIds: buckets.doneOptionIds,
    },
  });
  revalidatePath(`/boards/${boardId}`);
}

