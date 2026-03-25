-- AlterTable
ALTER TABLE "Permission" ADD COLUMN "disabledBanks" TEXT[] DEFAULT ARRAY[]::TEXT[];
