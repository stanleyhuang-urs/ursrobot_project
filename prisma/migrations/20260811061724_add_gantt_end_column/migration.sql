-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "ganttEndColumnId" TEXT;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_ganttEndColumnId_fkey" FOREIGN KEY ("ganttEndColumnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;
