-- AlterTable: make entityId optional, add companyId for ExpenseType
ALTER TABLE "ExpenseType" ALTER COLUMN "entityId" DROP NOT NULL;
ALTER TABLE "ExpenseType" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ExpenseType" ADD CONSTRAINT "ExpenseType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: make entityId optional, add companyId for IncomeType
ALTER TABLE "IncomeType" ALTER COLUMN "entityId" DROP NOT NULL;
ALTER TABLE "IncomeType" ADD COLUMN "companyId" TEXT;
ALTER TABLE "IncomeType" ADD CONSTRAINT "IncomeType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
