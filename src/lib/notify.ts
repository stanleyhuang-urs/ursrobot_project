import type { Prisma, NotificationType } from "@prisma/client";
import { getPersonIds } from "@/types/column";

/**
 * Notifies everyone assigned to an item (via any PERSON column) plus the
 * board owner, excluding whoever triggered the change.
 */
export async function notifyItemAssignees(
  tx: Prisma.TransactionClient,
  itemId: string,
  actorId: string,
  type: NotificationType,
  message: string
) {
  const item = await tx.item.findUnique({
    where: { id: itemId },
    select: { board: { select: { ownerId: true } } },
  });
  if (!item) return;

  const personCellValues = await tx.cellValue.findMany({
    where: { itemId, column: { type: "PERSON" } },
  });

  const recipientIds = new Set<string>();
  for (const cv of personCellValues) {
    for (const userId of getPersonIds(cv.value)) recipientIds.add(userId);
  }
  recipientIds.add(item.board.ownerId);
  recipientIds.delete(actorId);

  if (recipientIds.size === 0) return;

  await tx.notification.createMany({
    data: Array.from(recipientIds).map((userId) => ({
      userId,
      actorId,
      type,
      itemId,
      message,
    })),
  });
}
