-- Workspace-scoped verified knowledge used by AI context.
CREATE TABLE "KnowledgeItem" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'reference',
  "content" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeItem_brandId_verified_updatedAt_idx"
  ON "KnowledgeItem"("brandId", "verified", "updatedAt");

ALTER TABLE "KnowledgeItem"
  ADD CONSTRAINT "KnowledgeItem_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
