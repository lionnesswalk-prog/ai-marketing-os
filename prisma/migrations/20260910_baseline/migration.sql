CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Brand" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "voiceJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceUser" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "passwordHash" TEXT,
  "role" TEXT NOT NULL,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "externalId" TEXT,
  "channel" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "dailyBudget" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignMetric" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "spend" DECIMAL(12,2) NOT NULL,
  "impressions" INTEGER NOT NULL,
  "clicks" INTEGER NOT NULL,
  "conversions" INTEGER NOT NULL,
  "revenue" DECIMAL(12,2) NOT NULL,
  "frequency" DECIMAL(8,3),
  CONSTRAINT "CampaignMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OptimizationAction" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "confidence" DECIMAL(5,4) NOT NULL,
  "spendImpactPct" DECIMAL(6,2),
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executedAt" TIMESTAMP(3),
  CONSTRAINT "OptimizationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Approval" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decidedBy" TEXT,
  CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "externalId" TEXT,
  "source" TEXT NOT NULL,
  "name" TEXT,
  "message" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadMessage" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPost" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "caption" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "scheduledAt" TIMESTAMP(3),
  "externalId" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingInsight" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "MarketingInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalAccountId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'disconnected',
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceUser_email_key" ON "WorkspaceUser"("email");
CREATE UNIQUE INDEX "WorkspaceUser_workspaceId_email_key" ON "WorkspaceUser"("workspaceId", "email");
CREATE INDEX "WorkspaceUser_workspaceId_idx" ON "WorkspaceUser"("workspaceId");
CREATE INDEX "Brand_workspaceId_idx" ON "Brand"("workspaceId");
CREATE INDEX "Campaign_brandId_channel_idx" ON "Campaign"("brandId", "channel");
CREATE UNIQUE INDEX "Campaign_brandId_channel_externalId_key" ON "Campaign"("brandId", "channel", "externalId");
CREATE INDEX "CampaignMetric_campaignId_capturedAt_idx" ON "CampaignMetric"("campaignId", "capturedAt");
CREATE INDEX "OptimizationAction_campaignId_status_idx" ON "OptimizationAction"("campaignId", "status");
CREATE UNIQUE INDEX "Approval_actionId_key" ON "Approval"("actionId");
CREATE INDEX "Approval_brandId_status_idx" ON "Approval"("brandId", "status");
CREATE INDEX "Lead_brandId_status_intent_idx" ON "Lead"("brandId", "status", "intent");
CREATE INDEX "LeadMessage_leadId_createdAt_idx" ON "LeadMessage"("leadId", "createdAt");
CREATE INDEX "SocialPost_brandId_status_scheduledAt_idx" ON "SocialPost"("brandId", "status", "scheduledAt");
CREATE INDEX "MarketingInsight_brandId_resolvedAt_createdAt_idx" ON "MarketingInsight"("brandId", "resolvedAt", "createdAt");
CREATE UNIQUE INDEX "IntegrationConnection_brandId_provider_key" ON "IntegrationConnection"("brandId", "provider");
CREATE INDEX "AuditLog_brandId_createdAt_idx" ON "AuditLog"("brandId", "createdAt");

ALTER TABLE "Brand" ADD CONSTRAINT "Brand_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceUser" ADD CONSTRAINT "WorkspaceUser_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignMetric" ADD CONSTRAINT "CampaignMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptimizationAction" ADD CONSTRAINT "OptimizationAction_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "OptimizationAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadMessage" ADD CONSTRAINT "LeadMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingInsight" ADD CONSTRAINT "MarketingInsight_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
