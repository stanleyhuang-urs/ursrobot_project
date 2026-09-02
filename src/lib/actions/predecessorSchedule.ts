"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { requireBoardAccess } from "@/lib/boardAccess";
import { requireStructureAccess } from "@/lib/permissions";
import { recomputeAllSchedules, previewScheduleChange, type SchedulePreview } from "@/lib/predecessorLink";

export async function recomputeBoardSchedule(boardId: string): Promise<number> {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  requireStructureAccess(session.role);

  const recomputedCount = await recomputeAllSchedules(boardId);
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/settings");
  return recomputedCount;
}

/** Read-only: what Start/Finish/Days would become if this field were set to
 *  newValue, without applying it — powers the assignment modal's "this will
 *  move the dates, confirm?" prompt. */
export async function previewSchedule(
  boardId: string,
  itemId: string,
  columnId: string,
  newValue: string | number | null
): Promise<SchedulePreview | null> {
  const session = await requireSession();
  await requireBoardAccess(boardId, session);
  return previewScheduleChange(boardId, itemId, columnId, newValue);
}
