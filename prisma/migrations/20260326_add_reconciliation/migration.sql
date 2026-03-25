-- AlterTable
ALTER TABLE "DdsOperation" ADD COLUMN "linkedBankTxId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DdsOperation_linkedBankTxId_key" ON "DdsOperation"("linkedBankTxId");

-- AddForeignKey
ALTER TABLE "DdsOperation" ADD CONSTRAINT "DdsOperation_linkedBankTxId_fkey" FOREIGN KEY ("linkedBankTxId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
