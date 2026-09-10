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

export type SocialPostView = {
  id: string;
  platform: "instagram" | "facebook" | "linkedin" | "x";
  contentType: "reel" | "carousel" | "static" | "story";
  title: string;
  caption: string;
  status: "draft" | "scheduled" | "published";
  scheduledAt?: string;
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
