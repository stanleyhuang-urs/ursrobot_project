-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "levelColors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ganttDurationMode" "GanttDurationMode" NOT NULL DEFAULT 'BUSINESS';
