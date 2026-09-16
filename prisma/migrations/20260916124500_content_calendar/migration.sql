CREATE TABLE "ContentCalendarPlan" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "objective" TEXT NOT NULL,
    "focus" TEXT,
    "aiMode" TEXT,
    "timingJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCalendarPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentCalendarItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "hashtags" JSONB,
    "visualDirection" TEXT NOT NULL,
    "postingWindow" TEXT NOT NULL,
    "timingReason" TEXT NOT NULL,
    "timingEvidence" TEXT NOT NULL,
    "socialPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentCalendarItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentCalendarItem_socialPostId_key"
ON "ContentCalendarItem"("socialPostId");

CREATE INDEX "ContentCalendarPlan_brandId_createdAt_idx"
ON "ContentCalendarPlan"("brandId", "createdAt");

CREATE INDEX "ContentCalendarItem_planId_dayOffset_idx"
ON "ContentCalendarItem"("planId", "dayOffset");

ALTER TABLE "ContentCalendarPlan"
ADD CONSTRAINT "ContentCalendarPlan_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentCalendarItem"
ADD CONSTRAINT "ContentCalendarItem_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "ContentCalendarPlan"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
