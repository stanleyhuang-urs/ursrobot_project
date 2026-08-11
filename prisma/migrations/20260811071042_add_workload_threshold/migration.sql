-- CreateTable
CREATE TABLE "WorkloadThreshold" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "greenMax" INTEGER NOT NULL DEFAULT 30,
    "yellowMax" INTEGER NOT NULL DEFAULT 70,
    "greenColor" TEXT NOT NULL DEFAULT '#00c875',
    "yellowColor" TEXT NOT NULL DEFAULT '#fdab3d',
    "redColor" TEXT NOT NULL DEFAULT '#e2445c',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkloadThreshold_pkey" PRIMARY KEY ("id")
);
