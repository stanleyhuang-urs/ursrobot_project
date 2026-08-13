-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "reportNotStartedOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reportPausedOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reportPlannedOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
