"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";
import { requireBoardAccess } from "@/lib/boardAccess";
import type { SessionPayload } from "@/lib/jwt";
import type { StatusOption } from "@/types/column";
import type { BoardVisibility } from "@prisma/client";

const TYPE_OPTIONS: StatusOption[] = [
  { id: "summary", label: "Summary", color: "#00c875" },
  { id: "milestone", label: "Milestone", color: "#e2445c" },
  { id: "task", label: "Task", color: "#a25ddc" },
];

const PRIORITY_OPTIONS: StatusOption[] = [
  { id: "critical", label: "CRITICAL", color: "#00c875" },
  { id: "high", label: "HIGH", color: "#e2445c" },
  { id: "normal", label: "NORMAL", color: "#a25ddc" },
];

// Same labels as the project's original imported sheet, but the "done"/
// "in_progress" ids match DEFAULT_STATUSES so isItemComplete's built-in
// fallback (and 報表設定) recognize completion without any manual setup.
const STATUS_OPTIONS: StatusOption[] = [
  { id: "planned", label: "Planned", color: "#00c875" },
  { id: "in_progress", label: "In Progress", color: "#a25ddc" },
  { id: "done", label: "Completed", color: "#e2445c" },
];

const LINK_OPTIONS: StatusOption[] = [
  { id: "fs", label: "FS", color: "#00c875" },
  { id: "ff", label: "FF", color: "#e2445c" },
  { id: "ss", label: "SS", color: "#a25ddc" },
  { id: "sf", label: "SF", color: "#579bfc" },
];

async function requireBoardOwnerOrAdmin(boardId: string, session: SessionPayload) {
  if (session.role === "ADMIN") return;
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  if (board?.ownerId !== session.userId) {
    throw new Error("權限不足:僅看板擁有者或管理者可以管理分享設定");
  }
}

/**
 * Every new board starts with this fixed set of columns — matching the
 * project's original imported sheet, plus whatever the dashboard/Gantt/
 * report pages need to work without any manual column-mapping. Board
 * settings (progress/Gantt/Pred/Link/Lag columns, 報表設定) are wired to
 * them automatically right after creation; the settings dropdowns stay
 * editable, they're just pre-selected.
 */
const DEFAULT_COLUMNS = [
  { name: "Lvl", type: "NUMBER" as const, options: {} },
  { name: "Type", type: "STATUS" as const, options: { statuses: TYPE_OPTIONS } },
  { name: "Priority", type: "STATUS" as const, options: { statuses: PRIORITY_OPTIONS } },
  { name: "Status", type: "STATUS" as const, options: { statuses: STATUS_OPTIONS } },
  { name: "Resource", type: "TEXT" as const, options: {} },
  { name: "Pred", type: "TEXT" as const, options: {} },
  { name: "Link", type: "STATUS" as const, options: { statuses: LINK_OPTIONS } },
  { name: "Lag", type: "NUMBER" as const, options: {} },
  { name: "Comment", type: "TEXT" as const, options: {} },
  { name: "Start", type: "DATE" as const, options: {} },
  { name: "Days", type: "NUMBER" as const, options: {} },
  { name: "Finish", type: "DATE" as const, options: {} },
  { name: "% Done", type: "NUMBER" as const, options: {} },
];

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
        create: DEFAULT_COLUMNS.map((c, order) => ({ ...c, order })),
      },
    },
    include: { columns: true },
  });

  const byName = new Map(board.columns.map((c) => [c.name, c.id]));
  const doneOptionId = STATUS_OPTIONS.find((o) => o.label === "Completed")!.id;
  const plannedOptionId = STATUS_OPTIONS.find((o) => o.label === "Planned")!.id;

  await prisma.board.update({
    where: { id: board.id },
    data: {
      progressColumnId: byName.get("% Done"),
      ganttStartColumnId: byName.get("Start"),
      ganttDurationColumnId: byName.get("Days"),
      ganttEndColumnId: byName.get("Finish"),
      predColumnId: byName.get("Pred"),
      linkColumnId: byName.get("Link"),
      lagColumnId: byName.get("Lag"),
      typeColumnId: byName.get("Type"),
      reportStatusColumnId: byName.get("Status"),
      reportDoneOptionIds: [doneOptionId],
      reportPlannedOptionIds: [plannedOptionId],
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

export async function setBoardVisibility(boardId: string, visibility: BoardVisibility) {
  const session = await requireSession();
  await requireBoardOwnerOrAdmin(boardId, session);
  await prisma.board.update({ where: { id: boardId }, data: { visibility } });
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
}

export async function listBoardMembers(boardId: string) {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  return prisma.boardMember.findMany({
    where: { boardId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function addBoardMember(boardId: string, userId: string) {
  const session = await requireSession();
  await requireBoardOwnerOrAdmin(boardId, session);
  await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId, userId } },
    create: { boardId, userId },
    update: {},
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function removeBoardMember(boardId: string, userId: string) {
  const session = await requireSession();
  await requireBoardOwnerOrAdmin(boardId, session);
  await prisma.boardMember.deleteMany({ where: { boardId, userId } });
  revalidatePath(`/boards/${boardId}`);
}
