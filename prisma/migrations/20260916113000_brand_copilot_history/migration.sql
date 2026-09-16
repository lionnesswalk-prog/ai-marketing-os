CREATE TABLE "BrandCopilotMessage" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCopilotMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrandCopilotMessage_brandId_createdAt_idx"
ON "BrandCopilotMessage"("brandId", "createdAt");

ALTER TABLE "BrandCopilotMessage"
ADD CONSTRAINT "BrandCopilotMessage_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
