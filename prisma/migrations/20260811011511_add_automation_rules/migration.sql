-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'AUTOMATION';

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerColumnId" TEXT NOT NULL,
    "triggerValue" TEXT NOT NULL,
    "notifyUserId" TEXT,
    "setColumnId" TEXT,
    "setValue" JSONB,
    "moveToGroupId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_triggerColumnId_fkey" FOREIGN KEY ("triggerColumnId") REFERENCES "Column"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_notifyUserId_fkey" FOREIGN KEY ("notifyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_setColumnId_fkey" FOREIGN KEY ("setColumnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_moveToGroupId_fkey" FOREIGN KEY ("moveToGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
