-- AlterTable
ALTER TABLE "Company" ADD COLUMN "incomeDirections" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DdsOperation" ADD COLUMN "incomeDirection" TEXT;
