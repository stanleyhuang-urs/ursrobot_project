-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "reportDoneOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reportStatusColumnId" TEXT,
ADD COLUMN     "reportStuckOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_reportStatusColumnId_fkey" FOREIGN KEY ("reportStatusColumnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;
