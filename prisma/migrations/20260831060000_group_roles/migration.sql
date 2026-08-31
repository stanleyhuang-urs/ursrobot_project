-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('TEAM_LEADER', 'SW_DM', 'HW_DM', 'ME_DM', 'QA', 'PMM', 'PMD');

-- CreateEnum
CREATE TYPE "GroupDiscipline" AS ENUM ('SW', 'HW', 'ME', 'QA');

-- CreateTable
CREATE TABLE "GroupRoleAssignment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GroupRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "discipline" "GroupDiscipline" NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupResourceMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,

    CONSTRAINT "GroupResourceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupRoleAssignment_groupId_role_userId_key" ON "GroupRoleAssignment"("groupId", "role", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_discipline_userId_key" ON "GroupMember"("groupId", "discipline", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupResourceMember_groupId_resourceId_key" ON "GroupResourceMember"("groupId", "resourceId");

-- AddForeignKey
ALTER TABLE "GroupRoleAssignment" ADD CONSTRAINT "GroupRoleAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoleAssignment" ADD CONSTRAINT "GroupRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupResourceMember" ADD CONSTRAINT "GroupResourceMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupResourceMember" ADD CONSTRAINT "GroupResourceMember_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
