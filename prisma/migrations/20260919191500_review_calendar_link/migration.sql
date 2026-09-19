ALTER TABLE "ContentCalendarPlan"
ADD COLUMN "sourceReviewId" TEXT;

CREATE UNIQUE INDEX "ContentCalendarPlan_sourceReviewId_key"
ON "ContentCalendarPlan"("sourceReviewId");
