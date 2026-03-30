-- CreateTable
CREATE TABLE "ArticleDirection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expenseArticleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArticleDirection_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "DdsOperation" ADD COLUMN "directionId" TEXT;

-- AddColumn
ALTER TABLE "DdsTemplate" ADD COLUMN "directionId" TEXT;

-- AddForeignKey
ALTER TABLE "ArticleDirection" ADD CONSTRAINT "ArticleDirection_expenseArticleId_fkey" FOREIGN KEY ("expenseArticleId") REFERENCES "ExpenseArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DdsOperation" ADD CONSTRAINT "DdsOperation_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "ArticleDirection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DdsTemplate" ADD CONSTRAINT "DdsTemplate_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "ArticleDirection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
