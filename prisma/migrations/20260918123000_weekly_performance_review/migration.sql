CREATE TABLE "WeeklyPerformanceReview" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "aiMode" TEXT,
    "evidenceJson" JSONB NOT NULL,
    "reviewJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyPerformanceReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyPerformanceReview_brandId_periodKey_key"
ON "WeeklyPerformanceReview"("brandId", "periodKey");

CREATE INDEX "WeeklyPerformanceReview_brandId_periodEnd_idx"
ON "WeeklyPerformanceReview"("brandId", "periodEnd");

ALTER TABLE "WeeklyPerformanceReview"
ADD CONSTRAINT "WeeklyPerformanceReview_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
