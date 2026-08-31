"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";

export async function addHoliday(date: string, name: string) {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
    throw new Error("日期格式錯誤");
  }
  const trimmedName = name.trim() || "假日";

  await prisma.holiday.upsert({
    where: { date },
    create: { date, name: trimmedName },
    update: { name: trimmedName },
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/boards/[boardId]", "page");
}

export async function removeHoliday(id: string) {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  await prisma.holiday.delete({ where: { id } });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/boards/[boardId]", "page");
}
