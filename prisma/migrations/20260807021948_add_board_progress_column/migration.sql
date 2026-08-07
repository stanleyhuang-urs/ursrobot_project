-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "progressColumnId" TEXT;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_progressColumnId_fkey" FOREIGN KEY ("progressColumnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;
