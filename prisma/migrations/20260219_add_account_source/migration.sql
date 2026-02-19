-- AlterTable
ALTER TABLE "Account" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

-- Mark existing bank-synced accounts (those with accountNumber that match bank connection entities)
UPDATE "Account" a
SET "source" = 'bank_sync'
FROM "BankConnection" bc
WHERE a."entityId" = bc."entityId"
  AND a."accountNumber" IS NOT NULL
  AND a."bank" IS NOT NULL;
