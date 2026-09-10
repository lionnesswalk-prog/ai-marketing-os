import { diagnoseCampaign } from "../../../packages/core/src/diagnostics";
import type { CampaignSnapshot } from "../../../packages/core/src/types";
import type { ApprovalView, InsightView, LeadView, SocialPostView } from "./domain";

const campaigns: CampaignSnapshot[] = [
  {
    id: "c_meta_festive",
    name: "Festive Prospecting",
    channel: "meta",
    status: "active",
    dailyBudget: 3200,
    spend: 8200,
    impressions: 120000,
    clicks: 3100,
    conversions: 62,
    revenue: 39360,
    frequency: 1.8,
  },
  {
    id: "c_meta_test_b",
    name: "Creative Test B",
    channel: "meta",
    status: "active",
    dailyBudget: 1500,
    spend: 2520,
    impressions: 44000,
    clicks: 420,
    conversions: 7,
    revenue: 3024,
    frequency: 2.7,
  },
  {
    id: "c_google_brand",
    name: "High Intent Search",
    channel: "google",
    status: "active",
    dailyBudget: 1800,
    spend: 4860,
    impressions: 22000,
    clicks: 1550,
    conversions: 54,
    revenue: 24300,
  },
  {
    id: "c_meta_retarg",
    name: "30D Retargeting",
    channel: "meta",
    status: "active",
    dailyBudget: 1900,
    spend: 4600,
    impressions: 31000,
    clicks: 980,
    conversions: 35,
    revenue: 18300,
    frequency: 3.9,
  },
];

const leads: LeadView[] = [
  {
    id: "IG-1024",
    source: "instagram",
    customerName: "Aanya",
    message: "Do you have this dress in Medium?",
    intent: "high",
    status: "new",
    productInterest: "Evening dress",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "WA-880",
    source: "whatsapp",
    customerName: "Riya",
    message: "Can this arrive in Ahmedabad before Saturday?",
    intent: "high",
    status: "follow_up",
    productInterest: "Sculpted top",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "WEB-299",
    source: "website",
    customerName: "Mira",
    message: "I want to understand how your one-of-one promise works.",
    intent: "medium",
    status: "new",
    updatedAt: new Date().toISOString(),
  },
];

const socialPosts: SocialPostView[] = [
  {
    id: "sp_01",
    platform: "instagram",
    contentType: "reel",
    title: "The Walk",
    caption: "A garment begins with how it should feel in motion. Quietly composed. Entirely its own.",
    status: "scheduled",
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: "sp_02",
    platform: "instagram",
    contentType: "carousel",
    title: "Inside the Garment",
    caption: "Luxury continues where the eye does not. Seams, structure and finishing—decisions made for the wearing experience.",
    status: "draft",
  },
  {
    id: "sp_03",
    platform: "facebook",
    contentType: "static",
    title: "One-of-One Promise",
    caption: "Once a design in your size is yours, that exact size is never reproduced for another customer.",
    status: "draft",
  },
];

const insights: InsightView[] = [
  {
    id: "i_01",
    kind: "creative",
    title: "Creative Test B needs a new hook",
    detail: "CTR is below the starter threshold and ROAS is weak. Test a materially different opening frame before scaling.",
    severity: "action",
  },
  {
    id: "i_02",
    kind: "creative",
    title: "Retargeting frequency is rising",
    detail: "The 30-day retargeting campaign is approaching creative fatigue. Rotate fresh creative while preserving the audience.",
    severity: "watch",
  },
  {
    id: "i_03",
    kind: "budget",
    title: "Festive Prospecting can support a controlled scale test",
    detail: "ROAS and conversion volume are strong. A 15% budget increase can be proposed, but must be approved first.",
    severity: "info",
  },
];

function initialApprovals(): ApprovalView[] {
  const result: ApprovalView[] = [];
  for (const campaign of campaigns) {
    const diagnosis = diagnoseCampaign(campaign);
    for (const action of diagnosis.actions.filter((item) => item.requiresApproval)) {
      result.push({
        id: `approval_${campaign.id}_${action.action}`,
        brandId: "brand_lioness_walk",
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: action.action,
        reason: action.reason,
        spendImpactPct: action.spendImpactPct,
        confidence: action.confidence,
        status: "pending",
        requestedAt: new Date().toISOString(),
      });
    }
  }
  return result;
}

type MemoryState = {
  approvals: ApprovalView[];
};

const globalForStore = globalThis as unknown as { marketingOsMemory?: MemoryState };
const state = (globalForStore.marketingOsMemory ??= { approvals: initialApprovals() });

export const memoryStore = {
  campaigns,
  leads,
  socialPosts,
  insights,
  approvals: state.approvals,
};
