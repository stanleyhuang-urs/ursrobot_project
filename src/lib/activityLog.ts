import { prisma } from "@/lib/prisma";

export async function logActivity(itemId: string, actorId: string | null, message: string) {
  await prisma.activityLogEntry.create({ data: { itemId, actorId, message } });
}
