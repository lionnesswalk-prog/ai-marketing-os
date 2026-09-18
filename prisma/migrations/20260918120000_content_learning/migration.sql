CREATE TABLE "ContentPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "providerContentId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "theme" TEXT,
    "headline" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "metricsJson" JSONB NOT NULL,
    "engagementScore" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentPerformanceSnapshot_socialPostId_key"
ON "ContentPerformanceSnapshot"("socialPostId");

CREATE INDEX "ContentPerformanceSnapshot_brandId_platform_capturedAt_idx"
ON "ContentPerformanceSnapshot"("brandId", "platform", "capturedAt");

CREATE INDEX "ContentPerformanceSnapshot_providerContentId_idx"
ON "ContentPerformanceSnapshot"("providerContentId");

ALTER TABLE "ContentPerformanceSnapshot"
ADD CONSTRAINT "ContentPerformanceSnapshot_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentPerformanceSnapshot"
ADD CONSTRAINT "ContentPerformanceSnapshot_socialPostId_fkey"
FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
