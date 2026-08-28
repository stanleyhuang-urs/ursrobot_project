-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "typeColumnId" TEXT;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_typeColumnId_fkey" FOREIGN KEY ("typeColumnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;
