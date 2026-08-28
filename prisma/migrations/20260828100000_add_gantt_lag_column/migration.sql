-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "lagColumnId" TEXT;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_lagColumnId_fkey" FOREIGN KEY ("lagColumnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;
