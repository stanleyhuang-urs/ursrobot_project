-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "manualStartColumnId" TEXT,
ADD COLUMN     "manualDurationColumnId" TEXT;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_manualStartColumnId_fkey" FOREIGN KEY ("manualStartColumnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_manualDurationColumnId_fkey" FOREIGN KEY ("manualDurationColumnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;
