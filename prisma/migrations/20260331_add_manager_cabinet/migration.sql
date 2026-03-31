ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE TABLE "ManagerCompanyAccess" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "ManagerCompanyAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagerCompanyAccess_userId_companyId_key" ON "ManagerCompanyAccess"("userId", "companyId");
CREATE INDEX "ManagerCompanyAccess_userId_idx" ON "ManagerCompanyAccess"("userId");
CREATE INDEX "ManagerCompanyAccess_companyId_idx" ON "ManagerCompanyAccess"("companyId");

ALTER TABLE "ManagerCompanyAccess"
  ADD CONSTRAINT "ManagerCompanyAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManagerCompanyAccess"
  ADD CONSTRAINT "ManagerCompanyAccess_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManagerCompanyAccess"
  ADD CONSTRAINT "ManagerCompanyAccess_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
