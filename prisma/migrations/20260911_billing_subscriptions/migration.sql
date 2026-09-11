CREATE TABLE "WorkspaceSubscription" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "planKey" TEXT NOT NULL DEFAULT 'starter',
  "status" TEXT NOT NULL DEFAULT 'inactive',
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceSubscription_workspaceId_key" ON "WorkspaceSubscription"("workspaceId");
CREATE UNIQUE INDEX "WorkspaceSubscription_stripeCustomerId_key" ON "WorkspaceSubscription"("stripeCustomerId");
CREATE UNIQUE INDEX "WorkspaceSubscription_stripeSubscriptionId_key" ON "WorkspaceSubscription"("stripeSubscriptionId");
CREATE INDEX "WorkspaceSubscription_status_planKey_idx" ON "WorkspaceSubscription"("status", "planKey");
ALTER TABLE "WorkspaceSubscription"
ADD CONSTRAINT "WorkspaceSubscription_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
