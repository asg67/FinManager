-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyId" TEXT,
ALTER COLUMN "theme" SET DEFAULT 'light';

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "usedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============ DATA MIGRATION ============

-- Create companies for existing owners who have entities
INSERT INTO "Company" ("id", "name", "onboardingDone", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u."name", true, u."createdAt", NOW()
FROM "User" u
WHERE u."role" = 'owner'
  AND EXISTS (SELECT 1 FROM "Entity" e WHERE e."ownerId" = u."id");

-- Assign owners to their companies (match by name + createdAt)
UPDATE "User" u
SET "companyId" = c."id"
FROM "Company" c
WHERE u."role" = 'owner'
  AND c."name" = u."name"
  AND c."createdAt" = u."createdAt";

-- Assign employees to the company of their inviter
UPDATE "User" u
SET "companyId" = inviter."companyId"
FROM "User" inviter
WHERE u."role" = 'employee'
  AND u."invitedById" = inviter."id"
  AND inviter."companyId" IS NOT NULL;

-- Assign entities to company of their owner
UPDATE "Entity" e
SET "companyId" = u."companyId"
FROM "User" u
WHERE e."ownerId" = u."id"
  AND u."companyId" IS NOT NULL;
