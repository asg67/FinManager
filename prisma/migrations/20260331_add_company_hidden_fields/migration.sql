-- AddColumn
ALTER TABLE "Company" ADD COLUMN "hiddenFields" JSONB NOT NULL DEFAULT '[]';
