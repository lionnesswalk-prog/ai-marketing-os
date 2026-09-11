import type { CampaignDiagnosis, CampaignSnapshot, Lead, OptimizationActionName } from "../../../packages/core/src/types";

export type CampaignView = CampaignSnapshot & { diagnosis: CampaignDiagnosis };

export type LeadView = Lead & {
  productInterest?: string;
  updatedAt?: string;
};

export type ApprovalView = {
  id: string;
  brandId: string;
  campaignId: string;
  campaignName: string;
  action: OptimizationActionName;
  reason: string;
  spendImpactPct?: number;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
};

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "x" | "tiktok" | "youtube" | "pinterest";
export type SocialContentType = "reel" | "carousel" | "static" | "story" | "video" | "short";

export type SocialPostView = {
  id: string;
  platform: SocialPlatform;
  contentType: SocialContentType;
  title: string;
  caption: string;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  scheduledAt?: string;
  externalId?: string;
  mediaUrl?: string;
  linkUrl?: string;
  hashtags?: string;
  cta?: string;
  altText?: string;
  lastDeliveryError?: string;
  lastDeliveryAttemptAt?: string;
};

export type InsightView = {
  id: string;
  kind: "creative" | "budget" | "landing_page" | "audience" | "lead";
  title: string;
  detail: string;
  severity: "info" | "watch" | "action";
};

export type DashboardView = {
  spend: number;
  revenue: number;
  roas: number;
  leads: number;
  pendingApprovals: number;
  campaignsNeedingAction: number;
  insights: InsightView[];
};
