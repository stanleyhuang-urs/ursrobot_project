-- CreateEnum
CREATE TYPE "GanttDurationMode" AS ENUM ('CALENDAR', 'BUSINESS');

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "ganttDurationMode" "GanttDurationMode" NOT NULL DEFAULT 'CALENDAR';

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");
