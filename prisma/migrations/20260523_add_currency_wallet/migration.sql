-- AlterTable: Add currency to Account
ALTER TABLE "Account" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB';

-- AlterTable: Add currency fields to DdsOperation
ALTER TABLE "DdsOperation" ADD COLUMN "currencyAmount" DECIMAL(15,2);
ALTER TABLE "DdsOperation" ADD COLUMN "exchangeRate" DECIMAL(15,4);
