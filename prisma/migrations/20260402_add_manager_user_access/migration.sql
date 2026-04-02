-- CreateTable
CREATE TABLE "ManagerUserAccess" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ManagerUserAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerUserAccess_managerId_idx" ON "ManagerUserAccess"("managerId");

-- CreateIndex
CREATE INDEX "ManagerUserAccess_targetUserId_idx" ON "ManagerUserAccess"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerUserAccess_managerId_targetUserId_key" ON "ManagerUserAccess"("managerId", "targetUserId");

-- AddForeignKey
ALTER TABLE "ManagerUserAccess" ADD CONSTRAINT "ManagerUserAccess_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerUserAccess" ADD CONSTRAINT "ManagerUserAccess_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerUserAccess" ADD CONSTRAINT "ManagerUserAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
