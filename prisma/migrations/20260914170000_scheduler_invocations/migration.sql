CREATE TABLE "SchedulerInvocation" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "claimed" INTEGER NOT NULL DEFAULT 0,
  "published" INTEGER NOT NULL DEFAULT 0,
  "processing" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "recovered" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  CONSTRAINT "SchedulerInvocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchedulerInvocation_startedAt_idx" ON "SchedulerInvocation"("startedAt");
