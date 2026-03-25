-- AlterTable: add mode to Company
ALTER TABLE "Company" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'full';

-- CreateTable: IncomeType
CREATE TABLE "IncomeType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IncomeArticle
CREATE TABLE "IncomeArticle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "incomeTypeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IncomeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomField
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'select',
    "options" JSONB,
    "showWhen" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomFieldValue
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "ddsOperationId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add incomeTypeId, incomeArticleId to DdsOperation
ALTER TABLE "DdsOperation" ADD COLUMN "incomeTypeId" TEXT;
ALTER TABLE "DdsOperation" ADD COLUMN "incomeArticleId" TEXT;

-- AlterTable: add incomeTypeId, incomeArticleId to DdsTemplate
ALTER TABLE "DdsTemplate" ADD COLUMN "incomeTypeId" TEXT;
ALTER TABLE "DdsTemplate" ADD COLUMN "incomeArticleId" TEXT;

-- CreateIndex: unique constraint on CustomFieldValue
CREATE UNIQUE INDEX "CustomFieldValue_customFieldId_ddsOperationId_key" ON "CustomFieldValue"("customFieldId", "ddsOperationId");

-- AddForeignKey: IncomeType -> Entity
ALTER TABLE "IncomeType" ADD CONSTRAINT "IncomeType_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: IncomeArticle -> IncomeType
ALTER TABLE "IncomeArticle" ADD CONSTRAINT "IncomeArticle_incomeTypeId_fkey" FOREIGN KEY ("incomeTypeId") REFERENCES "IncomeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CustomField -> Company
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CustomFieldValue -> CustomField
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CustomFieldValue -> DdsOperation
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_ddsOperationId_fkey" FOREIGN KEY ("ddsOperationId") REFERENCES "DdsOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: DdsOperation -> IncomeType
ALTER TABLE "DdsOperation" ADD CONSTRAINT "DdsOperation_incomeTypeId_fkey" FOREIGN KEY ("incomeTypeId") REFERENCES "IncomeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: DdsOperation -> IncomeArticle
ALTER TABLE "DdsOperation" ADD CONSTRAINT "DdsOperation_incomeArticleId_fkey" FOREIGN KEY ("incomeArticleId") REFERENCES "IncomeArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: DdsTemplate -> IncomeType
ALTER TABLE "DdsTemplate" ADD CONSTRAINT "DdsTemplate_incomeTypeId_fkey" FOREIGN KEY ("incomeTypeId") REFERENCES "IncomeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: DdsTemplate -> IncomeArticle
ALTER TABLE "DdsTemplate" ADD CONSTRAINT "DdsTemplate_incomeArticleId_fkey" FOREIGN KEY ("incomeArticleId") REFERENCES "IncomeArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
