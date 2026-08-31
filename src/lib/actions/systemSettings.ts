"use server";

import { revalidatePath } from "next/cache";
import type { GanttDurationMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";

export async function getSystemSettings() {
  const settings = await prisma.systemSettings.findUnique({ where: { id: "global" } });
  if (settings) return settings;
  return {
    id: "global",
    emailNotificationsEnabled: false,
    levelColors: [] as string[],
    ganttDurationMode: "BUSINESS" as GanttDurationMode,
    updatedAt: new Date(),
  };
}

export async function setEmailNotificationsEnabled(enabled: boolean) {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  await prisma.systemSettings.upsert({
    where: { id: "global" },
    create: { id: "global", emailNotificationsEnabled: enabled },
    update: { emailNotificationsEnabled: enabled },
  });

  revalidatePath("/settings");
}

/**
 * 階層顏色 and 計算方式 used to be per-board settings; they're app-wide now.
 * A write here also broadcasts to every Board's own copy of the field, so
 * the many existing places that read board.levelColors/board.ganttDurationMode
 * don't need to change — they just always see the current global value.
 */
export async function setLevelColors(colors: string[]) {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  await prisma.$transaction([
    prisma.systemSettings.upsert({
      where: { id: "global" },
      create: { id: "global", levelColors: colors },
      update: { levelColors: colors },
    }),
    prisma.board.updateMany({ data: { levelColors: colors } }),
  ]);

  revalidatePath("/settings");
  revalidatePath("/boards/[boardId]", "page");
}

export async function setGanttDurationMode(mode: GanttDurationMode) {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  await prisma.$transaction([
    prisma.systemSettings.upsert({
      where: { id: "global" },
      create: { id: "global", ganttDurationMode: mode },
      update: { ganttDurationMode: mode },
    }),
    prisma.board.updateMany({ data: { ganttDurationMode: mode } }),
  ]);

  revalidatePath("/settings");
  revalidatePath("/boards/[boardId]", "page");
}
