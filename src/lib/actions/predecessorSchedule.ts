"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { requireBoardAccess } from "@/lib/boardAccess";
import { requireStructureAccess } from "@/lib/permissions";
import { recomputeAllSchedules } from "@/lib/predecessorLink";

export async function recomputeBoardSchedule(boardId: string): Promise<number> {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);

  const recomputedCount = await recomputeAllSchedules(boardId);
  revalidatePath(`/boards/${boardId}`);
  return recomputedCount;
}
