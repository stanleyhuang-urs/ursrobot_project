-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "linkColumnId" TEXT,
ADD COLUMN     "predColumnId" TEXT;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_predColumnId_fkey" FOREIGN KEY ("predColumnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_linkColumnId_fkey" FOREIGN KEY ("linkColumnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;
