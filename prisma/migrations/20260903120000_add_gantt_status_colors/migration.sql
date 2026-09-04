-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "ganttOverdueColor" TEXT NOT NULL DEFAULT '#e2445c',
ADD COLUMN     "ganttCompletedColor" TEXT NOT NULL DEFAULT '#9ca3af',
ADD COLUMN     "ganttInProgressColor" TEXT NOT NULL DEFAULT '#00c875';

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "ganttOverdueColor" TEXT NOT NULL DEFAULT '#e2445c',
ADD COLUMN     "ganttCompletedColor" TEXT NOT NULL DEFAULT '#9ca3af',
ADD COLUMN     "ganttInProgressColor" TEXT NOT NULL DEFAULT '#00c875';
