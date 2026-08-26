import type { Prisma, NotificationType } from "@prisma/client";
import { getPersonIds } from "@/types/column";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

const EMAIL_NOTIFICATION_TYPES: NotificationType[] = ["ASSIGNED", "AUTOMATION"];

/**
 * Sends an email for notification types the user opted into (指派與自動化規則).
 * Runs outside any DB transaction since it makes a network call.
 */
export async function notifyEmailIfNeeded(
  userId: string,
  type: NotificationType,
  message: string
) {
  if (!EMAIL_NOTIFICATION_TYPES.includes(type)) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user) await sendMail(user.email, "工作管理平台通知", message);
}

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

  // PERSON columns can also hold Resource ids (tools/vendors), which have no
  // account to notify — only real Users can be notification recipients.
  const realUsers = await tx.user.findMany({
    where: { id: { in: Array.from(recipientIds) } },
    select: { id: true },
  });
  const realUserIds = new Set(realUsers.map((u) => u.id));
  const notifiableIds = Array.from(recipientIds).filter((id) => realUserIds.has(id));

  if (notifiableIds.length === 0) return;

  await tx.notification.createMany({
    data: notifiableIds.map((userId) => ({
      userId,
      actorId,
      type,
      itemId,
      message,
    })),
  });
}
